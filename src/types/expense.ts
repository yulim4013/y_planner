import { Timestamp } from 'firebase/firestore'

export type TransactionType = 'income' | 'expense' | 'transfer'
export type ExpenseSubType = 'fixed' | 'variable'

export interface Transaction {
  id: string
  type: TransactionType
  subType: ExpenseSubType | null
  category: string
  amount: number
  memo: string
  date: Timestamp
  paymentMethod: string | null      // 결제수단 (계좌명/카드명)
  fromAccount: string | null        // 이체 출발 계좌
  toAccount: string | null          // 이체 도착 계좌
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface MonthlyBudget {
  id: string
  budgets: Record<string, number>
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Account {
  id: string
  name: string
  type: 'checking' | 'savings' | 'credit' | 'cash' | 'investment'
  balance: number
  icon: string
  color: string
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
