import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { CalendarEvent, Task, Category } from '../types'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// --- Token ---

let cachedToken: string | null = null
let tokenExpiry = 0

// silent=true: 캐시된 토큰만 사용 (팝업 안 뜸), false: 팝업으로 새 토큰 요청
export async function getCalendarAccessToken(silent = false): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  if (silent) return null // 캐시 만료 시 자동 동기화에서는 팝업 안 띄움
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

// --- Color Mapping ---
// Google Calendar colorId (1-11) mapped to closest app pastel colors

const COLOR_MAP: Record<string, string> = {
  '#FFD1DC': '4',  // 분홍 → Flamingo
  '#C5D5F5': '9',  // 파랑 → Blueberry
  '#C8E6C9': '2',  // 초록 → Sage
  '#D1C4E9': '1',  // 보라 → Lavender
  '#FFE0B2': '6',  // 주황 → Tangerine
  '#FFF9C4': '5',  // 노랑 → Banana
  '#B2DFDB': '2',  // 민트 → Sage
  '#FFCCBC': '4',  // 복숭아 → Flamingo
  '#E1BEE7': '3',  // 라벤더 → Grape
  '#B3E5FC': '7',  // 하늘 → Peacock
}

function hexToColorId(hex: string | undefined): string | undefined {
  if (!hex) return undefined
  return COLOR_MAP[hex.toUpperCase()] || undefined
}

// 카테고리 캐시
let categoryCache: Map<string, Category> | null = null

async function loadCategories(): Promise<Map<string, Category>> {
  if (categoryCache) return categoryCache
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return new Map()
  const snap = await getDocs(collection(db, 'users', uid, 'categories'))
  categoryCache = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Category]))
  return categoryCache
}

export function clearCategoryCache() {
  categoryCache = null
}

async function getCategoryColor(categoryId: string | null): Promise<string | undefined> {
  if (!categoryId) return undefined
  const cats = await loadCategories()
  return cats.get(categoryId)?.color
}

// --- CalendarEvent -> Google Calendar Event ---

function toGcalEvent(event: CalendarEvent, colorId?: string) {
  const startDate = event.startDate.toDate()
  const endDate = event.endDate.toDate()

  const base: Record<string, unknown> = {
    summary: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    ...(colorId && { colorId }),
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

// --- Task -> Google Calendar Event ---

function taskToGcalEvent(task: Task, colorId?: string) {
  const base: Record<string, unknown> = {
    summary: `[TODO] ${task.title}`,
    description: task.description || undefined,
    ...(colorId && { colorId }),
  }

  if (!task.dueDate) return null // 날짜 없으면 동기화 불가

  const dueDate = task.dueDate.toDate()

  if (!task.dueTime) {
    // 종일 이벤트
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const end = new Date(dueDate)
    end.setDate(end.getDate() + 1)
    base.start = { date: fmt(dueDate) }
    base.end = { date: fmt(end) }
  } else {
    const [h, m] = task.dueTime.split(':')
    const start = new Date(dueDate)
    start.setHours(Number(h), Number(m), 0, 0)
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + 30) // 기본 30분
    base.start = { dateTime: start.toISOString(), timeZone: 'Asia/Seoul' }
    base.end = { dateTime: end.toISOString(), timeZone: 'Asia/Seoul' }
  }

  if (task.repeat !== 'none') {
    const freqMap: Record<string, string> = {
      daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY',
    }
    let rrule = `RRULE:FREQ=${freqMap[task.repeat]}`
    if (task.repeatEndDate) {
      const until = task.repeatEndDate.toDate().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      rrule += `;UNTIL=${until}`
    }
    base.recurrence = [rrule]
  }

  if (task.reminder != null) {
    base.reminders = {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: task.reminder }],
    }
  }

  return base
}

// --- API Calls ---

async function apiCall(method: string, url: string, body?: unknown) {
  const token = await getCalendarAccessToken(true) // silent - 팝업 안 띄움
  if (!token) return null // 토큰 없으면 조용히 스킵

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
  const color = await getCategoryColor(event.categoryId)
  const colorId = hexToColorId(color)
  const gcalBody = toGcalEvent(event, colorId)
  const existingId = await getGcalEventId(event.id)

  if (existingId) {
    await apiCall('PUT', `${CALENDAR_API}/calendars/${calendarId}/events/${existingId}`, gcalBody)
  } else {
    const result = await apiCall('POST', `${CALENDAR_API}/calendars/${calendarId}/events`, gcalBody)
    if (result?.id) {
      await saveGcalEventId(event.id, result.id)
    }
  }
}

export async function syncTaskToGcal(task: Task) {
  const settings = await getCalendarSettings()
  if (!settings.enabled) return

  const calendarId = settings.calendarId || 'primary'
  const color = await getCategoryColor(task.categoryId)
  const colorId = hexToColorId(color)
  const gcalBody = taskToGcalEvent(task, colorId)
  if (!gcalBody) return // dueDate 없으면 스킵

  const taskKey = `task_${task.id}`
  const existingId = await getGcalEventId(taskKey)

  if (existingId) {
    await apiCall('PUT', `${CALENDAR_API}/calendars/${calendarId}/events/${existingId}`, gcalBody)
  } else {
    const result = await apiCall('POST', `${CALENDAR_API}/calendars/${calendarId}/events`, gcalBody)
    if (result?.id) {
      await saveGcalEventId(taskKey, result.id)
    }
  }
}

const DELETE_ITEM_URL = 'https://asia-northeast3-y-diary.cloudfunctions.net/deleteItem'
const SHORTCUT_SECRET = 'kXllqPQXmKTV6upnTuA_dPZujYKuwsQ2MAm97dlxSkA'

async function deleteViaCloudFunction(type: 'event' | 'task', id: string) {
  const settings = await getCalendarSettings()
  if (!settings.enabled) return

  try {
    await fetch(DELETE_ITEM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-secret': SHORTCUT_SECRET },
      body: JSON.stringify({ type, id }),
    })
  } catch (e) {
    console.error('GCal 삭제 실패:', e)
  }
}

export async function deleteTaskFromGcal(taskId: string) {
  await deleteViaCloudFunction('task', taskId)
}

export async function deleteEventFromGcal(eventId: string) {
  await deleteViaCloudFunction('event', eventId)
}

export async function syncAllToGcal(events: CalendarEvent[], tasks: Task[]) {
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
  for (const task of tasks) {
    try {
      await syncTaskToGcal(task)
      successCount++
    } catch (error) {
      console.error(`태스크 동기화 실패 (${task.title}):`, error)
    }
  }
  return successCount
}
