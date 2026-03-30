import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { Routine, RoutineTemplate } from '../types'

function getRoutinesRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'routines')
}

function getTemplatesRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'routineTemplates')
}

// 루틴 템플릿 추가 (시작일~종료일)
export async function addRoutineTemplate(data: {
  iconId: string
  title: string
  order: number
  startDate: string
  endDate: string
  targetMl?: number
}) {
  const ref = getTemplatesRef()
  if (!ref) return null

  const now = Timestamp.now()
  return addDoc(ref, {
    iconId: data.iconId,
    title: data.title,
    order: data.order,
    startDate: data.startDate,
    endDate: data.endDate,
    targetMl: data.targetMl || null,
    createdAt: now,
    updatedAt: now,
  })
}

// 루틴 템플릿 삭제
export async function deleteRoutineTemplate(templateId: string) {
  const ref = getTemplatesRef()
  if (!ref) return
  await deleteDoc(doc(ref, templateId))
}

// 특정 날짜의 활성 템플릿 조회
export function subscribeActiveTemplates(callback: (templates: RoutineTemplate[]) => void) {
  const ref = getTemplatesRef()
  if (!ref) {
    callback([])
    return () => {}
  }

  const q = query(ref, orderBy('order', 'asc'))
  return onSnapshot(q, (snapshot) => {
    const templates = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as RoutineTemplate[]
    callback(templates)
  })
}

// 특정 날짜의 루틴 인스턴스 구독 + 템플릿 기반 자동 생성
export function subscribeRoutinesByDate(date: string, callback: (routines: Routine[]) => void) {
  const routinesRef = getRoutinesRef()
  const templatesRef = getTemplatesRef()
  if (!routinesRef || !templatesRef) {
    callback([])
    return () => {}
  }

  const q = query(routinesRef, where('date', '==', date), orderBy('order', 'asc'))

  // 템플릿에서 누락된 인스턴스 자동 생성 (한번만 실행)
  ;(async () => {
    try {
      const [routinesSnap, templatesSnap] = await Promise.all([
        getDocs(q),
        getDocs(query(templatesRef, orderBy('order', 'asc'))),
      ])
      const existingTemplateIds = new Set(routinesSnap.docs.map((d) => d.data().templateId))
      const templates = templatesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as RoutineTemplate[]
      const activeTemplates = templates.filter((t) => t.startDate <= date && t.endDate >= date)
      const now = Timestamp.now()

      for (const tmpl of activeTemplates) {
        if (!existingTemplateIds.has(tmpl.id)) {
          const routineData: Record<string, unknown> = {
            templateId: tmpl.id,
            iconId: tmpl.iconId,
            title: tmpl.title,
            isCompleted: false,
            date,
            order: tmpl.order,
            checkedAt: null,
            createdAt: now,
            updatedAt: now,
          }
          if (tmpl.targetMl) {
            routineData.targetMl = tmpl.targetMl
            routineData.currentMl = 0
          }
          await addDoc(routinesRef, routineData)
        }
      }
    } catch (err) {
      console.warn('템플릿 동기화 실패:', err)
    }
  })()

  // 실시간 리스너 (sync callback — 항상 최신 데이터 전달)
  return onSnapshot(q, (snapshot) => {
    const routines = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Routine[]
    callback(routines)
  })
}

// 루틴 인스턴스 직접 추가 (templateId 연결 가능)
export async function addRoutine(data: {
  iconId: string
  title: string
  date: string
  order: number
  targetMl?: number
  templateId?: string
}) {
  const ref = getRoutinesRef()
  if (!ref) return null

  const now = Timestamp.now()
  const routineData: Record<string, unknown> = {
    templateId: data.templateId || '',
    iconId: data.iconId,
    title: data.title,
    isCompleted: false,
    date: data.date,
    order: data.order,
    checkedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  if (data.targetMl) {
    routineData.targetMl = data.targetMl
    routineData.currentMl = 0
  }
  return addDoc(ref, routineData)
}

export async function toggleRoutineComplete(routineId: string, currentCompleted: boolean) {
  const ref = getRoutinesRef()
  if (!ref) return

  const willComplete = !currentCompleted
  await updateDoc(doc(ref, routineId), {
    isCompleted: willComplete,
    checkedAt: willComplete ? Timestamp.now() : null,
    updatedAt: Timestamp.now(),
  })
}

export async function incrementWater(routineId: string, currentMl: number, targetMl: number) {
  const ref = getRoutinesRef()
  if (!ref) return

  const newMl = currentMl + 250
  const isComplete = newMl >= targetMl
  await updateDoc(doc(ref, routineId), {
    currentMl: newMl,
    isCompleted: isComplete,
    checkedAt: isComplete ? Timestamp.now() : null,
    updatedAt: Timestamp.now(),
  })
}

export async function decrementWater(routineId: string, currentMl: number) {
  const ref = getRoutinesRef()
  if (!ref) return

  const newMl = Math.max(0, currentMl - 250)
  await updateDoc(doc(ref, routineId), {
    currentMl: newMl,
    isCompleted: false,
    checkedAt: null,
    updatedAt: Timestamp.now(),
  })
}

export async function updateRoutineOrder(routineId: string, newOrder: number) {
  const ref = getRoutinesRef()
  if (!ref) return
  await updateDoc(doc(ref, routineId), { order: newOrder, updatedAt: Timestamp.now() })
}

export async function deleteRoutine(routineId: string) {
  const ref = getRoutinesRef()
  if (!ref) return
  await deleteDoc(doc(ref, routineId))
}
