import { Timestamp } from 'firebase/firestore'

export interface CalendarEvent {
  id: string
  title: string
  description: string
  startDate: Timestamp
  endDate: Timestamp
  startTime: string | null
  endTime: string | null
  isAllDay: boolean
  categoryId: string | null
  location: string
  repeat: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  repeatEndDate: Timestamp | null
  reminder: number | null
  createdAt: Timestamp
  updatedAt: Timestamp
}
