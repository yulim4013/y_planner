import { useRef, useEffect, useMemo } from 'react'
import {
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
} from 'date-fns'
// date-fns/locale not needed here; day labels are in DAY_LABELS constant
import { toggleTaskComplete } from '../../services/taskService'
import { matchesRepeatDate } from '../../utils/repeatUtils'
import type { CalendarEvent, Task, Category } from '../../types'
import './WeeklyView.css'

interface WeeklyViewProps {
  weekStart: Date  // Sunday of the week
  events: CalendarEvent[]  // ALL events (component filters per day)
  tasks: Task[]  // ALL tasks
  categories: Category[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onEditEvent: (event: CalendarEvent) => void
  onEditTask: (task: Task) => void
  onAddEventAtTime: (date: Date, startTime: string) => void
}

const HOUR_HEIGHT = 50
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function getHourLabel(hour: number): string {
  if (hour === 0) return '오전 12시'
  if (hour < 12) return `오전 ${hour}시`
  if (hour === 12) return '정오'
  return `오후 ${hour - 12}시`
}

function formatTimeKorean(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = m ? `:${String(m).padStart(2, '0')}` : ''
  if (h === 0) return `오전 12시${suffix}`
  if (h < 12) return `오전 ${h}시${suffix}`
  if (h === 12) return `오후 12시${suffix}`
  return `오후 ${h - 12}시${suffix}`
}

function minutesToTimeStr(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function WeeklyView({
  weekStart,
  events,
  tasks,
  categories,
  selectedDate,
  onSelectDate,
  onEditEvent,
  onEditTask,
  onAddEventAtTime,
}: WeeklyViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const getCat = (id?: string | null) =>
    id ? categories.find((c) => c.id === id) : null

  // Filter events & tasks per day
  const dayData = useMemo(() => {
    return days.map((day) => {
      const dayEvents = events.filter((e) => {
        const start = new Date(e.startDate.toDate())
        const end = new Date(e.endDate.toDate())
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        if (day >= start && day <= end) return true
        return matchesRepeatDate(start, day, e.repeat, e.repeatEndDate)
      })

      const dayTasks = tasks.filter((t) => {
        if (!t.dueDate) return false
        if (isSameDay(t.dueDate.toDate(), day)) return true
        if (t.repeat && t.repeat !== 'none' && !t.isCompleted) {
          return matchesRepeatDate(t.dueDate.toDate(), day, t.repeat, t.repeatEndDate)
        }
        return false
      })

      const timedEvents = dayEvents.filter((e) => !e.isAllDay && e.startTime)
      const allDayEvents = dayEvents.filter((e) => e.isAllDay || !e.startTime)
      const timedTasks = dayTasks.filter((t) => t.dueTime)
      const untimedTasks = dayTasks.filter((t) => !t.dueTime)

      return { day, timedEvents, allDayEvents, timedTasks, untimedTasks }
    })
  }, [days, events, tasks])

  // Auto-scroll to current hour or earliest event on mount
  useEffect(() => {
    if (!scrollRef.current) return

    const now = new Date()
    let scrollToHour = now.getHours()

    // Find the earliest timed event/task across the week
    let earliestMin = scrollToHour * 60
    for (const dd of dayData) {
      for (const e of dd.timedEvents) {
        if (e.startTime) {
          const min = timeToMinutes(e.startTime)
          if (min < earliestMin) earliestMin = min
        }
      }
      for (const t of dd.timedTasks) {
        if (t.dueTime) {
          const min = timeToMinutes(t.dueTime)
          if (min < earliestMin) earliestMin = min
        }
      }
    }

    // Scroll to 1 hour before the earliest item
    const targetHour = Math.max(0, Math.floor(earliestMin / 60) - 1)
    scrollRef.current.scrollTop = targetHour * HOUR_HEIGHT
  }, [weekStart])

  // Current time position
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const currentTimeTop = (currentMinutes / 60) * HOUR_HEIGHT

  const handleGridClick = (dayIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks directly on the grid column (not on event/task elements)
    const target = e.target as HTMLElement
    if (target.closest('.wv-event-block') || target.closest('.wv-task-row') || target.closest('.wv-allday-item')) {
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutes = Math.floor(y / HOUR_HEIGHT) * 60
    const snappedMinutes = Math.round(minutes / 15) * 15
    const timeStr = minutesToTimeStr(Math.max(0, Math.min(snappedMinutes, 23 * 60 + 45)))

    const day = days[dayIndex]
    onSelectDate(day)
    onAddEventAtTime(day, timeStr)
  }

  return (
    <div className="wv-container">
      {/* Header row: day labels */}
      <div className="wv-header">
        <div className="wv-time-gutter-header" />
        {days.map((day, i) => {
          const today = isToday(day)
          const selected = isSameDay(day, selectedDate)
          const dayOfWeek = day.getDay()
          return (
            <div
              key={day.toISOString()}
              className={`wv-day-header ${today ? 'wv-today-header' : ''} ${selected ? 'wv-selected-header' : ''}`}
              onClick={() => onSelectDate(day)}
            >
              <span className={`wv-day-label ${dayOfWeek === 0 ? 'sun' : dayOfWeek === 6 ? 'sat' : ''}`}>
                {DAY_LABELS[i]}
              </span>
              <span className={`wv-day-num ${today ? 'wv-today-num' : ''} ${selected ? 'wv-selected-num' : ''}`}>
                {format(day, 'd')}
              </span>
            </div>
          )
        })}
      </div>

      {/* All-day events row */}
      {dayData.some((dd) => dd.allDayEvents.length > 0 || dd.untimedTasks.length > 0) && (
        <div className="wv-allday-row">
          <div className="wv-time-gutter wv-allday-label">종일</div>
          {dayData.map((dd, i) => (
            <div key={i} className="wv-allday-cell">
              {dd.allDayEvents.map((ev) => {
                const cat = getCat(ev.categoryId)
                return (
                  <div
                    key={ev.id}
                    className="wv-allday-item"
                    style={{
                      background: cat ? `${cat.color}22` : 'rgba(100,181,246,0.13)',
                      borderLeft: `3px solid ${cat?.color || '#64B5F6'}`,
                    }}
                    onClick={() => onEditEvent(ev)}
                  >
                    <span className="wv-allday-title">{ev.title}</span>
                  </div>
                )
              })}
              {dd.untimedTasks.map((task) => {
                const cat = getCat(task.categoryId)
                return (
                  <div
                    key={task.id}
                    className={`wv-allday-task ${task.isCompleted ? 'wv-done' : ''}`}
                  >
                    <button
                      className={`wv-check ${task.isCompleted ? 'done' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate)
                      }}
                    >
                      {task.isCompleted && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                    <span className="wv-allday-task-title" onClick={() => onEditTask(task)}>
                      {cat && <span style={{ color: cat.color, marginRight: 3 }}>{cat.icon}</span>}
                      {task.title}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Scrollable time grid */}
      <div className="wv-scroll" ref={scrollRef}>
        <div className="wv-grid" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Time labels + hour lines */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="wv-hour-row"
              style={{ top: hour * HOUR_HEIGHT }}
            >
              <div className="wv-time-gutter">
                <span className="wv-hour-label">{getHourLabel(hour)}</span>
              </div>
              <div className="wv-hour-line" />
            </div>
          ))}

          {/* Day columns */}
          <div className="wv-columns">
            {dayData.map((dd, dayIndex) => {
              const today = isToday(dd.day)
              const selected = isSameDay(dd.day, selectedDate)
              return (
                <div
                  key={dd.day.toISOString()}
                  className={`wv-column ${today ? 'wv-today-col' : ''} ${selected ? 'wv-selected-col' : ''}`}
                  onClick={(e) => handleGridClick(dayIndex, e)}
                >
                  {/* Vertical divider */}
                  <div className="wv-col-divider" />

                  {/* Timed events */}
                  {dd.timedEvents.map((ev) => {
                    const cat = getCat(ev.categoryId)
                    const startMin = ev.startTime ? timeToMinutes(ev.startTime) : 0
                    const endMin = ev.endTime ? timeToMinutes(ev.endTime) : startMin + 60
                    const top = (startMin / 60) * HOUR_HEIGHT
                    const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20)

                    return (
                      <div
                        key={ev.id}
                        className="wv-event-block"
                        style={{
                          top,
                          height,
                          background: cat ? `${cat.color}22` : 'rgba(100,181,246,0.13)',
                          borderLeft: `3px solid ${cat?.color || '#64B5F6'}`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditEvent(ev)
                        }}
                      >
                        <span className="wv-event-title">{ev.title}</span>
                        {height > 30 && ev.startTime && (
                          <span className="wv-event-time">
                            {formatTimeKorean(ev.startTime)}
                          </span>
                        )}
                        {height > 50 && ev.location && (
                          <span className="wv-event-location">{ev.location}</span>
                        )}
                      </div>
                    )
                  })}

                  {/* Timed tasks */}
                  {dd.timedTasks.map((task) => {
                    const cat = getCat(task.categoryId)
                    const min = task.dueTime ? timeToMinutes(task.dueTime) : 0
                    const top = (min / 60) * HOUR_HEIGHT

                    return (
                      <div
                        key={task.id}
                        className={`wv-task-row ${task.isCompleted ? 'wv-done' : ''}`}
                        style={{ top }}
                      >
                        <button
                          className={`wv-check ${task.isCompleted ? 'done' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate)
                          }}
                        >
                          {task.isCompleted && (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </button>
                        <span
                          className="wv-task-title"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditTask(task)
                          }}
                        >
                          {cat && <span style={{ color: cat.color, marginRight: 2 }}>{cat.icon}</span>}
                          {task.title}
                        </span>
                      </div>
                    )
                  })}

                  {/* Current time indicator (only for today) */}
                  {today && (
                    <div className="wv-now-line" style={{ top: currentTimeTop }}>
                      <div className="wv-now-dot" />
                      <div className="wv-now-rule" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
