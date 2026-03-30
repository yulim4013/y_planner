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
import { db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { DiaryEntry, Mood } from '../types'

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

export async function addDiaryEntry(data: {
  date: Date
  mood: Mood | null
  content: string
  tasksSummary?: string[]
  eventsSummary?: string[]
}) {
  const ref = getDiaryRef()
  if (!ref) return null

  const now = Timestamp.now()
  // Normalize date to start of day
  const normalized = new Date(data.date)
  normalized.setHours(0, 0, 0, 0)

  return addDoc(ref, {
    date: Timestamp.fromDate(normalized),
    content: data.content,
    mood: data.mood,
    photos: [],
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
