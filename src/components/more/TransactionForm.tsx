import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import BottomSheet from '../common/BottomSheet'
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
} from '../../services/budgetService'
import { subscribeAccounts } from '../../services/accountService'
import {
  INCOME_CATEGORIES,
  FIXED_EXPENSE_CATEGORIES,
  VARIABLE_EXPENSE_CATEGORIES,
} from '../../utils/constants'
import type { Transaction, TransactionType, ExpenseSubType, Account } from '../../types'
import './TransactionForm.css'

interface TransactionFormProps {
  isOpen: boolean
  onClose: () => void
  editTxn?: Transaction | null
  defaultDate?: Date
}

export default function TransactionForm({
  isOpen,
  onClose,
  editTxn,
  defaultDate,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('expense')
  const [subType, setSubType] = useState<ExpenseSubType>('variable')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [date, setDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])

  useEffect(() => {
    const unsub = subscribeAccounts(setAccounts)
    return unsub
  }, [])

  useEffect(() => {
    if (editTxn) {
      setType(editTxn.type)
      setSubType(editTxn.subType || 'variable')
      setCategory(editTxn.category)
      setAmount(String(editTxn.amount))
      setMemo(editTxn.memo)
      setDate(formatDateInput(editTxn.date.toDate()))
      setPaymentMethod(editTxn.paymentMethod || '')
      setFromAccount(editTxn.fromAccount || '')
      setToAccount(editTxn.toAccount || '')
    } else {
      resetForm()
    }
  }, [editTxn, isOpen])

  function resetForm() {
    setType('expense')
    setSubType('variable')
    setCategory('')
    setAmount('')
    setMemo('')
    setDate(formatDateInput(defaultDate || new Date()))
    setPaymentMethod('')
    setFromAccount('')
    setToAccount('')
  }

  function formatDateInput(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const getCategoryList = () => {
    if (type === 'income') return INCOME_CATEGORIES
    if (type === 'transfer') return []
    if (subType === 'fixed') return FIXED_EXPENSE_CATEGORIES
    return VARIABLE_EXPENSE_CATEGORIES
  }

  const handleSubmit = async () => {
    const amt = Number(amount)
    if (type === 'transfer') {
      if (!fromAccount || !toAccount || !amt || amt <= 0) return
    } else {
      if (!category || !amt || amt <= 0) return
    }

    const data = {
      type,
      subType: type === 'expense' ? subType : null,
      category: type === 'transfer' ? '이체' : category,
      amount: amt,
      memo: memo.trim(),
      date: new Date(date + 'T00:00:00'),
      paymentMethod: type === 'expense' ? (paymentMethod || null) : null,
      fromAccount: type === 'transfer' ? fromAccount : null,
      toAccount: type === 'transfer' ? toAccount : type === 'income' ? (toAccount || null) : null,
    }

    if (editTxn) {
      await updateTransaction(editTxn.id, {
        ...data,
        date: Timestamp.fromDate(data.date),
      })
    } else {
      await addTransaction(data)
    }

    resetForm()
    onClose()
  }

  const handleDelete = async () => {
    if (!editTxn) return
    if (confirm('이 거래를 삭제하시겠습니까?')) {
      await deleteTransaction(editTxn.id)
      onClose()
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={editTxn ? '거래 수정' : '거래 추가'}
    >
      <div className="txn-form">
        {/* 수입/지출/이체 토글 */}
        <div className="txn-type-toggle">
          <button
            className={`txn-type-btn ${type === 'income' ? 'active income' : ''}`}
            onClick={() => { setType('income'); setCategory('') }}
            type="button"
          >수입</button>
          <button
            className={`txn-type-btn ${type === 'expense' ? 'active expense' : ''}`}
            onClick={() => { setType('expense'); setCategory('') }}
            type="button"
          >지출</button>
          <button
            className={`txn-type-btn ${type === 'transfer' ? 'active transfer' : ''}`}
            onClick={() => { setType('transfer'); setCategory('이체') }}
            type="button"
          >이체</button>
        </div>

        {/* 고정/변동 토글 (지출일 때만) */}
        {type === 'expense' && (
          <div className="txn-subtype-toggle">
            <button
              className={`txn-sub-btn ${subType === 'fixed' ? 'active' : ''}`}
              onClick={() => { setSubType('fixed'); setCategory('') }}
              type="button"
            >고정지출</button>
            <button
              className={`txn-sub-btn ${subType === 'variable' ? 'active' : ''}`}
              onClick={() => { setSubType('variable'); setCategory('') }}
              type="button"
            >변동지출</button>
          </div>
        )}

        {/* 이체: 계좌 선택 */}
        {type === 'transfer' && (
          <div className="txn-transfer-section">
            <div className="txn-account-row">
              <label className="txn-label">출금 계좌</label>
              <select
                className="txn-select"
                value={fromAccount}
                onChange={(e) => setFromAccount(e.target.value)}
              >
                <option value="">선택</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.name}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>
            <div className="txn-transfer-arrow">↓</div>
            <div className="txn-account-row">
              <label className="txn-label">입금 계좌</label>
              <select
                className="txn-select"
                value={toAccount}
                onChange={(e) => setToAccount(e.target.value)}
              >
                <option value="">선택</option>
                {accounts.filter((a) => a.name !== fromAccount).map((a) => (
                  <option key={a.id} value={a.name}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 수입: 입금 계좌 선택 */}
        {type === 'income' && accounts.length > 0 && (
          <div className="txn-payment-row">
            <label className="txn-label">입금 계좌</label>
            <select
              className="txn-select"
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
            >
              <option value="">선택 안함</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.name}>{a.icon} {a.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 카테고리 선택 (이체가 아닐 때) */}
        {type !== 'transfer' && (
          <div className="txn-categories">
            {getCategoryList().map((cat) => (
              <button
                key={cat.name}
                className={`txn-cat-btn ${category === cat.name ? 'active' : ''}`}
                style={
                  category === cat.name
                    ? { background: cat.color, borderColor: cat.color }
                    : {}
                }
                onClick={() => setCategory(cat.name)}
                type="button"
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* 금액 */}
        <div className="txn-amount-row">
          <span className="txn-currency">₩</span>
          <input
            className="txn-amount-input"
            type="number"
            inputMode="numeric"
            placeholder="금액"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* 결제수단 (지출일 때만) */}
        {type === 'expense' && accounts.length > 0 && (
          <div className="txn-payment-row">
            <label className="txn-label">결제수단</label>
            <select
              className="txn-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="">선택 안함</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.name}>{a.icon} {a.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 메모 */}
        <input
          className="txn-memo-input"
          placeholder="메모 (선택)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        {/* 날짜 */}
        <input
          className="txn-date-input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {/* 버튼 */}
        <div className="txn-form-actions">
          {editTxn && (
            <button className="txn-form-delete" onClick={handleDelete} type="button">
              삭제
            </button>
          )}
          <button
            className="txn-form-submit"
            onClick={handleSubmit}
            disabled={
              type === 'transfer'
                ? !fromAccount || !toAccount || !amount || Number(amount) <= 0
                : !category || !amount || Number(amount) <= 0
            }
            type="button"
          >
            {editTxn ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
