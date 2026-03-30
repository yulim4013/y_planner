import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toggleTaskComplete, toggleSubItem, deleteTask } from '../../services/taskService'
import { deleteEvent } from '../../services/eventService'
import { PRIORITY_LABELS } from '../../utils/constants'
import type { CalendarEvent, Task, Category } from '../../types'
import './DailyView.css'

interface DailyViewProps {
  date: Date
  events: CalendarEvent[]
  categories?: Category[]
  tasks: Task[]
  onEditEvent: (event: CalendarEvent) => void
  onEditTask: (task: Task) => void
  onMoveItem?: (type: 'task' | 'event', id: string) => void
}

interface ActionBarState {
  type: 'event' | 'task'
  id: string
  barTop: number
  barLeft: number
}

function createLongPressHandlers(onLongPress: (rect: DOMRect) => void, ms = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0
  let triggered = false
  let capturedTarget: HTMLElement | null = null

  const clear = () => { if (timer) { clearTimeout(timer); timer = null } }

  return {
    onTouchStart: (e: React.TouchEvent) => {
      triggered = false
      capturedTarget = e.currentTarget as HTMLElement
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      timer = setTimeout(() => {
        triggered = true
        if (capturedTarget) {
          onLongPress(capturedTarget.getBoundingClientRect())
          try { navigator.vibrate?.(20) } catch {}
        }
        timer = null
      }, ms)
    },
    onTouchEnd: (e: React.TouchEvent) => { clear(); if (triggered) e.preventDefault() },
    onTouchMove: (e: React.TouchEvent) => {
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clear()
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      triggered = false
      capturedTarget = e.currentTarget as HTMLElement
      startX = e.clientX
      startY = e.clientY
      timer = setTimeout(() => {
        triggered = true
        if (capturedTarget) onLongPress(capturedTarget.getBoundingClientRect())
        timer = null
      }, ms)
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) clear()
    },
  }
}

function formatTimeStr(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const suffix = m ? `:${String(m).padStart(2, '0')}` : ':00'
  if (h === 0) return `오전 12${suffix}`
  if (h < 12) return `오전 ${h}${suffix}`
  if (h === 12) return `오후 12${suffix}`
  return `오후 ${h - 12}${suffix}`
}

