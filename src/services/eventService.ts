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
import type { CalendarEvent } from '../types'

function getEventsRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'events')
}

export function subscribeEvents(callback: (events: CalendarEvent[]) => void) {
  const ref = getEventsRef()
  if (!ref) {
    callback([])
    return () => {}
  }
  const q = query(ref, orderBy('startDate', 'asc'))
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as CalendarEvent[]
    callback(events)
  })
}

export async function addEvent(data: {
  title: string
  description?: string
  startDate: Date
  endDate: Date
  startTime?: string | null
  endTime?: string | null
  isAllDay?: boolean
  categoryId?: string | null
  location?: string
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
}) {
  const ref = getEventsRef()
  if (!ref) return null

  const now = Timestamp.now()
  return addDoc(ref, {
    title: data.title,
    description: data.description || '',
    startDate: Timestamp.fromDate(data.startDate),
    endDate: Timestamp.fromDate(data.endDate),
    startTime: data.startTime || null,
    endTime: data.endTime || null,
    isAllDay: data.isAllDay ?? true,
    categoryId: data.categoryId || null,
    location: data.location || '',
    repeat: data.repeat || 'none',
    reminder: null,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateEvent(eventId: string, data: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) {
  const ref = getEventsRef()
  if (!ref) return

  const eventDoc = doc(ref, eventId)
  await updateDoc(eventDoc, {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function deleteEvent(eventId: string) {
  const ref = getEventsRef()
  if (!ref) return

  await deleteDoc(doc(ref, eventId))
}
