import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { SleepRecord } from '../types'

function getSleepRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'sleepRecords')
}

export function subscribeSleepForDate(
  date: string,
  callback: (records: SleepRecord[]) => void,
) {
  const ref = getSleepRef()
  if (!ref) {
    callback([])
    return () => {}
  }

  const [y, m, d] = date.split('-').map(Number)
  const prevDate = new Date(y, m - 1, d - 1)
  const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`
  const targetDates = new Set([prevDateStr, date])

  return onSnapshot(ref,
    (snapshot) => {
      const records = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as SleepRecord))
        .filter((r) => targetDates.has(r.date))
      callback(records)
    },
    (error) => {
      console.error('수면 기록 구독 에러:', error)
      callback([])
    },
  )
}

function formatTimeKorean(h: number, m: number): string {
  const mm = String(m).padStart(2, '0')
  if (h < 12) return `오전 ${h === 0 ? 12 : h}:${mm}`
  return `오후 ${h === 12 ? 12 : h - 12}:${mm}`
}

function toAbsoluteMinutes(date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, m] = time.split(':').map(Number)
  const days = y * 365 + mo * 31 + d
  return days * 24 * 60 + h * 60 + m
}

export interface SleepDurationResult {
  sleepTime: string | null
  wakeTime: string | null
  durationMin: number
  sleepRecord: SleepRecord | null
  wakeRecord: SleepRecord | null
}

export async function deleteSleepRecord(id: string) {
  const ref = getSleepRef()
  if (!ref) return
  await deleteDoc(doc(ref, id))
}

export function calculateSleepDuration(
  records: SleepRecord[],
  todayDate: string,
): SleepDurationResult {
  const wakeRecs = records
    .filter((r) => r.type === 'wake' && r.date === todayDate && r.time)
    .sort((a, b) => toAbsoluteMinutes(b.date, b.time) - toAbsoluteMinutes(a.date, a.time))
  const wakeRecord = wakeRecs[0] || null

  const sleepRecs = records
    .filter((r) => r.type === 'sleep' && r.time)
    .sort((a, b) => toAbsoluteMinutes(b.date, b.time) - toAbsoluteMinutes(a.date, a.time))
  const sleepRecord = wakeRecord
    ? sleepRecs.find((r) => toAbsoluteMinutes(r.date, r.time) < toAbsoluteMinutes(wakeRecord.date, wakeRecord.time)) || null
    : null

  if (!sleepRecord || !wakeRecord) {
    return { sleepTime: null, wakeTime: null, durationMin: 0, sleepRecord: null, wakeRecord: null }
  }

  const durationMin = toAbsoluteMinutes(wakeRecord.date, wakeRecord.time) - toAbsoluteMinutes(sleepRecord.date, sleepRecord.time)
  const [sh, sm] = sleepRecord.time.split(':').map(Number)
  const [wh, wm] = wakeRecord.time.split(':').map(Number)

  return {
    sleepTime: formatTimeKorean(sh, sm),
    wakeTime: formatTimeKorean(wh, wm),
    durationMin: Math.max(0, durationMin),
    sleepRecord,
    wakeRecord,
  }
}