export default function DailyView({ date, events, tasks, categories = [], onEditEvent, onEditTask, onMoveItem }: DailyViewProps) {
  const getCat = (id?: string | null) => id ? categories.find((c) => c.id === id) : null
  const dateLabel = format(date, 'M월 d일 (EEEE)', { locale: ko })
  const [actionBar, setActionBar] = useState<ActionBarState | null>(null)

  const closeActionBar = useCallback(() => setActionBar(null), [])

  const sortedEvents = [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    const aTime = a.startTime || ''
    const bTime = b.startTime || ''
    return aTime.localeCompare(bTime)
  })

  const handleLongPress = (type: 'event' | 'task', id: string, rect: DOMRect) => {
    const barWidth = 220
    let barTop = rect.bottom + 8
    let barLeft = rect.left + rect.width / 2

    if (barTop + 44 > window.innerHeight - 80) {
      barTop = rect.top - 52
    }

    barLeft = Math.max(barWidth / 2 + 8, Math.min(barLeft, window.innerWidth - barWidth / 2 - 8))
    setActionBar({ type, id, barTop, barLeft })
  }

  const handleEdit = () => {
    if (!actionBar) return
    if (actionBar.type === 'event') {
      const event = events.find((e) => e.id === actionBar.id)
      if (event) onEditEvent(event)
    } else {
      const task = tasks.find((t) => t.id === actionBar.id)
      if (task) onEditTask(task)
    }
    setActionBar(null)
  }

  const handleDelete = async () => {
    if (!actionBar) return
    if (actionBar.type === 'event') {
      await deleteEvent(actionBar.id)
    } else {
      await deleteTask(actionBar.id)
    }
    setActionBar(null)
  }

  const handleMove = () => {
    if (!actionBar || !onMoveItem) return
    onMoveItem(actionBar.type, actionBar.id)
    setActionBar(null)
  }

  const hasContent = events.length > 0 || tasks.length > 0

  return (
    <div className="daily-view">
      <h3 className="daily-date">{dateLabel}</h3>

      {/* 일정 섹션 */}
      {events.length > 0 && (
        <div className="daily-section">
          <div className="daily-section-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="3" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="8" y1="2" x2="8" y2="5" />
              <line x1="16" y1="2" x2="16" y2="5" />
            </svg>
            <span className="daily-section-label">일정</span>
            <span className="daily-section-count">{events.length}건</span>
          </div>
          {sortedEvents.map((event) => {
            const eCat = getCat(event.categoryId)
            const isNoTitle = !event.title || event.title === '(제목 없음)'
            const lp = createLongPressHandlers((rect) => handleLongPress('event', event.id, rect))
            return (
              <div
                key={event.id}
                className={`daily-event ${actionBar?.id === event.id ? 'daily-selected' : ''}`}
                onClick={() => { if (!actionBar) onEditEvent(event) }}
                {...lp}
              >
                <div className="event-color-bar" style={eCat ? { background: eCat.color } : {}} />
                <div className="event-info">
                  {eCat && <span className="event-category" style={{ color: eCat.color }}>{eCat.icon} {eCat.name}</span>}
                  {!isNoTitle && <span className="event-title">{event.title}</span>}
                  <span className="event-time">
                    {event.isAllDay ? '종일' : `${event.startTime || ''} ${event.endTime ? `~ ${event.endTime}` : ''}`}
                  </span>
                  {event.location && <span className="event-location">{event.location}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 할 일 섹션 */}
      {tasks.length > 0 && (
        <div className="daily-section">
          <div className="daily-section-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M8 12l3 3 5-6" />
            </svg>
            <span className="daily-section-label">할 일</span>
            <span className="daily-section-count">
              {tasks.filter((t) => t.isCompleted).length}/{tasks.length}
            </span>
          </div>
          {tasks.map((task) => {
            const subItems = task.subItems || []
            const displayTime = task.isCompleted && task.completedTime
              ? formatTimeStr(task.completedTime)
              : task.dueTime
                ? formatTimeStr(task.dueTime)
                : null
            const taskLp = createLongPressHandlers((rect) => handleLongPress('task', task.id, rect))
            return (
              <div key={task.id} className={`daily-task ${task.isCompleted ? 'daily-task-done' : ''} ${actionBar?.id === task.id ? 'daily-selected' : ''}`}>
                <div
                  className="daily-task-header"
                  onClick={() => { if (!actionBar) onEditTask(task) }}
                  {...taskLp}
                >
                  <button
                    className={`daily-task-check ${task.isCompleted ? 'done' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate)
                    }}
                  >
                    {task.isCompleted && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className="daily-task-title">{task.title}</span>
                  <span className={`daily-task-priority priority-${task.priority}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  {displayTime && (
                    <span className={`daily-task-time ${task.isCompleted ? 'completed' : ''}`}>
                      {displayTime}
                    </span>
                  )}
                </div>
                {subItems.length > 0 && (
                  <div className="daily-task-subs">
                    {subItems.map((item) => (
                      <div
                        key={item.id}
                        className={`daily-sub ${item.isCompleted ? 'daily-sub-done' : ''}`}
                        onClick={() => toggleSubItem(task.id, subItems, item.id, !!task.dueDate)}
                      >
                        <span className={`daily-sub-check ${item.isCompleted ? 'done' : ''}`}>
                          {item.isCompleted && (
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                              <path d="M1.5 4l2 2L6.5 2.5" stroke="#5a5a3a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!hasContent && (
        <p className="daily-empty">이 날의 일정과 할 일이 없습니다</p>
      )}

      {/* Apple Calendar 스타일 액션 바 */}
      {actionBar && (
        <>
          <div className="daily-action-overlay" onClick={closeActionBar} onTouchStart={closeActionBar} />
          <div
            className="daily-action-bar"
            style={{ top: actionBar.barTop, left: actionBar.barLeft }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button className="action-bar-btn" onClick={handleEdit}>수정</button>
            <button className="action-bar-btn action-delete" onClick={handleDelete}>삭제</button>
            {onMoveItem && (
              <button className="action-bar-btn" onClick={handleMove}>날짜 이동</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
