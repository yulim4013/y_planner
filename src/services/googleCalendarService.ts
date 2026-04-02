import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { CalendarEvent } from '../types'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// --- Token ---

let cachedToken: string | null = null
let tokenExpiry = 0

export async function getCalendarAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  if (!auth) return null

  const provider = new GoogleAuthProvider()
  provider.addScope(CALENDAR_SCOPE)

  try {
    const result = await signInWithPopup(auth, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    cachedToken = credential?.accessToken || null
    tokenExpiry = Date.now() + 55 * 60 * 1000 // 55분
    return cachedToken
  } catch (error) {
    console.error('Google Calendar 권한 요청 실패:', error)
    return null
  }
}

// --- Settings (Firestore) ---

function getSettingsRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return doc(db, 'users', uid, 'settings', 'googleCalendar')
}

export async function getCalendarSettings(): Promise<{ enabled: boolean; calendarId: string }> {
  const ref = getSettingsRef()
  if (!ref) return { enabled: false, calendarId: '' }
  const snap = await getDoc(ref)
  if (!snap.exists()) return { enabled: false, calendarId: '' }
  const data = snap.data()
  return { enabled: data.enabled ?? false, calendarId: data.calendarId ?? '' }
}

export async function saveCalendarSettings(settings: { enabled: boolean; calendarId: string }) {
  const ref = getSettingsRef()
  if (!ref) return
  await setDoc(ref, settings, { merge: true })
}

// --- GCal Event ID Mapping ---

function getMappingRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return doc(db, 'users', uid, 'settings', 'gcalMapping')
}

async function getGcalEventId(eventId: string): Promise<string | null> {
  const ref = getMappingRef()
  if (!ref) return null
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data()[eventId] || null : null
}

async function saveGcalEventId(eventId: string, gcalEventId: string) {
  const ref = getMappingRef()
  if (!ref) return
  await setDoc(ref, { [eventId]: gcalEventId }, { merge: true })
}

async function removeGcalEventId(eventId: string) {
  const ref = getMappingRef()
  if (!ref) return
  await setDoc(ref, { [eventId]: deleteField() }, { merge: true })
}

// --- CalendarEvent -> Google Calendar Event ---

function toGcalEvent(event: CalendarEvent) {
  const startDate = event.startDate.toDate()
  const endDate = event.endDate.toDate()

  const base: Record<string, unknown> = {
    summary: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
  }

  if (event.isAllDay) {
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    // Google Calendar의 종일 이벤트 end는 exclusive (다음날)
    const end = new Date(endDate)
    end.setDate(end.getDate() + 1)
    base.start = { date: fmt(startDate) }
    base.end = { date: fmt(end) }
  } else {
    const toDateTime = (d: Date, time: string | null) => {
      if (!time) return d.toISOString()
      const [h, m] = time.split(':')
      const dt = new Date(d)
      dt.setHours(Number(h), Number(m), 0, 0)
      return dt.toISOString()
    }
    base.start = { dateTime: toDateTime(startDate, event.startTime), timeZone: 'Asia/Seoul' }
    base.end = { dateTime: toDateTime(endDate, event.endTime), timeZone: 'Asia/Seoul' }
  }

  // 반복
  if (event.repeat !== 'none') {
    const freqMap: Record<string, string> = {
      daily: 'DAILY',
      weekly: 'WEEKLY',
      monthly: 'MONTHLY',
      yearly: 'YEARLY',
    }
    let rrule = `RRULE:FREQ=${freqMap[event.repeat]}`
    if (event.repeatEndDate) {
      const until = event.repeatEndDate.toDate().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      rrule += `;UNTIL=${until}`
    }
    base.recurrence = [rrule]
  }

  // 리마인더
  if (event.reminder != null) {
    base.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: event.reminder }],
    }
  }

  return base
}

// --- API Calls ---

async function apiCall(method: string, url: string, body?: unknown) {
  const token = await getCalendarAccessToken()
  if (!token) throw new Error('Google Calendar 인증 필요')

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Calendar API 오류: ${res.status} ${err}`)
  }

  if (res.status === 204) return null
  return res.json()
}

// --- Public API ---

export async function syncEventToGcal(event: CalendarEvent) {
  const settings = await getCalendarSettings()
  if (!settings.enabled) return

  const calendarId = settings.calendarId || 'primary'
  const gcalBody = toGcalEvent(event)
  const existingId = await getGcalEventId(event.id)

  if (existingId) {
    // 업데이트
    await apiCall('PUT', `${CALENDAR_API}/calendars/${calendarId}/events/${existingId}`, gcalBody)
  } else {
    // 생성
    const result = await apiCall('POST', `${CALENDAR_API}/calendars/${calendarId}/events`, gcalBody)
    if (result?.id) {
      await saveGcalEventId(event.id, result.id)
    }
  }
}

export async function deleteEventFromGcal(eventId: string) {
  const settings = await getCalendarSettings()
  if (!settings.enabled) return

  const calendarId = settings.calendarId || 'primary'
  const gcalEventId = await getGcalEventId(eventId)
  if (!gcalEventId) return

  try {
    await apiCall('DELETE', `${CALENDAR_API}/calendars/${calendarId}/events/${gcalEventId}`)
  } catch {
    // 이미 삭제된 경우 무시
  }
  await removeGcalEventId(eventId)
}

export async function syncAllEventsToGcal(events: CalendarEvent[]) {
  const settings = await getCalendarSettings()
  if (!settings.enabled) return

  let successCount = 0
  for (const event of events) {
    try {
      await syncEventToGcal(event)
      successCount++
    } catch (error) {
      console.error(`이벤트 동기화 실패 (${event.title}):`, error)
    }
  }
  return successCount
}
