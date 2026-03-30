import { Timestamp } from 'firebase/firestore'

export interface DiaryPhoto {
  url: string
  storagePath: string
  caption: string
  uploadedAt: Timestamp
}

export type Mood = 'great' | 'good' | 'okay' | 'bad' | 'terrible'

export interface DiaryEntry {
  id: string
  date: Timestamp
  content: string
  mood: Mood | null
  photos: DiaryPhoto[]
  links: string[]
  tasksSummary: string[]
  eventsSummary: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
