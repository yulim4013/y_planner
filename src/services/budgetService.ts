import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'
import { adjustAccountBalance } from './accountService'
import type { Transaction, MonthlyBudget, TransactionType, ExpenseSubType } from '../types'

function getTransactionsRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'transactions')
}

function getBudgetsRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return collection(db, 'users', uid, 'budgets')
}

export function subscribeTransactionsByMonth(
  yearMonth: string,
  callback: (txns: Transaction[]) => void,
) {
  const ref = getTransactionsRef()
  if (!ref) {
    callback([])
    return () => {}
  }

  const [year, month] = yearMonth.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59, 999)

  const q = query(
    ref,
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<=', Timestamp.fromDate(end)),
    orderBy('date', 'desc'),
  )

  return onSnapshot(q, (snapshot) => {
    const txns = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Transaction[]
    callback(txns)
  })
}

export async function addTransaction(data: {
  type: TransactionType
  subType: ExpenseSubType | null
  category: string
  amount: number
  memo: string
  date: Date
  paymentMethod?: string | null
  fromAccount?: string | null
  toAccount?: string | null
}) {
  const ref = getTransactionsRef()
  if (!ref) return null

  const now = Timestamp.now()
  const result = await addDoc(ref, {
    type: data.type,
    subType: data.subType,
    category: data.category,
    amount: data.amount,
    memo: data.memo,
    date: Timestamp.fromDate(data.date),
    paymentMethod: data.paymentMethod || null,
    fromAccount: data.fromAccount || null,
    toAccount: data.toAccount || null,
    createdAt: now,
    updatedAt: now,
  })

  // 계좌 잔액 반영
  if (data.type === 'expense' && data.paymentMethod) {
    await adjustAccountBalance(data.paymentMethod, -data.amount)
  } else if (data.type === 'transfer' && data.fromAccount && data.toAccount) {
    await adjustAccountBalance(data.fromAccount, -data.amount)
    await adjustAccountBalance(data.toAccount, data.amount)
  } else if (data.type === 'income' && data.toAccount) {
    await adjustAccountBalance(data.toAccount, data.amount)
  }

  return result
}

export async function updateTransaction(
  id: string,
  data: Partial<Omit<Transaction, 'id' | 'createdAt'>>,
) {
  const ref = getTransactionsRef()
  if (!ref) return
  await updateDoc(doc(ref, id), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function deleteTransaction(id: string) {
  const ref = getTransactionsRef()
  if (!ref) return
  await deleteDoc(doc(ref, id))
}

export function subscribeMonthlyBudget(
  yearMonth: string,
  callback: (budget: MonthlyBudget | null) => void,
) {
  const ref = getBudgetsRef()
  if (!ref) {
    callback(null)
    return () => {}
  }

  return onSnapshot(doc(ref, yearMonth), (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as MonthlyBudget)
    } else {
      callback(null)
    }
  })
}

export async function setMonthlyBudget(
  yearMonth: string,
  budgets: Record<string, number>,
) {
  const ref = getBudgetsRef()
  if (!ref) return

  const now = Timestamp.now()
  await setDoc(
    doc(ref, yearMonth),
    { budgets, createdAt: now, updatedAt: now },
    { merge: true },
  )
}
