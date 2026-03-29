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
  getDocs,
  where,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import type { Account } from '../types'

function getAccountsRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'accounts')
}

export function subscribeAccounts(callback: (accounts: Account[]) => void) {
  const ref = getAccountsRef()
  if (!ref) {
    callback([])
    return () => {}
  }
  const q = query(ref, orderBy('order', 'asc'))
  return onSnapshot(q, (snapshot) => {
    const accounts = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Account[]
    callback(accounts)
  })
}

export async function addAccount(data: {
  name: string
  type: Account['type']
  balance: number
  icon: string
  color: string
  order: number
}) {
  const ref = getAccountsRef()
  if (!ref) return null

  const now = Timestamp.now()
  return addDoc(ref, {
    ...data,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateAccount(id: string, data: Partial<Omit<Account, 'id' | 'createdAt'>>) {
  const ref = getAccountsRef()
  if (!ref) return
  await updateDoc(doc(ref, id), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function deleteAccount(id: string) {
  const ref = getAccountsRef()
  if (!ref) return
  await deleteDoc(doc(ref, id))
}

// 계좌 잔액 업데이트 (이름으로 찾아서 금액 변경)
export async function adjustAccountBalance(accountName: string, amount: number) {
  const ref = getAccountsRef()
  if (!ref) return
  const q = query(ref, where('name', '==', accountName))
  const snapshot = await getDocs(q)
  if (snapshot.empty) return
  const accountDoc = snapshot.docs[0]
  const currentBalance = (accountDoc.data().balance as number) || 0
  await updateDoc(doc(ref, accountDoc.id), {
    balance: currentBalance + amount,
    updatedAt: Timestamp.now(),
  })
}
