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
import { syncEventToGcal, deleteEventFromGcal } from './googleCalendarService'

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
  reminder?: number | null
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  repeatEndDate?: Date | null
}) {
  const ref = getEventsRef()
  if (!ref) return null

  const now = Timestamp.now()
  const docRef = await addDoc(ref, {
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
    repeatEndDate: data.repeatEndDate ? Timestamp.fromDate(data.repeatEndDate) : null,
    reminder: data.reminder ?? null,
    createdAt: now,
    updatedAt: now,
  })

  // Google Calendar 동기화 (백그라운드)
  syncEventToGcal({
    id: docRef.id,
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
    repeatEndDate: data.repeatEndDate ? Timestamp.fromDate(data.repeatEndDate) : null,
    reminder: data.reminder ?? null,
    createdAt: now,
    updatedAt: now,
  }).catch((e) => console.error('GCal 동기화 실패:', e))

  return docRef
}

export async function updateEvent(eventId: string, data: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) {
  const ref = getEventsRef()
  if (!ref) return

  const eventDoc = doc(ref, eventId)
  await updateDoc(eventDoc, {
    ...data,
    updatedAt: Timestamp.now(),
  })

  // Google Calendar 동기화 (백그라운드) - 전체 이벤트를 다시 읽어서 동기화
  const { getDoc: getDocument } = await import('firebase/firestore')
  getDocument(eventDoc).then((snap) => {
    if (snap.exists()) {
      syncEventToGcal({ id: snap.id, ...snap.data() } as CalendarEvent)
    }
  }).catch((e) => console.error('GCal 동기화 실패:', e))
}

export async function deleteEvent(eventId: string) {
  const ref = getEventsRef()
  if (!ref) return

  // Google Calendar에서도 삭제 (백그라운드)
  deleteEventFromGcal(eventId).catch((e) => console.error('GCal 삭제 실패:', e))

  await deleteDoc(doc(ref, eventId))
}
