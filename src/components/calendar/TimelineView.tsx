import { useRef, useEffect, useState, useCallback } from 'react'
import { toggleTaskComplete, deleteTask, updateTask } from '../../services/taskService'
import { deleteEvent, updateEvent } from '../../services/eventService'
import { toggleRoutineComplete } from '../../services/routineService'
import type { CalendarEvent, Task, Category, Routine } from '../../types'
import './TimelineView.css'

interface TimelineViewProps {
  events: CalendarEvent[]
  tasks: Task[]
  routines?: Routine[]
  categories?: Category[]
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

const HOUR_HEIGHT = 60

const ROUTINE_ICON_MAP: Record<string, string> = {
  sunrise: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 00-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><polyline points="8 6 12 2 16 6"/></svg>`,
  moon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`,
  stretch: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="4" r="2"/><path d="M17 7l-3 4-3-1-4 3"/></svg>`,
  water: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c0 0-7 8.5-7 13a7 7 0 0014 0c0-4.5-7-13-7-13z"/></svg>`,
  pill: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="5"/><line x1="7" y1="12" x2="17" y2="12"/></svg>`,
  journal: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
}

function getHourLabel(hour: number): string {
  if (hour === 0) return '오전 12시'
  if (hour < 12) return `오전 ${hour}시`
  if (hour === 12) return '정오'
  return `오후 ${hour - 12}시`
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatTimeKorean(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = m ? `:${String(m).padStart(2, '0')}` : ''
  if (h === 0) return `오전 12시${suffix}`
  if (h < 12) return `오전 ${h}시${suffix}`
  if (h === 12) return `오후 12시${suffix}`
  return `오후 ${h - 12}시${suffix}`
}

export default function TimelineView({ events, tasks, routines = [], categories = [], onEditEvent, onEditTask }: TimelineViewProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const getCat = (id?: string | null) => id ? categories.find((c) => c.id === id) : null

  // Refs for current data (accessible in event handlers)
  const eventsRef = useRef(events)
  eventsRef.current = events

  // Action bar
  const [actionBar, setActionBar] = useState<ActionBarState | null>(null)
  const closeActionBar = useCallback(() => setActionBar(null), [])

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragDeltaY, setDragDeltaY] = useState(0)
  const [dragTimeLabel, setDragTimeLabel] = useState('')
  const dragRef = useRef<{
    type: 'event' | 'task'
    id: string
    startY: number
    startScroll: number
    originalMin: number
    element: HTMLElement
    docMoveHandler: ((e: TouchEvent) => void) | null
    docEndHandler: ((e: TouchEvent) => void) | null
  } | null>(null)
  const lpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpTriggeredRef = useRef(false)
  const touchStartPosRef = useRef({ x: 0, y: 0 })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lpTimerRef.current) clearTimeout(lpTimerRef.current)
      if (dragRef.current?.docMoveHandler) {
        document.removeEventListener('touchmove', dragRef.current.docMoveHandler)
      }
      if (dragRef.current?.docEndHandler) {
        document.removeEventListener('touchend', dragRef.current.docEndHandler)
      }
    }
  }, [])

  const startDragMode = useCallback((type: 'event' | 'task', id: string, element: HTMLElement, originalMin: number, touchY: number) => {
    const scrollContainer = gridRef.current?.closest('.day-view-timeline-scroll')
    const startScroll = scrollContainer?.scrollTop || 0

    const info = { type, id, startY: touchY, startScroll, originalMin, element, docMoveHandler: null as any, docEndHandler: null as any }

    const handleDocMove = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      const dy = touch.clientY - info.startY
      const scroll = (gridRef.current?.closest('.day-view-timeline-scroll')?.scrollTop || 0) - info.startScroll
      const totalDy = dy + scroll

      setDragDeltaY(totalDy)

      const deltaMins = Math.round((totalDy / HOUR_HEIGHT) * 60 / 15) * 15
      const newMin = Math.max(0, Math.min(23 * 60 + 45, info.originalMin + deltaMins))
      setDragTimeLabel(formatTimeKorean(minutesToTime(newMin)))
    }

    const handleDocEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0]
      const dy = touch.clientY - info.startY
      const scroll = (gridRef.current?.closest('.day-view-timeline-scroll')?.scrollTop || 0) - info.startScroll
      const totalDy = dy + scroll
      const deltaMins = Math.round((totalDy / HOUR_HEIGHT) * 60 / 15) * 15

      if (Math.abs(deltaMins) >= 15) {
        // Dragged enough → update time
        const newMin = Math.max(0, Math.min(23 * 60 + 45, info.originalMin + deltaMins))
        const newTime = minutesToTime(newMin)

        if (info.type === 'event') {
          const ev = eventsRef.current.find((e) => e.id === info.id)
          if (ev?.startTime) {
            const duration = ev.endTime ? timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime) : 60
            updateEvent(info.id, {
              startTime: newTime,
              endTime: minutesToTime(Math.min(23 * 60 + 59, newMin + duration)),
            })
          }
        } else {
          updateTask(info.id, { dueTime: newTime })
        }
      } else {
        // No drag → show action bar
        const rect = info.element.getBoundingClientRect()
        const bw = 160
        let bt = rect.bottom + 8
        let bl = rect.left + rect.width / 2
        if (bt + 44 > window.innerHeight - 80) bt = rect.top - 52
        bl = Math.max(bw / 2 + 8, Math.min(bl, window.innerWidth - bw / 2 - 8))
        setActionBar({ type: info.type, id: info.id, barTop: bt, barLeft: bl })
      }

      // Cleanup
      document.removeEventListener('touchmove', handleDocMove)
      document.removeEventListener('touchend', handleDocEnd)
      dragRef.current = null
      setDraggedId(null)
      setDragDeltaY(0)
      setDragTimeLabel('')
    }

    info.docMoveHandler = handleDocMove
    info.docEndHandler = handleDocEnd
    dragRef.current = info

    document.addEventListener('touchmove', handleDocMove, { passive: false })
    document.addEventListener('touchend', handleDocEnd)

    setDraggedId(id)
    setDragDeltaY(0)
    try { navigator.vibrate?.(25) } catch {}
  }, [])

  // Item touch handlers
  const makeItemHandlers = (type: 'event' | 'task', id: string, originalMin: number) => ({
    onTouchStart: (e: React.TouchEvent) => {
      if (actionBar) { setActionBar(null); return }
      lpTriggeredRef.current = false
      const el = e.currentTarget as HTMLElement
      const touch = e.touches[0]
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }

      lpTimerRef.current = setTimeout(() => {
        lpTriggeredRef.current = true
        startDragMode(type, id, el, originalMin, touch.clientY)
        lpTimerRef.current = null
      }, 500)
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (lpTimerRef.current) {
        const dx = e.touches[0].clientX - touchStartPosRef.current.x
        const dy = e.touches[0].clientY - touchStartPosRef.current.y
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          clearTimeout(lpTimerRef.current)
          lpTimerRef.current = null
        }
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (lpTimerRef.current) { clearTimeout(lpTimerRef.current); lpTimerRef.current = null }
      if (lpTriggeredRef.current) e.preventDefault()
    },
  })

  // Build event groups
  const allDayEvents = events.filter((e) => e.isAllDay)
  const timedEvents = events.filter((e) => !e.isAllDay && e.startTime)
    .sort((a, b) => timeToMinutes(a.startTime!) - timeToMinutes(b.startTime!))
  const completedRoutines = routines.filter((r) => r.isCompleted && r.checkedAt)

  const buildEventGroups = () => {
    const groupedTaskIds = new Set<string>()
    const groups = timedEvents.map((event) => {
      const eventCat = getCat(event.categoryId)
      const linkedTaskCatIds = new Set(
        categories.filter((c) => (c.type === 'task' || c.type === 'all') && c.eventCategoryId === event.categoryId).map((c) => c.id)
      )
      const startMin = timeToMinutes(event.startTime!)
      const endMin = event.endTime ? timeToMinutes(event.endTime) : startMin + 60
      const matchingTasks = tasks.filter((t) => {
        if (!t.categoryId || !linkedTaskCatIds.has(t.categoryId)) return false
        if (groupedTaskIds.has(t.id)) return false
        const taskTime = t.isCompleted && t.completedTime ? t.completedTime : t.dueTime
        if (!taskTime) return true
        const taskMin = timeToMinutes(taskTime)
        return taskMin >= startMin && taskMin <= endMin
      }).sort((a, b) => {
        const aTime = a.isCompleted && a.completedTime ? a.completedTime : a.dueTime || '99:99'
        const bTime = b.isCompleted && b.completedTime ? b.completedTime : b.dueTime || '99:99'
        return timeToMinutes(aTime) - timeToMinutes(bTime)
      })
      matchingTasks.forEach((t) => groupedTaskIds.add(t.id))
      return { event, eventCat, tasks: matchingTasks }
    })
    const ungrouped = tasks.filter((t) => (t.dueTime || (t.isCompleted && t.completedTime)) && !groupedTaskIds.has(t.id))
    const untimedTasks = tasks.filter((t) => !t.dueTime && !(t.isCompleted && t.completedTime))
    return { groups, ungrouped, untimedTasks }
  }

  const { groups: eventGroups, ungrouped: ungroupedTasks, untimedTasks } = buildEventGroups()

  // Scroll position
  useEffect(() => {
    const scrollContainer = gridRef.current?.closest('.day-view-timeline-scroll')
    if (!scrollContainer) return
    let scrollHour = new Date().getHours() - 1
    if (timedEvents.length > 0) {
      scrollHour = Math.floor(timeToMinutes(timedEvents[0].startTime!) / 60) - 1
    }
    scrollContainer.scrollTop = Math.max(0, scrollHour * HOUR_HEIGHT)
  }, [events])

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

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const hasContent = events.length > 0 || tasks.length > 0 || routines.length > 0

  return (
    <div className="timeline">
      {/* 종일 이벤트 */}
      {allDayEvents.length > 0 && (
        <div className="tl-allday">
          {allDayEvents.map((event) => {
            const cat = getCat(event.categoryId)
            return (
              <div
                key={event.id}
                className={`tl-allday-item ${actionBar?.id === event.id ? 'tl-selected' : ''}`}
                onClick={() => { if (!actionBar && !draggedId) onEditEvent(event) }}
                style={{ borderLeftColor: cat?.color || '#64B5F6', background: cat ? `${cat.color}22` : 'rgba(100,181,246,0.1)' }}
              >
                <span className="tl-allday-title">
                  {(!event.title || event.title === '(제목 없음)') ? (cat ? `${cat.icon} ${cat.name}` : '') : event.title}
                </span>
                {event.location && <span className="tl-allday-loc">{event.location}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* 시간 없는 태스크 */}
      {untimedTasks.length > 0 && (
        <div className="tl-untimed">
          {untimedTasks.map((task) => (
            <div
              key={task.id}
              className={`tl-untimed-task ${actionBar?.id === task.id ? 'tl-selected' : ''}`}
              onClick={() => { if (!actionBar && !draggedId) onEditTask(task) }}
            >
              <button
                className={`tl-task-check ${task.isCompleted ? 'done' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate) }}
              >
                {task.isCompleted && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className={`tl-untimed-title ${task.isCompleted ? 'tl-done' : ''}`}>{task.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* 타임라인 그리드 */}
      <div className="tl-grid" ref={gridRef}>
        <div className="tl-grid-inner" style={{ height: 24 * HOUR_HEIGHT }}>
          {hours.map((h) => (
            <div key={h} className="tl-hour-row" style={{ top: h * HOUR_HEIGHT }}>
              <span className="tl-hour-label">{getHourLabel(h)}</span>
              <div className="tl-hour-line" />
            </div>
          ))}

          {/* 이벤트 블록 */}
          {eventGroups.map(({ event, eventCat, tasks: groupTasks }) => {
            const startMin = timeToMinutes(event.startTime!)
            const endMin = event.endTime ? timeToMinutes(event.endTime) : startMin + 60
            const top = (startMin / 60) * HOUR_HEIGHT
            const baseHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT
            const taskRowHeight = groupTasks.length * 36
            const headerHeight = 52
            const minHeight = Math.max(baseHeight, headerHeight + taskRowHeight)
            const color = eventCat?.color || '#64B5F6'
            const isDragging = draggedId === event.id
            const handlers = makeItemHandlers('event', event.id, startMin)

            return (
              <div
                key={event.id}
                className={`tl-event-block ${isDragging ? 'tl-dragging' : ''} ${actionBar?.id === event.id ? 'tl-selected' : ''}`}
                style={{
                  top,
                  minHeight,
                  borderLeftColor: color,
                  background: `${color}22`,
                  ...(isDragging ? { transform: `translateY(${dragDeltaY}px)`, zIndex: 100 } : {}),
                }}
              >
                <div className="tl-event-header" onClick={() => { if (!actionBar && !draggedId) onEditEvent(event) }} {...handlers}>
                  <div className="tl-event-header-top">
                    <span className="tl-event-cat-icon">{eventCat?.icon || ''}</span>
                    <span className="tl-event-cat-name">{eventCat?.name || event.title}</span>
                    {event.title && event.title !== '(제목 없음)' && (
                      <span className="tl-event-title-right">{event.title}</span>
                    )}
                  </div>
                  <span className="tl-event-time">
                    {isDragging && dragTimeLabel ? dragTimeLabel : formatTimeKorean(event.startTime!)} ~ {event.endTime ? formatTimeKorean(event.endTime) : ''}
                  </span>
                </div>

                {groupTasks.length > 0 && (
                  <div className="tl-event-tasks">
                    {groupTasks.map((task) => {
                      const taskTime = task.isCompleted && task.completedTime ? task.completedTime : task.dueTime
                      const taskCat = getCat(task.categoryId)
                      const taskMin = taskTime ? timeToMinutes(taskTime) : startMin
                      const taskHandlers = makeItemHandlers('task', task.id, taskMin)

                      return (
                        <div
                          key={task.id}
                          className={`tl-nested-task ${actionBar?.id === task.id ? 'tl-selected' : ''}`}
                          onClick={() => { if (!actionBar && !draggedId) onEditTask(task) }}
                          {...taskHandlers}
                        >
                          <button
                            className={`tl-task-check ${task.isCompleted ? 'done' : ''}`}
                            onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate) }}
                          >
                            {task.isCompleted && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                          {taskTime && <span className="tl-nested-time">{formatTimeKorean(taskTime)}</span>}
                          {taskCat && <span className="tl-nested-cat">{taskCat.name}</span>}
                          <span className={`tl-nested-title ${task.isCompleted ? 'tl-done' : ''}`}>{task.title}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* 그룹 밖 태스크 */}
          {ungroupedTasks.map((task) => {
            const displayTime = task.isCompleted && task.completedTime ? task.completedTime : task.dueTime!
            const min = timeToMinutes(displayTime)
            const top = (min / 60) * HOUR_HEIGHT
            const cat = getCat(task.categoryId)
            const isDragging = draggedId === task.id
            const handlers = makeItemHandlers('task', task.id, min)

            return (
              <div
                key={task.id}
                className={`tl-task-row ${isDragging ? 'tl-dragging' : ''} ${actionBar?.id === task.id ? 'tl-selected' : ''}`}
                style={{
                  top,
                  ...(isDragging ? { transform: `translateY(${dragDeltaY}px)`, zIndex: 100 } : {}),
                }}
                onClick={() => { if (!actionBar && !draggedId) onEditTask(task) }}
                {...handlers}
              >
                <button
                  className={`tl-task-check ${task.isCompleted ? 'done' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate) }}
                >
                  {task.isCompleted && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className={`tl-task-title ${task.isCompleted ? 'tl-done' : ''}`}>{task.title}</span>
                {cat && <span className="tl-task-cat" style={{ background: cat.color }}>{cat.icon}</span>}
              </div>
            )
          })}

          {/* 완료된 루틴 */}
          {completedRoutines.map((routine) => {
            const d = routine.checkedAt!.toDate()
            const min = d.getHours() * 60 + d.getMinutes()
            const top = (min / 60) * HOUR_HEIGHT
            return (
              <div key={routine.id} className="tl-routine-row" style={{ top }}>
                <button className="tl-task-check done" onClick={() => toggleRoutineComplete(routine.id, routine.isCompleted)}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="tl-routine-icon" dangerouslySetInnerHTML={{ __html: ROUTINE_ICON_MAP[routine.iconId] || ROUTINE_ICON_MAP.stretch }} />
                <span className="tl-task-title tl-done">{routine.title}</span>
              </div>
            )
          })}
        </div>
      </div>

      {!hasContent && <p className="tl-empty">이 날의 일정과 할 일이 없습니다</p>}

      {/* Action bar (수정/삭제) */}
      {actionBar && (
        <>
          <div className="tl-action-overlay" onClick={closeActionBar} onTouchStart={closeActionBar} />
          <div
            className="tl-action-bar"
            style={{ top: actionBar.barTop, left: actionBar.barLeft }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <button className="action-bar-btn" onClick={handleEdit}>수정</button>
            <button className="action-bar-btn action-delete" onClick={handleDelete}>삭제</button>
          </div>
        </>
      )}

      {/* 드래그 시간 표시 */}
      {draggedId && dragTimeLabel && (
        <div className="tl-drag-time-badge">
          {dragTimeLabel}
        </div>
      )}
    </div>
  )
}
