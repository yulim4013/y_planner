import { useState, useEffect } from 'react'
import BottomSheet from '../common/BottomSheet'
import { addAccount, updateAccount, deleteAccount } from '../../services/accountService'
import { PASTEL_COLORS } from '../../utils/constants'
import type { Account } from '../../types'
import './AccountForm.css'

interface AccountFormProps {
  isOpen: boolean
  onClose: () => void
  editAccount?: Account | null
  accountCount: number
}

const ACCOUNT_TYPES: { value: Account['type']; label: string }[] = [
  { value: 'checking', label: '입출금' },
  { value: 'savings', label: '저축' },
  { value: 'credit', label: '신용카드' },
  { value: 'cash', label: '현금' },
  { value: 'investment', label: '투자' },
]

const TYPE_ICONS: Record<string, string> = {
  checking: '🏦',
  savings: '💰',
  credit: '💳',
  cash: '💵',
  investment: '📊',
}

export default function AccountForm({ isOpen, onClose, editAccount, accountCount }: AccountFormProps) {
  const [name, setName] = useState('')
  const [accType, setAccType] = useState<Account['type']>('checking')
  const [balance, setBalance] = useState('')
  const [color, setColor] = useState<string>(PASTEL_COLORS[0].value)

  useEffect(() => {
    if (editAccount) {
      setName(editAccount.name)
      setAccType(editAccount.type)
      setBalance(String(editAccount.balance))
      setColor(editAccount.color)
    } else {
      setName('')
      setAccType('checking')
      setBalance('')
      setColor(PASTEL_COLORS[0].value)
    }
  }, [editAccount, isOpen])

  const handleSave = async () => {
    if (!name.trim()) return
    const bal = Number(balance) || 0

    if (editAccount) {
      await updateAccount(editAccount.id, {
        name: name.trim(),
        type: accType,
        balance: bal,
        icon: TYPE_ICONS[accType] || '🏦',
        color,
      })
    } else {
      await addAccount({
        name: name.trim(),
        type: accType,
        balance: bal,
        icon: TYPE_ICONS[accType] || '🏦',
        color,
        order: accountCount,
      })
    }
    onClose()
  }

  const handleDelete = async () => {
    if (!editAccount) return
    if (confirm(`"${editAccount.name}" 계좌를 삭제하시겠습니까?`)) {
      await deleteAccount(editAccount.id)
      onClose()
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={editAccount ? '계좌 수정' : '계좌 추가'}>
      <div className="acc-form">
        <input
          className="acc-form-input"
          placeholder="계좌/카드 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="acc-type-row">
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.value}
              className={`acc-type-btn ${accType === t.value ? 'active' : ''}`}
              onClick={() => setAccType(t.value)}
              type="button"
            >{TYPE_ICONS[t.value]} {t.label}</button>
          ))}
        </div>

        <div className="acc-balance-row">
          <span className="acc-currency">₩</span>
          <input
            className="acc-balance-input"
            type="number"
            inputMode="numeric"
            placeholder="잔액"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </div>

        <div className="acc-color-row">
          {PASTEL_COLORS.slice(0, 8).map((c) => (
            <button
              key={c.value}
              className={`acc-color-btn ${color === c.value ? 'selected' : ''}`}
              style={{ background: c.value }}
              onClick={() => setColor(c.value)}
              type="button"
            />
          ))}
        </div>

        <div className="acc-form-actions">
          {editAccount && (
            <button className="acc-form-delete" onClick={handleDelete} type="button">삭제</button>
          )}
          <button className="acc-form-save" onClick={handleSave} disabled={!name.trim()} type="button">
            {editAccount ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
