import { Timestamp } from 'firebase/firestore'

export interface Project {
  id: string
  name: string
  color: string
  icon: string
  order: number
  isArchived: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface SubItem {
  id: string
  text: string
  isCompleted: boolean
  order: number
}

export interface Task {
  id: string
  title: string
  description: string
  projectId: string | null
  priority: 'high' | 'medium' | 'low'
  status: 'todo' | 'in_progress' | 'done'
  dueDate: Timestamp | null
  dueTime: string | null
  categoryId: string | null
  subItems: SubItem[]
  isCompleted: boolean
  completedAt: Timestamp | null
  completedTime: string | null     // 'HH:mm' - 실제 완료된 시간
  createdAt: Timestamp
  updatedAt: Timestamp
}
