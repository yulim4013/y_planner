import { useState, useRef, useCallback } from 'react'
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

function formatTimeStr(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const suffix = m ? `:${String(m).padStart(2, '0')}` : ':00'
  if (h === 0) return `오전 12${suffix}`
  if (h < 12) return `오전 ${h}${suffix}`
  if (h === 12) return `오후 12${suffix}`
  return `오후 ${h - 12}${suffix}`
}

export default function DailyView({ date, events, tasks, categories = [], onEditEvent, onEditTask }: DailyViewProps) {
  const getCat = (id?: string | null) => id ? categories.find((c) => c.id === id) : null
  const dateLabel = format(date, 'M월 d일 (EEEE)', { locale: ko })

  // Action bar
  const [actionBar, setActionBar] = useState<ActionBarState | null>(null)
  const closeActionBar = useCallback(() => setActionBar(null), [])

  // Swipe state (one item at a time)
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [swipeX, setSwipeX] = useState(0)
  const [swipeAnimating, setSwipeAnimating] = useState(false)
  const swipeRef = useRef({ startX: 0, startY: 0, decided: false, isHorizontal: false, id: '', type: '' as 'event' | 'task' })

  // Long press
  const lpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpTriggeredRef = useRef(false)
  const preMouseRef = useRef<{ moveFn: (e: MouseEvent) => void; upFn: () => void } | null>(null)

  const handleItemTouchStart = (e: React.TouchEvent, type: 'event' | 'task', id: string) => {
    if (actionBar) { setActionBar(null); return }

    const touch = e.touches[0]
    swipeRef.current = { startX: touch.clientX, startY: touch.clientY, decided: false, isHorizontal: false, id, type }

    // Close other swiped item
    if (swipedId && swipedId !== id) { setSwipedId(null); setSwipeX(0) }

    // Long press timer
    lpTriggeredRef.current = false
    const el = e.currentTarget as HTMLElement
    lpTimerRef.current = setTimeout(() => {
      lpTriggeredRef.current = true
      const rect = el.getBoundingClientRect()
      const bw = 160
      let bt = rect.bottom + 8, bl = rect.left + rect.width / 2
      if (bt + 44 > window.innerHeight - 80) bt = rect.top - 52
      bl = Math.max(bw / 2 + 8, Math.min(bl, window.innerWidth - bw / 2 - 8))
      setActionBar({ type, id, barTop: bt, barLeft: bl })
      try { navigator.vibrate?.(25) } catch {}
      lpTimerRef.current = null
    }, 500)
  }

  const handleItemTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - swipeRef.current.startX
    const dy = e.touches[0].clientY - swipeRef.current.startY

    if (!swipeRef.current.decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipeRef.current.decided = true
      swipeRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy)
      // Cancel long press on any movement
      if (lpTimerRef.current) { clearTimeout(lpTimerRef.current); lpTimerRef.current = null }
    }

    if (swipeRef.current.isHorizontal) {
      const newX = Math.min(0, Math.max(-100, dx))
      setSwipedId(swipeRef.current.id)
      setSwipeX(newX)
    }
  }

  const handleItemTouchEnd = (e: React.TouchEvent) => {
    if (lpTimerRef.current) { clearTimeout(lpTimerRef.current); lpTimerRef.current = null }
    if (lpTriggeredRef.current) e.preventDefault()

    if (swipeRef.current.isHorizontal) {
      setSwipeAnimating(true)
      if (swipeX < -50) {
        setSwipeX(-80)
      } else {
        setSwipeX(0)
        setSwipedId(null)
      }
      setTimeout(() => setSwipeAnimating(false), 200)
    }
  }

  // Mouse long-press (PC support)
  const handleItemMouseDown = (e: React.MouseEvent, type: 'event' | 'task', id: string) => {
    if (e.button !== 0) return
    if (actionBar) { setActionBar(null); return }
    e.preventDefault() // Prevent browser text-selection / native drag
    lpTriggeredRef.current = false
    const el = e.currentTarget as HTMLElement
    const startPos = { x: e.clientX, y: e.clientY }

    const onPreMove = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - startPos.x) > 10 || Math.abs(ev.clientY - startPos.y) > 10) {
        if (lpTimerRef.current) { clearTimeout(lpTimerRef.current); lpTimerRef.current = null }
        cleanupPre()
      }
    }
    const onPreUp = () => {
      if (lpTimerRef.current) {
        // Quick release before long-press → treat as click
        clearTimeout(lpTimerRef.current)
        lpTimerRef.current = null
        el.click()
      }
      cleanupPre()
    }
    const cleanupPre = () => {
      document.removeEventListener('mousemove', onPreMove)
      document.removeEventListener('mouseup', onPreUp)
      preMouseRef.current = null
    }

    document.addEventListener('mousemove', onPreMove)
    document.addEventListener('mouseup', onPreUp)
    preMouseRef.current = { moveFn: onPreMove, upFn: onPreUp }

    lpTimerRef.current = setTimeout(() => {
      lpTriggeredRef.current = true
      cleanupPre()
      const rect = el.getBoundingClientRect()
      const bw = 160
      let bt = rect.bottom + 8, bl = rect.left + rect.width / 2
      if (bt + 44 > window.innerHeight - 80) bt = rect.top - 52
      bl = Math.max(bw / 2 + 8, Math.min(bl, window.innerWidth - bw / 2 - 8))
      setActionBar({ type, id, barTop: bt, barLeft: bl })
      try { navigator.vibrate?.(25) } catch {}
      lpTimerRef.current = null
    }, 500)
  }

  // Action bar handlers
  const handleEdit = () => {
    if (!actionBar) return
    if (actionBar.type === 'event') {
      const ev = events.find((e) => e.id === actionBar.id)
      if (ev) onEditEvent(ev)
    } else {
      const t = tasks.find((t) => t.id === actionBar.id)
      if (t) onEditTask(t)
    }
    setActionBar(null)
  }

  const handleDelete = async () => {
    if (!actionBar) return
    if (actionBar.type === 'event') await deleteEvent(actionBar.id)
    else await deleteTask(actionBar.id)
    setActionBar(null)
  }

  const handleSwipeDelete = async (type: 'event' | 'task', id: string) => {
    if (type === 'event') await deleteEvent(id)
    else await deleteTask(id)
    setSwipedId(null)
    setSwipeX(0)
  }

  const handleClick = (type: 'event' | 'task', item: CalendarEvent | Task) => {
    if (lpTriggeredRef.current) { lpTriggeredRef.current = false; return }
    if (actionBar) return
    if (swipedId) { setSwipedId(null); setSwipeX(0); return }
    if (type === 'event') onEditEvent(item as CalendarEvent)
    else onEditTask(item as Task)
  }

  const sortedEvents = [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    return (a.startTime || '').localeCompare(b.startTime || '')
  })

  const hasContent = events.length > 0 || tasks.length > 0

  return (
    <div className="daily-view">
      <h3 className="daily-date">{dateLabel}</h3>

      {/* 일정 섹션 */}
      {events.length > 0 && (
        <div className="daily-section">
          <div className="daily-section-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="3" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="5" /><line x1="16" y1="2" x2="16" y2="5" />
            </svg>
            <span className="daily-section-label">일정</span>
            <span className="daily-section-count">{events.length}건</span>
          </div>
          {sortedEvents.map((event) => {
            const eCat = getCat(event.categoryId)
            const isNoTitle = !event.title || event.title === '(제목 없음)'
            const isSwiped = swipedId === event.id

            return (
              <div key={event.id} className="daily-swipe-wrapper">
                <div className="daily-swipe-delete-btn" onClick={() => handleSwipeDelete('event', event.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  <span>삭제</span>
                </div>
                <div
                  className={`daily-event ${actionBar?.id === event.id ? 'daily-selected' : ''}`}
                  style={{
                    transform: isSwiped ? `translateX(${swipeX}px)` : undefined,
                    transition: swipeAnimating ? 'transform 0.2s ease-out' : 'none',
                  }}
                  onClick={() => handleClick('event', event)}
                  onTouchStart={(e) => handleItemTouchStart(e, 'event', event.id)}
                  onTouchMove={handleItemTouchMove}
                  onTouchEnd={handleItemTouchEnd}
                  onMouseDown={(e) => handleItemMouseDown(e, 'event', event.id)}
                >
                  <div className="event-color-bar" style={eCat ? { background: eCat.color } : {}} />
                  <div className="event-info">
                    {eCat && <span className="event-category" style={{ color: eCat.color }}>{eCat.icon} {eCat.name}</span>}
                    {!isNoTitle && <span className="event-title">{event.title}</span>}
                    <span className="event-time">
                      {event.isAllDay ? '종일' : `${event.startTime || ''} ${event.endTime ? `~ ${event.endTime}` : ''}`}
                    </span>
                    {event.location && (
                      <span
                        className="event-location event-location-link"
                        onClick={(e) => { e.stopPropagation(); window.open(`https://map.naver.com/v5/search/${encodeURIComponent(event.location!)}`, '_blank') }}
                      >
                        📍 {event.location}
                      </span>
                    )}
                  </div>
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
              <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12l3 3 5-6" />
            </svg>
            <span className="daily-section-label">할 일</span>
            <span className="daily-section-count">{tasks.filter((t) => t.isCompleted).length}/{tasks.length}</span>
          </div>
          {tasks.map((task) => {
            const subItems = task.subItems || []
            const displayTime = task.isCompleted && task.completedTime ? formatTimeStr(task.completedTime) : task.dueTime ? formatTimeStr(task.dueTime) : null
            const isSwiped = swipedId === task.id
            const taskCat = getCat(task.categoryId)

            return (
              <div key={task.id} className="daily-swipe-wrapper">
                <div className="daily-swipe-delete-btn" onClick={() => handleSwipeDelete('task', task.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  <span>삭제</span>
                </div>
                <div
                  className={`daily-task ${task.isCompleted ? 'daily-task-done' : ''} ${actionBar?.id === task.id ? 'daily-selected' : ''}`}
                  style={{
                    transform: isSwiped ? `translateX(${swipeX}px)` : undefined,
                    transition: swipeAnimating ? 'transform 0.2s ease-out' : 'none',
                  }}
                  onTouchStart={(e) => handleItemTouchStart(e, 'task', task.id)}
                  onTouchMove={handleItemTouchMove}
                  onTouchEnd={handleItemTouchEnd}
                  onMouseDown={(e) => handleItemMouseDown(e, 'task', task.id)}
                >
                  <div className="daily-task-header" onClick={() => handleClick('task', task)}>
                    {taskCat && <div className="daily-task-color-bar" style={{ background: taskCat.color }} />}
                    <button
                      className={`daily-task-check ${task.isCompleted ? 'done' : ''}`}
                      style={!task.isCompleted && taskCat ? { boxShadow: `inset 0 0 0 2px ${taskCat.color}` } : undefined}
                      onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate) }}
                    >
                      {task.isCompleted && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className="daily-task-title">{task.title}</span>
                    {taskCat && <span className="daily-cat-badge" style={{ background: `${taskCat.color}33`, color: taskCat.color }}>{taskCat.name}</span>}
                    <span className={`daily-task-priority priority-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
                    {displayTime && <span className={`daily-task-time ${task.isCompleted ? 'completed' : ''}`}>{displayTime}</span>}
                  </div>
                  {subItems.length > 0 && (
                    <div className="daily-task-subs">
                      {subItems.map((item) => (
                        <div key={item.id} className={`daily-sub ${item.isCompleted ? 'daily-sub-done' : ''}`} onClick={() => toggleSubItem(task.id, subItems, item.id, !!task.dueDate)}>
                          <span className={`daily-sub-check ${item.isCompleted ? 'done' : ''}`}>
                            {item.isCompleted && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2L6.5 2.5" stroke="#5a5a3a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </span>
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!hasContent && <p className="daily-empty">이 날의 일정과 할 일이 없습니다</p>}

      {/* Action bar */}
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
          </div>
        </>
      )}
    </div>
  )
}
