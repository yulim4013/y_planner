import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { Category } from '../types'

function getCategoriesRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'categories')
}

export function subscribeCategories(callback: (cats: Category[]) => void) {
  const ref = getCategoriesRef()
  if (!ref) {
    callback([])
    return () => {}
  }
  // orderBy 없이 전체 조회 후 클라이언트 정렬 (order 필드 누락 문서 누락 방지)
  return onSnapshot(ref, (snapshot) => {
    const cats = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Category[]
    cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    callback(cats)
  })
}

export function subscribeCategoriesByType(type: 'task' | 'event' | 'expense', callback: (cats: Category[]) => void) {
  const ref = getCategoriesRef()
  if (!ref) {
    callback([])
    return () => {}
  }
  return onSnapshot(ref, (snapshot) => {
    const all = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Category[]
    const filtered = all.filter((c) => c.type === type || c.type === 'all')
    filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    callback(filtered)
  })
}

export async function addCategory(data: {
  name: string
  color: string
  icon: string
  type: 'task' | 'event' | 'expense' | 'all'
  order?: number
  eventCategoryId?: string | null
}) {
  const ref = getCategoriesRef()
  if (!ref) return null

  return addDoc(ref, {
    name: data.name,
    color: data.color,
    icon: data.icon,
    type: data.type,
    eventCategoryId: data.eventCategoryId || null,
    order: data.order ?? 0,
    createdAt: Timestamp.now(),
  })
}

export async function updateCategory(catId: string, data: Partial<Omit<Category, 'id' | 'createdAt'>>) {
  const ref = getCategoriesRef()
  if (!ref) return

  await updateDoc(doc(ref, catId), data)
}

export async function deleteCategory(catId: string) {
  const ref = getCategoriesRef()
  if (!ref) return

  await deleteDoc(doc(ref, catId))
}
