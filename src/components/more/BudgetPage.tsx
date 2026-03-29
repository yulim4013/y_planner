import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../layout/Header'
import GlassCard from '../common/GlassCard'
import TransactionForm from './TransactionForm'
import BudgetSetup from './BudgetSetup'
import AccountForm from './AccountForm'
import {
  subscribeTransactionsByMonth,
  subscribeMonthlyBudget,
} from '../../services/budgetService'
import { subscribeAccounts } from '../../services/accountService'
import { syncToSheets } from '../../services/sheetsService'
import { getBudgetCategory } from '../../utils/constants'
import { formatNumber } from '../../utils/currencyUtils'
import type { Transaction, MonthlyBudget, Account } from '../../types'
import './BudgetPage.css'

export default function BudgetPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budget, setBudget] = useState<MonthlyBudget | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editTxn, setEditTxn] = useState<Transaction | null>(null)
  const [budgetSetupOpen, setBudgetSetupOpen] = useState(false)
  const [accountFormOpen, setAccountFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const unsubTxn = subscribeTransactionsByMonth(currentMonth, setTransactions)
    const unsubBudget = subscribeMonthlyBudget(currentMonth, setBudget)
    const unsubAccounts = subscribeAccounts(setAccounts)
    return () => { unsubTxn(); unsubBudget(); unsubAccounts() }
  }, [currentMonth])

  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthLabel = (() => {
    const [y, m] = currentMonth.split('-').map(Number)
    return `${y}년 ${m}월`
  })()

  const totals = useMemo(() => {
    let income = 0
    let fixedExp = 0
    let variableExp = 0

    transactions.forEach((t) => {
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') {
        if (t.subType === 'fixed') fixedExp += t.amount
        else variableExp += t.amount
      }
    })

    return { income, fixedExp, variableExp, balance: income - fixedExp - variableExp }
  }, [transactions])

  const groupedByDate = useMemo(() => {
    const groups: { dateStr: string; label: string; items: Transaction[] }[] = []
    const map = new Map<string, Transaction[]>()

    transactions.forEach((t) => {
      const d = t.date.toDate()
      const key = format(d, 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })

    const sortedKeys = [...map.keys()].sort((a, b) => b.localeCompare(a))
    sortedKeys.forEach((key) => {
      const d = new Date(key + 'T00:00:00')
      groups.push({
        dateStr: key,
        label: format(d, 'M월 d일 (EEEEE)', { locale: ko }),
        items: map.get(key)!,
      })
    })

    return groups
  }, [transactions])

  const totalAssets = useMemo(() => {
    return accounts.reduce((sum, a) => sum + a.balance, 0)
  }, [accounts])

  const totalBudget = budget?.budgets?.['_total'] || 0

  const handleAdd = () => { setEditTxn(null); setFormOpen(true) }
  const handleEditTxn = (txn: Transaction) => { setEditTxn(txn); setFormOpen(true) }
  const handleAddAccount = () => { setEditAccount(null); setAccountFormOpen(true) }
  const handleEditAccount = (acc: Account) => { setEditAccount(acc); setAccountFormOpen(true) }

  const handleSync = async () => {
    setSyncing(true)
    const result = await syncToSheets(currentMonth, transactions)
    setSyncing(false)
    if (result.success && result.url) {
      window.open(result.url, '_blank')
    } else {
      alert(result.error || '동기화 실패')
    }
  }

  return (
    <div className="page">
      <Header
        title="BUDGET"
        right={<button className="header-add-btn" onClick={handleAdd}>+</button>}
      />

      {/* 월 네비게이션 */}
      <div className="budget-nav">
        <button className="budget-nav-btn" onClick={handlePrevMonth}>&lt;</button>
        <span className="budget-nav-title">{monthLabel}</span>
        <button className="budget-nav-btn" onClick={handleNextMonth}>&gt;</button>
      </div>

      {/* 수입/지출 요약 */}
      <GlassCard className="budget-summary">
        <div className="budget-summary-row">
          <div className="budget-summary-item">
            <span className="budget-label">수입</span>
            <span className="budget-value income">+{formatNumber(totals.income)}</span>
          </div>
          <div className="budget-summary-item">
            <span className="budget-label">지출</span>
            <span className="budget-value expense">-{formatNumber(totals.fixedExp + totals.variableExp)}</span>
          </div>
          <div className="budget-summary-item">
            <span className="budget-label">잔액</span>
            <span className={`budget-value ${totals.balance >= 0 ? 'income' : 'expense'}`}>
              {totals.balance >= 0 ? '+' : ''}{formatNumber(totals.balance)}
            </span>
          </div>
        </div>
        <div className="budget-detail-row">
          <span className="budget-detail">고정 -{formatNumber(totals.fixedExp)}</span>
          <span className="budget-detail">변동 -{formatNumber(totals.variableExp)}</span>
        </div>
      </GlassCard>

      {/* 변동지출 예산 - 간소화 */}
      <GlassCard className="budget-progress-card">
        <div className="budget-progress-header">
          <span className="budget-progress-title">변동지출 예산</span>
          <button className="budget-setup-btn" onClick={() => setBudgetSetupOpen(true)}>설정</button>
        </div>

        {totalBudget > 0 ? (
          <div className="budget-total-bar">
            <div className="budget-total-info">
              <span className="budget-total-amounts">
                <span className="budget-actual">₩{formatNumber(totals.variableExp)}</span>
                <span className="budget-slash"> / </span>
                <span className="budget-target">₩{formatNumber(totalBudget)}</span>
              </span>
              <span className={`budget-pct ${totals.variableExp > totalBudget ? 'budget-over' : ''}`}>
                {Math.round((totals.variableExp / totalBudget) * 100)}%
              </span>
            </div>
            <div className="budget-bar-track">
              <div
                className={`budget-bar-fill ${totals.variableExp > totalBudget ? 'over' : ''}`}
                style={{ width: `${Math.min((totals.variableExp / totalBudget) * 100, 100)}%` }}
              />
            </div>
            <div className="budget-remain">
              {totals.variableExp <= totalBudget
                ? `₩${formatNumber(totalBudget - totals.variableExp)} 남음`
                : `₩${formatNumber(totals.variableExp - totalBudget)} 초과`}
            </div>
          </div>
        ) : (
          <p className="budget-empty-msg">예산을 설정하면 변동지출 사용량을 확인할 수 있습니다</p>
        )}
      </GlassCard>

      {/* 거래 내역 */}
      {groupedByDate.length > 0 ? (
        groupedByDate.map((group) => (
          <GlassCard key={group.dateStr} className="txn-group">
            <div className="txn-group-header">{group.label}</div>
            {group.items.map((txn) => {
              const cat = getBudgetCategory(txn.category)
              return (
                <div key={txn.id} className="txn-item" onClick={() => handleEditTxn(txn)}>
                  <span className="txn-cat-icon" style={{ background: cat?.color || '#eee' }}>
                    {txn.type === 'transfer' ? '↔️' : (cat?.icon || '📦')}
                  </span>
                  <div className="txn-item-info">
                    <span className="txn-item-cat">
                      {txn.type === 'transfer'
                        ? `${txn.fromAccount} → ${txn.toAccount}`
                        : txn.category}
                    </span>
                    {txn.memo && <span className="txn-item-memo">{txn.memo}</span>}
                    {txn.paymentMethod && <span className="txn-item-memo">{txn.paymentMethod}</span>}
                    {txn.type === 'income' && txn.toAccount && <span className="txn-item-memo">{txn.toAccount}</span>}
                  </div>
                  <span className={`txn-item-amount ${txn.type === 'income' ? 'income' : txn.type === 'transfer' ? 'transfer' : 'expense'}`}>
                    {txn.type === 'income' ? '+' : txn.type === 'transfer' ? '' : '-'}₩{formatNumber(txn.amount)}
                  </span>
                </div>
              )
            })}
          </GlassCard>
        ))
      ) : (
        <GlassCard>
          <p className="budget-empty">이번 달 거래 내역이 없습니다</p>
        </GlassCard>
      )}

      {/* 자산 관리 - Google Sheets 바로 위 */}
      <GlassCard className="asset-card">
        <div className="asset-header">
          <span className="asset-title">자산 관리</span>
          <button className="asset-add-btn" onClick={handleAddAccount}>+</button>
        </div>
        {accounts.length > 0 ? (
          <>
            <div className="asset-total">
              <span className="asset-total-label">총 자산</span>
              <span className="asset-total-value">₩{formatNumber(totalAssets)}</span>
            </div>
            <div className="asset-list">
              {accounts.map((acc) => (
                <div key={acc.id} className="asset-item" onClick={() => handleEditAccount(acc)}>
                  <span className="asset-icon" style={{ background: acc.color }}>{acc.icon}</span>
                  <div className="asset-info">
                    <span className="asset-name">{acc.name}</span>
                    <span className="asset-type">
                      {acc.type === 'checking' ? '입출금' : acc.type === 'savings' ? '저축' : acc.type === 'credit' ? '신용카드' : acc.type === 'cash' ? '현금' : '투자'}
                    </span>
                  </div>
                  <span className={`asset-balance ${acc.balance >= 0 ? '' : 'negative'}`}>
                    ₩{formatNumber(acc.balance)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="budget-empty-msg">계좌를 추가하면 자산을 관리할 수 있습니다</p>
        )}
      </GlassCard>

      {/* Google Sheets 동기화 - 최하단 */}
      <button
        className="sheets-sync-btn"
        onClick={handleSync}
        disabled={syncing || transactions.length === 0}
      >
        {syncing ? '동기화 중...' : '📊 Google Sheets 동기화'}
      </button>

      <TransactionForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditTxn(null) }}
        editTxn={editTxn}
      />

      <BudgetSetup
        isOpen={budgetSetupOpen}
        onClose={() => setBudgetSetupOpen(false)}
        yearMonth={currentMonth}
        currentBudget={budget}
      />

      <AccountForm
        isOpen={accountFormOpen}
        onClose={() => { setAccountFormOpen(false); setEditAccount(null) }}
        editAccount={editAccount}
        accountCount={accounts.length}
      />
    </div>
  )
}
