import {
  collection,
  query,
  where,
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

  // date(YYYY-MM-DD) 기준으로 전날과 당일 수면 기록 조회
  const [y, m, d] = date.split('-').map(Number)
  const prevDate = new Date(y, m - 1, d - 1)
  const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`

  // composite index 불필요하도록 orderBy 제거, 클라이언트 정렬
  const q = query(
    ref,
    where('date', 'in', [prevDateStr, date]),
  )

  return onSnapshot(q,
    (snapshot) => {
      const records = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SleepRecord[]
      // 클라이언트에서 timestamp 기준 정렬
      records.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis())
      callback(records)
    },
    (error) => {
      console.error('수면 기록 구독 에러:', error)
      callback([])
    },
  )
}

// 수면 시간 계산: 마지막 sleep -> 첫 wake 쌍 찾기
export function calculateSleepDuration(
  records: SleepRecord[],
  todayDate: string,
): { sleepTime: string | null; wakeTime: string | null; durationMin: number } {
  // 전날 밤 sleep 찾기
  const sleepRecord = [...records]
    .reverse()
    .find((r) => r.type === 'sleep')

  // 당일 wake 찾기
  const wakeRecord = records.find(
    (r) => r.type === 'wake' && r.date === todayDate,
  )

  if (!sleepRecord || !wakeRecord) {
    return { sleepTime: null, wakeTime: null, durationMin: 0 }
  }

  const sleepTs = sleepRecord.timestamp.toDate()
  const wakeTs = wakeRecord.timestamp.toDate()
  const durationMin = Math.round((wakeTs.getTime() - sleepTs.getTime()) / 60000)

  const formatTime = (d: Date) => {
    const h = d.getHours()
    const m = String(d.getMinutes()).padStart(2, '0')
    if (h < 12) return `오전 ${h === 0 ? 12 : h}:${m}`
    return `오후 ${h === 12 ? 12 : h - 12}:${m}`
  }

  return {
    sleepTime: formatTime(sleepTs),
    wakeTime: formatTime(wakeTs),
    durationMin: Math.max(0, durationMin),
  }
}
