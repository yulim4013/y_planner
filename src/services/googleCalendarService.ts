import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { CalendarEvent, Task } from '../types'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

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

// --- Public API ---

const CF_BASE = 'https://asia-northeast3-y-diary.cloudfunctions.net'
const SHORTCUT_SECRET = 'kXllqPQXmKTV6upnTuA_dPZujYKuwsQ2MAm97dlxSkA'

async function syncViaCloudFunction(type: 'event' | 'task', data: Record<string, unknown>) {
  const settings = await getCalendarSettings()
  if (!settings.enabled) return

  try {
    await fetch(`${CF_BASE}/syncItemToGcal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-secret': SHORTCUT_SECRET },
      body: JSON.stringify({ type, ...data }),
    })
  } catch (e) {
    console.error('GCal 동기화 실패:', e)
  }
}

function formatDateStr(ts: { toDate: () => Date }) {
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function syncEventToGcal(event: CalendarEvent) {
  await syncViaCloudFunction('event', {
    id: event.id,
    title: event.title,
    startDate: formatDateStr(event.startDate),
    endDate: formatDateStr(event.endDate),
    startTime: event.startTime,
    endTime: event.endTime,
    isAllDay: event.isAllDay,
    categoryId: event.categoryId,
    repeat: event.repeat,
    repeatEndDate: event.repeatEndDate ? formatDateStr(event.repeatEndDate) : null,
    reminder: event.reminder,
    description: event.description,
    location: event.location,
  })
}

export async function syncTaskToGcal(task: Task) {
  if (!task.dueDate) return
  await syncViaCloudFunction('task', {
    id: task.id,
    title: task.title,
    startDate: formatDateStr(task.dueDate),
    startTime: task.dueTime,
    categoryId: task.categoryId,
    repeat: task.repeat,
    repeatEndDate: task.repeatEndDate ? formatDateStr(task.repeatEndDate) : null,
    reminder: task.reminder,
    description: task.description,
  })
}

async function deleteViaCloudFunction(type: 'event' | 'task', id: string) {
  const settings = await getCalendarSettings()
  if (!settings.enabled) return

  try {
    await fetch(`${CF_BASE}/deleteItem`, {
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
