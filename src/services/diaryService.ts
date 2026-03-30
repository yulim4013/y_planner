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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
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

export async function uploadDiaryPhoto(file: File): Promise<DiaryPhoto | null> {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !storage) return null

  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const storagePath = `users/${uid}/diary/${fileName}`
  const storageRef = ref(storage, storagePath)

  // Compress image if too large (> 1MB)
  let uploadFile = file
  if (file.size > 1024 * 1024) {
    try {
      uploadFile = await compressImage(file, 0.7, 1200)
    } catch {
      uploadFile = file // fallback to original
    }
  }

  await uploadBytes(storageRef, uploadFile)
  const url = await getDownloadURL(storageRef)

  return {
    url,
    storagePath,
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
