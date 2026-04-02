import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { Task } from '../types'
import { syncTaskToGcal, deleteTaskFromGcal } from './googleCalendarService'

function getTasksRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'tasks')
}

export function subscribeTasks(callback: (tasks: Task[]) => void) {
  const ref = getTasksRef()
  if (!ref) {
    callback([])
    return () => {}
  }
  const q = query(ref, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Task[]
    callback(tasks)
  })
}

export function subscribeTodayTasks(callback: (tasks: Task[]) => void) {
  const ref = getTasksRef()
  if (!ref) {
    callback([])
    return () => {}
  }
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const q = query(
    ref,
    where('dueDate', '>=', Timestamp.fromDate(todayStart)),
    where('dueDate', '<=', Timestamp.fromDate(todayEnd)),
  )
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Task[]
    callback(tasks)
  })
}

export async function addTask(data: {
  title: string
  description?: string
  priority?: 'high' | 'medium' | 'low'
  dueDate?: Date | null
  dueTime?: string | null
  categoryId?: string | null
  projectId?: string | null
  reminder?: number | null
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  repeatEndDate?: Date | null
  subItems?: { id: string; text: string; isCompleted: boolean; order: number }[]
}) {
  const ref = getTasksRef()
  if (!ref) return null

  const now = Timestamp.now()
  const docData = {
    title: data.title,
    description: data.description || '',
    projectId: data.projectId || null,
    priority: data.priority || 'medium',
    status: 'todo' as const,
    dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
    dueTime: data.dueTime || null,
    categoryId: data.categoryId || null,
    reminder: data.reminder ?? null,
    repeat: data.repeat || 'none',
    repeatEndDate: data.repeatEndDate ? Timestamp.fromDate(data.repeatEndDate) : null,
    subItems: data.subItems || [],
    isCompleted: false,
    completedAt: null,
    completedTime: null,
    createdAt: now,
    updatedAt: now,
  }
  const docRef = await addDoc(ref, docData)

  syncTaskToGcal({ id: docRef.id, ...docData } as Task)
    .catch((e) => console.error('GCal Task 동기화 실패:', e))

  return docRef
}

export async function updateTask(taskId: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>) {
  const ref = getTasksRef()
  if (!ref) return

  const taskDoc = doc(ref, taskId)
  await updateDoc(taskDoc, {
    ...data,
    updatedAt: Timestamp.now(),
  })

  const { getDoc: getDocument } = await import('firebase/firestore')
  getDocument(taskDoc).then((snap) => {
    if (snap.exists()) {
      syncTaskToGcal({ id: snap.id, ...snap.data() } as Task)
    }
  }).catch((e) => console.error('GCal Task 동기화 실패:', e))
}

export async function toggleTaskComplete(taskId: string, isCompleted: boolean, hasDueDate: boolean, hasDueTime: boolean = false) {
  const ref = getTasksRef()
  if (!ref) return

  const willComplete = !isCompleted
  const now = Timestamp.now()
  const nowDate = now.toDate()
  const completedTime = willComplete
    ? `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`
    : null

  const updates: Record<string, unknown> = {
    isCompleted: willComplete,
    status: willComplete ? 'done' : 'todo',
    completedAt: willComplete ? now : null,
    completedTime,
    updatedAt: now,
  }

  // 마감일 없이 완료 체크하면 오늘 날짜로 자동 설정
  if (willComplete && !hasDueDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    updates.dueDate = Timestamp.fromDate(today)
  }

  // 시간 미지정 태스크 완료 시 → 완료 시각을 dueTime으로 기록 (종일→시간 슬롯 이동)
  // 시간 지정된 태스크는 원래 dueTime 유지
  if (willComplete && completedTime && !hasDueTime) {
    updates.dueTime = completedTime
  }

  const taskDoc = doc(ref, taskId)
  await updateDoc(taskDoc, updates)
}

export async function toggleSubItem(
  taskId: string,
  subItems: { id: string; text: string; isCompleted: boolean; order: number }[],
  subItemId: string,
  hasDueDate: boolean,
  hasDueTime: boolean = false,
) {
  const ref = getTasksRef()
  if (!ref) return

  const updated = subItems.map((s) =>
    s.id === subItemId ? { ...s, isCompleted: !s.isCompleted } : s
  )
  const allDone = updated.length > 0 && updated.every((s) => s.isCompleted)
  const now = Timestamp.now()

  const updates: Record<string, unknown> = {
    subItems: updated,
    updatedAt: now,
  }

  if (allDone) {
    const nowDate = now.toDate()
    updates.isCompleted = true
    updates.status = 'done'
    updates.completedAt = now
    updates.completedTime = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`
    if (!hasDueDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      updates.dueDate = Timestamp.fromDate(today)
    }
    // 시간 미지정 태스크 → 완료 시각을 dueTime으로 기록
    // 시간 지정된 태스크는 원래 dueTime 유지
    if (!hasDueTime) {
      updates.dueTime = updates.completedTime
    }
  } else {
    // 체크리스트 항목 하나라도 해제하면 task도 미완료로
    updates.isCompleted = false
    updates.status = 'todo'
    updates.completedAt = null
    updates.completedTime = null
  }

  const taskDoc = doc(ref, taskId)
  await updateDoc(taskDoc, updates)
}

export async function deleteTask(taskId: string) {
  const ref = getTasksRef()
  if (!ref) return

  deleteTaskFromGcal(taskId).catch((e) => console.error('GCal Task 삭제 실패:', e))
  await deleteDoc(doc(ref, taskId))
}
