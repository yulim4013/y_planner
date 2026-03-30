import {
  collection,
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

// 특정 날짜 기준으로 전날 밤 수면~오늘 아침 기상 기록 구독
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

// date+time 문자열 기반으로 분 단위 시각 계산 (timestamp 의존 X)
function toAbsoluteMinutes(date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, m] = time.split(':').map(Number)
  // 날짜를 일수로 변환 (간단 계산)
  const days = y * 365 + mo * 31 + d
  return days * 24 * 60 + h * 60 + m
}

// 수면 시간 계산: 가장 최근 sleep→wake 쌍
export function calculateSleepDuration(
  records: SleepRecord[],
  todayDate: string,
): { sleepTime: string | null; wakeTime: string | null; durationMin: number } {
  // 당일 wake 중 가장 최근 것
  const wakeRecords = records
    .filter((r) => r.type === 'wake' && r.date === todayDate && r.time)
    .sort((a, b) => toAbsoluteMinutes(b.date, b.time) - toAbsoluteMinutes(a.date, a.time))
  const wakeRecord = wakeRecords[0]

  // 전날~당일 sleep 중 가장 최근 것 (wake보다 이전이어야 함)
  const sleepRecords = records
    .filter((r) => r.type === 'sleep' && r.time)
    .sort((a, b) => toAbsoluteMinutes(b.date, b.time) - toAbsoluteMinutes(a.date, a.time))
  const sleepRecord = wakeRecord
    ? sleepRecords.find((r) => toAbsoluteMinutes(r.date, r.time) < toAbsoluteMinutes(wakeRecord.date, wakeRecord.time))
    : sleepRecords[0]

  if (!sleepRecord || !wakeRecord) {
    return { sleepTime: null, wakeTime: null, durationMin: 0 }
  }

  const durationMin = toAbsoluteMinutes(wakeRecord.date, wakeRecord.time) - toAbsoluteMinutes(sleepRecord.date, sleepRecord.time)

  const [sh, sm] = sleepRecord.time.split(':').map(Number)
  const [wh, wm] = wakeRecord.time.split(':').map(Number)

  return {
    sleepTime: formatTimeKorean(sh, sm),
    wakeTime: formatTimeKorean(wh, wm),
    durationMin: Math.max(0, durationMin),
  }
}
