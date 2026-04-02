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

export async function uploadDiaryPhoto(file: File): Promise<DiaryPhoto | null> {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !storage) {
    console.error('uploadDiaryPhoto: uid or storage is null', { uid: !!uid, storage: !!storage })
    throw new Error('로그인 상태를 확인해주세요')
  }

  // 항상 JPEG로 압축하여 업로드 (호환성 + 용량 최적화)
  let uploadFile: File
  try {
    uploadFile = await withTimeout(compressImage(file, 0.8, 1600), 15000, 'compressImage')
  } catch (err) {
    console.warn('Image compress failed, using original:', err)
    uploadFile = file
  }

  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
  const storagePath = `users/${uid}/diary/${fileName}`
  const storageRef = ref(storage, storagePath)

  const doUpload = async (attempt: number, useSimple: boolean = false): Promise<DiaryPhoto> => {
    const metadata = { contentType: 'image/jpeg' }
    console.log(`[diary] uploading (attempt ${attempt}, simple=${useSimple}):`, storagePath, 'size:', uploadFile.size)

    try {
      if (useSimple) {
        // 단순 업로드 (resumable 실패 시 fallback)
        await withTimeout(uploadBytes(storageRef, uploadFile, metadata), 90000, 'uploadBytes')
      } else {
        // resumable 업로드
        const uploadTask = uploadBytesResumable(storageRef, uploadFile, metadata)
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            uploadTask.cancel()
            reject(new Error('업로드 시간 초과'))
          }, 90000)

          uploadTask.on('state_changed',
            (snapshot) => {
              const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              console.log(`[diary] upload progress: ${pct}%`)
            },
            (error) => {
              clearTimeout(timer)
              console.error('[diary] upload error:', error.code, error.message, error.serverResponse)
              reject(error)
            },
            () => {
              clearTimeout(timer)
              console.log('[diary] upload complete')
              resolve()
            }
          )
        })
      }

      const url = await withTimeout(getDownloadURL(storageRef), 15000, 'getDownloadURL')
      console.log('[diary] success:', url.slice(0, 60) + '...')

      return {
        url,
        storagePath,
        caption: '',
        uploadedAt: Timestamp.now(),
      }
    } catch (err: any) {
      console.error(`[diary] attempt ${attempt} failed:`, err?.code, err?.message)
      const code = err?.code || ''

      // storage/unknown: 1차 → 단순 업로드로 재시도, 2차 → 대기 후 재시도
      if (code === 'storage/unknown') {
        if (!useSimple) {
          console.log('[diary] retrying with simple upload...')
          return doUpload(attempt + 1, true)
        }
        if (attempt < 4) {
          console.log(`[diary] retrying in ${attempt}s...`)
          await new Promise((r) => setTimeout(r, attempt * 1000))
          return doUpload(attempt + 1, true)
        }
      }

      if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
        throw new Error('권한이 없습니다. 다시 로그인해주세요.')
      } else if (code === 'storage/quota-exceeded') {
        throw new Error('저장 공간이 부족합니다.')
      } else if (code === 'storage/canceled') {
        throw new Error('업로드 시간이 초과되었습니다.')
      } else if (err?.message?.includes('시간 초과')) {
        throw new Error('업로드 시간이 초과되었습니다. 네트워크를 확인해주세요.')
      } else {
        throw new Error(`업로드 실패: ${err?.serverResponse || err?.message || '네트워크 연결을 확인해주세요.'}`)
      }
    }
  }

  return doUpload(1)
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
