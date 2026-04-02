import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { DiaryEntry, DiaryPhoto, Mood } from '../types'

function getDiaryRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'diary')
}

export function subscribeDiaryEntries(callback: (entries: DiaryEntry[]) => void) {
  const ref = getDiaryRef()
  if (!ref) {
    callback([])
    return () => {}
  }
  const q = query(ref, orderBy('date', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as DiaryEntry[]
    callback(entries)
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

const UPLOAD_URL = 'https://asia-northeast3-y-diary.cloudfunctions.net/uploadPhoto'
const SHORTCUT_SECRET = 'kXllqPQXmKTV6upnTuA_dPZujYKuwsQ2MAm97dlxSkA'

export async function uploadDiaryPhoto(file: File): Promise<DiaryPhoto | null> {
  const uid = useAuthStore.getState().user?.uid
  if (!uid) throw new Error('로그인 상태를 확인해주세요')

  // JPEG 압축
  let uploadFile: File
  try {
    uploadFile = await withTimeout(compressImage(file, 0.8, 1600), 15000, 'compressImage')
  } catch (err) {
    console.warn('Image compress failed, using original:', err)
    uploadFile = file
  }

  console.log('[diary] uploading via Cloud Function, size:', uploadFile.size)

  // Cloud Function으로 업로드
  const formData = new FormData()
  formData.append('file', uploadFile)
  formData.append('uid', uid)

  const res = await withTimeout(
    fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { 'x-secret': SHORTCUT_SECRET },
      body: formData,
    }),
    90000,
    'uploadPhoto'
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`업로드 실패: ${text}`)
  }

  const data = await res.json()
  console.log('[diary] success:', data.url?.slice(0, 60) + '...')

  return {
    url: data.url,
    storagePath: data.storagePath,
    caption: '',
    uploadedAt: Timestamp.now(),
  }
}

export async function deleteDiaryPhoto(storagePath: string) {
  if (!storage) return
  try {
    const storageRef = ref(storage, storagePath)
    await deleteObject(storageRef)
  } catch (err) {
    console.warn('Photo delete error:', err)
  }
}

async function compressImage(file: File, quality: number, maxSize: number): Promise<File> {
  // browser-image-compression 라이브러리 사용 (HEIC/HEIF 지원)
  try {
    const imageCompression = (await import('browser-image-compression')).default
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: maxSize,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: quality,
    })
    return new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
  } catch (err) {
    console.warn('[diary] browser-image-compression failed, fallback to canvas:', err)
  }

  // Fallback: canvas 기반 압축
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Image compression timeout'))
    }, 10000)

    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      try {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize
            width = maxSize
          } else {
            width = (width / height) * maxSize
            height = maxSize
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: 'image/jpeg' }))
            } else {
              resolve(file) // fallback to original
            }
          },
          'image/jpeg',
          quality
        )
      } catch {
        resolve(file) // fallback to original on any error
      }
    }
    img.onerror = () => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      resolve(file) // fallback to original if image fails to load
    }
    img.src = url
  })
}

export async function addDiaryEntry(data: {
  date: Date
  title?: string
  mood: Mood | null
  content: string
  photos?: DiaryPhoto[]
  links?: string[]
  tasksSummary?: string[]
  eventsSummary?: string[]
}) {
  const ref = getDiaryRef()
  if (!ref) return null

  const now = Timestamp.now()
  const normalized = new Date(data.date)
  normalized.setHours(0, 0, 0, 0)

  return addDoc(ref, {
    date: Timestamp.fromDate(normalized),
    title: data.title || '',
    content: data.content,
    mood: data.mood,
    photos: data.photos || [],
    links: data.links || [],
    tasksSummary: data.tasksSummary || [],
    eventsSummary: data.eventsSummary || [],
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateDiaryEntry(
  entryId: string,
  data: Partial<Omit<DiaryEntry, 'id' | 'createdAt'>>
) {
  const ref = getDiaryRef()
  if (!ref) return

  const entryDoc = doc(ref, entryId)
  await updateDoc(entryDoc, {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function deleteDiaryEntry(entryId: string) {
  const ref = getDiaryRef()
  if (!ref) return

  await deleteDoc(doc(ref, entryId))
}
