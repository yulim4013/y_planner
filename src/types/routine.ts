import type { Timestamp } from 'firebase/firestore'

export interface RoutineIcon {
  id: string
  label: string
  svg: string
}

export interface RoutineTemplate {
  id: string
  iconId: string
  title: string
  order: number
  startDate: string    // 'YYYY-MM-DD'
  endDate: string      // 'YYYY-MM-DD'
  targetMl?: number    // 물 마시기 목표 (ml)
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Routine {
  id: string
  templateId: string   // links to template
  iconId: string
  title: string
  isCompleted: boolean
  date: string         // 'YYYY-MM-DD'
  order: number
  checkedAt: Timestamp | null   // 체크한 실제 시간
  targetMl?: number    // 물 마시기 목표 (ml)
  currentMl?: number   // 물 마시기 현재 (ml)
  createdAt: Timestamp
  updatedAt: Timestamp
}
