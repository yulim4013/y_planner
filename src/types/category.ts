import { Timestamp } from 'firebase/firestore'

export interface Category {
  id: string
  name: string
  color: string
  icon: string
  type: 'task' | 'event' | 'expense' | 'all'
  eventCategoryId: string | null    // Task 카테고리의 상위 일정 카테고리 ID
  order: number
  createdAt: Timestamp
}
