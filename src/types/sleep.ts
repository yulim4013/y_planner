import type { Timestamp } from 'firebase/firestore'

export interface SleepRecord {
  id: string
  type: 'sleep' | 'wake'
  timestamp: Timestamp
  date: string          // 'YYYY-MM-DD'
  time: string          // 'HH:MM'
  hour: number
  minute: number
  createdAt: Timestamp
}
