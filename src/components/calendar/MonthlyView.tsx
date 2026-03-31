import { useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns'
import { formatNumber } from '../../utils/currencyUtils'
import { matchesRepeatDate } from '../../utils/repeatUtils'
import type { CalendarEvent, Task, Transaction } from '../../types'
import './MonthlyView.css'

interface MonthlyViewProps {
  currentDate: Date
  events: CalendarEvent[]
  tasks: Task[]
  transactions?: Transaction[]
  onSelectDate: (date: Date) => void
  selectedDate: Date | null
  isMoving?: boolean
  onMoveToDate?: (date: Date) => void
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function MonthlyView({ currentDate, events, tasks, transactions = [], onSelectDate, selectedDate, isMoving, onMoveToDate }: MonthlyViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  // 일별 지출 합계 계산
  const dailyExpenses = useMemo(() => {
    const map: Record<string, number> = {}
    transactions.forEach((t) => {
      if (t.type === 'expense') {
        const key = format(t.date.toDate(), 'yyyy-MM-dd')
        map[key] = (map[key] || 0) + t.amount
      }
    })
    return map
  }, [transactions])

  function getDotsForDay(day: Date) {
    const dots: string[] = []
    const hasEvent = events.some((e) => {
      const start = e.startDate.toDate()
      const end = e.endDate.toDate()
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      if (day >= start && day <= end) return true
      return matchesRepeatDate(start, day, e.repeat, e.repeatEndDate)
    })
    if (hasEvent) dots.push('event')

    const hasTask = tasks.some((t) => {
      if (!t.dueDate) return false
      if (isSameDay(t.dueDate.toDate(), day)) return true
      if (t.repeat && t.repeat !== 'none' && !t.isCompleted) {
        return matchesRepeatDate(t.dueDate.toDate(), day, t.repeat, t.repeatEndDate)
      }
      return false
    })
    if (hasTask) dots.push('task')

    return dots
  }

  return (
    <div className="monthly-view">
      <div className="weekday-header">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={`weekday ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>{d}</div>
        ))}
      </div>
      <div className={`calendar-grid ${isMoving ? 'moving-mode' : ''}`}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentDate)
          const today = isToday(day)
          const selected = selectedDate && isSameDay(day, selectedDate)
          const dots = getDotsForDay(day)
          const dayOfWeek = day.getDay()
          const dateKey = format(day, 'yyyy-MM-dd')
          const expense = dailyExpenses[dateKey]

          return (
            <div
              key={day.toISOString()}
              className={`cal-day ${!inMonth ? 'other-month' : ''} ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${dayOfWeek === 0 ? 'sun' : dayOfWeek === 6 ? 'sat' : ''}`}
              onClick={() => isMoving && onMoveToDate ? onMoveToDate(day) : onSelectDate(day)}
            >
              <span className="day-num">{format(day, 'd')}</span>
              {dots.length > 0 && (
                <div className="day-dots">
                  {dots.map((type) => (
                    <span key={type} className={`dot dot-${type}`} />
                  ))}
                </div>
              )}
              {expense && inMonth && (
                <span className="day-expense">-{formatNumber(expense)}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
