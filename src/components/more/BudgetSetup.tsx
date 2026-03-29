import { useState, useEffect } from 'react'
import BottomSheet from '../common/BottomSheet'
import { setMonthlyBudget } from '../../services/budgetService'
import type { MonthlyBudget } from '../../types'
import './BudgetSetup.css'

interface BudgetSetupProps {
  isOpen: boolean
  onClose: () => void
  yearMonth: string
  currentBudget: MonthlyBudget | null
}

export default function BudgetSetup({
  isOpen,
  onClose,
  yearMonth,
  currentBudget,
}: BudgetSetupProps) {
  const [totalBudget, setTotalBudget] = useState('')

  useEffect(() => {
    if (isOpen) {
      const val = currentBudget?.budgets?.['_total']
      setTotalBudget(val ? String(val) : '')
    }
  }, [isOpen, currentBudget])

  const handleSave = async () => {
    const num = Number(totalBudget) || 0
    await setMonthlyBudget(yearMonth, { _total: num })
    onClose()
  }

  const [, month] = yearMonth.split('-')

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`${Number(month)}월 변동지출 예산`}
    >
      <div className="budget-setup">
        <div className="budget-setup-row">
          <span className="budget-setup-label">변동지출 예산</span>
          <div className="budget-setup-input-wrap">
            <span className="budget-setup-won">₩</span>
            <input
              className="budget-setup-input"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
            />
          </div>
        </div>

        <button className="budget-setup-save" onClick={handleSave} type="button">
          저장
        </button>
      </div>
    </BottomSheet>
  )
}
