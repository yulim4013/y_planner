import { useRef, useEffect, useState } from 'react'
import { toggleTaskComplete, deleteTask } from '../../services/taskService'
import { deleteEvent } from '../../services/eventService'
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

interface ContextMenuState {
  type: 'event' | 'task'
  id: string
  x: number
  y: number
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

function formatTimeKorean(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = m ? `:${String(m).padStart(2, '0')}` : ''
  if (h === 0) return `오전 12시${suffix}`
  if (h < 12) return `오전 ${h}시${suffix}`
  if (h === 12) return `오후 12시${suffix}`
  return `오후 ${h - 12}시${suffix}`
}

function createLongPressHandlers(callback: (e: React.PointerEvent | React.TouchEvent) => void, ms = 600) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0
  let triggered = false

  return {
    onTouchStart: (e: React.TouchEvent) => {
      triggered = false
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      timer = setTimeout(() => {
        triggered = true
        callback(e)
        timer = null
      }, ms)
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (timer) { clearTimeout(timer); timer = null }
      if (triggered) { e.preventDefault() }
    },
    onTouchMove: (e: React.TouchEvent) => {
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (timer) { clearTimeout(timer); timer = null }
      }
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      triggered = false
      startX = e.clientX
      startY = e.clientY
      timer = setTimeout(() => {
        triggered = true
        callback(e)
        timer = null
      }, ms)
    },
    onPointerUp: () => {
      if (timer) { clearTimeout(timer); timer = null }
    },
    onPointerLeave: () => {
      if (timer) { clearTimeout(timer); timer = null }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (timer) { clearTimeout(timer); timer = null }
      }
    },
  }
}

export default function TimelineView({ events, tasks, routines = [], categories = [], onEditEvent, onEditTask, onMoveItem }: TimelineViewProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const getCat = (id?: string | null) => id ? categories.find((c) => c.id === id) : null
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [contextMenu])

  const allDayEvents = events.filter((e) => e.isAllDay)
  const timedEvents = events.filter((e) => !e.isAllDay && e.startTime)
    .sort((a, b) => timeToMinutes(a.startTime!) - timeToMinutes(b.startTime!))

  // 루틴 - 완료된 것만 타임라인에 표시
  const completedRoutines = routines.filter((r) => r.isCompleted && r.checkedAt)

  // 이벤트 그룹에 포함될 태스크 찾기
  const buildEventGroups = () => {
    const groupedTaskIds = new Set<string>()

    const groups = timedEvents.map((event) => {
      const eventCat = getCat(event.categoryId)
      const linkedTaskCatIds = new Set(
        categories
          .filter((c) => (c.type === 'task' || c.type === 'all') && c.eventCategoryId === event.categoryId)
          .map((c) => c.id)
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

    const ungrouped = tasks.filter((t) =>
      (t.dueTime || (t.isCompleted && t.completedTime)) && !groupedTaskIds.has(t.id)
    )

    const untimedTasks = tasks.filter((t) => !t.dueTime && !(t.isCompleted && t.completedTime))

    return { groups, ungrouped, untimedTasks }
  }

  const { groups: eventGroups, ungrouped: ungroupedTasks, untimedTasks } = buildEventGroups()

  // 스크롤 위치
  useEffect(() => {
    // 부모 스크롤 컨테이너를 찾아서 스크롤
    const scrollContainer = gridRef.current?.closest('.day-view-timeline-scroll')
    if (!scrollContainer) return
    let scrollHour = new Date().getHours() - 1
    if (timedEvents.length > 0) {
      scrollHour = Math.floor(timeToMinutes(timedEvents[0].startTime!) / 60) - 1
    }
    scrollContainer.scrollTop = Math.max(0, scrollHour * HOUR_HEIGHT)
  }, [events])

  const handleLongPress = (type: 'event' | 'task', id: string, e: React.PointerEvent | React.TouchEvent) => {
    let x: number, y: number
    if ('touches' in e) {
      x = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0
      y = e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0
    } else {
      x = e.clientX
      y = e.clientY
    }
    x = Math.min(x, window.innerWidth - 140)
    y = Math.min(y, window.innerHeight - 80)
    setContextMenu({ type, id, x, y })
  }

  const handleDelete = async () => {
    if (!contextMenu) return
    if (contextMenu.type === 'event') {
      await deleteEvent(contextMenu.id)
    } else {
      await deleteTask(contextMenu.id)
    }
    setContextMenu(null)
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
            const lp = createLongPressHandlers((e) => handleLongPress('event', event.id, e))
            return (
              <div
                key={event.id}
                className="tl-allday-item"
                onClick={() => { if (!contextMenu) onEditEvent(event) }}
                style={{ borderLeftColor: cat?.color || '#64B5F6', background: cat ? `${cat.color}22` : 'rgba(100,181,246,0.1)' }}
                {...lp}
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
          {untimedTasks.map((task) => {
            const lp = createLongPressHandlers((e) => handleLongPress('task', task.id, e))
            return (
              <div key={task.id} className="tl-untimed-task" onClick={() => { if (!contextMenu) onEditTask(task) }} {...lp}>
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
            )
          })}
        </div>
      )}

      {/* 타임라인 그리드 */}
      <div className="tl-grid" ref={gridRef}>
        <div className="tl-grid-inner" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* 시간 행 */}
          {hours.map((h) => (
            <div key={h} className="tl-hour-row" style={{ top: h * HOUR_HEIGHT }}>
              <span className="tl-hour-label">{getHourLabel(h)}</span>
              <div className="tl-hour-line" />
            </div>
          ))}

          {/* 이벤트 블록 (카테고리 헤더 + 중첩 태스크) */}
          {eventGroups.map(({ event, eventCat, tasks: groupTasks }) => {
            const startMin = timeToMinutes(event.startTime!)
            const endMin = event.endTime ? timeToMinutes(event.endTime) : startMin + 60
            const top = (startMin / 60) * HOUR_HEIGHT
            const baseHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT
            const taskRowHeight = groupTasks.length * 36
            const headerHeight = 52
            const minHeight = Math.max(baseHeight, headerHeight + taskRowHeight)
            const color = eventCat?.color || '#64B5F6'

            const lp = createLongPressHandlers((e) => handleLongPress('event', event.id, e))

            return (
              <div
                key={event.id}
                className="tl-event-block"
                style={{
                  top,
                  minHeight,
                  borderLeftColor: color,
                  background: `${color}22`,
                }}
              >
                <div className="tl-event-header" onClick={() => { if (!contextMenu) onEditEvent(event) }} {...lp}>
                  <div className="tl-event-header-top">
                    <span className="tl-event-cat-icon">{eventCat?.icon || ''}</span>
                    <span className="tl-event-cat-name">{eventCat?.name || event.title}</span>
                    {event.title && event.title !== '(제목 없음)' && (
                      <span className="tl-event-title-right">{event.title}</span>
                    )}
                  </div>
                  <span className="tl-event-time">
                    {formatTimeKorean(event.startTime!)} ~ {event.endTime ? formatTimeKorean(event.endTime) : ''}
                  </span>
                </div>

                {groupTasks.length > 0 && (
                  <div className="tl-event-tasks">
                    {groupTasks.map((task) => {
                      const taskTime = task.isCompleted && task.completedTime ? task.completedTime : task.dueTime
                      const taskCat = getCat(task.categoryId)
                      const taskLp = createLongPressHandlers((e) => handleLongPress('task', task.id, e))

                      return (
                        <div key={task.id} className="tl-nested-task" onClick={() => { if (!contextMenu) onEditTask(task) }} {...taskLp}>
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
                          {taskTime && (
                            <span className="tl-nested-time">{formatTimeKorean(taskTime)}</span>
                          )}
                          {taskCat && (
                            <span className="tl-nested-cat">{taskCat.name}</span>
                          )}
                          <span className={`tl-nested-title ${task.isCompleted ? 'tl-done' : ''}`}>
                            {task.title}
                          </span>
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
            const lp = createLongPressHandlers((e) => handleLongPress('task', task.id, e))

            return (
              <div
                key={task.id}
                className="tl-task-row"
                style={{ top }}
                onClick={() => { if (!contextMenu) onEditTask(task) }}
                {...lp}
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

          {/* 완료된 루틴 (체크 시간에 배치) */}
          {completedRoutines.map((routine) => {
            const d = routine.checkedAt!.toDate()
            const min = d.getHours() * 60 + d.getMinutes()
            const top = (min / 60) * HOUR_HEIGHT

            return (
              <div
                key={routine.id}
                className="tl-routine-row"
                style={{ top }}
              >
                <button
                  className="tl-task-check done"
                  onClick={() => toggleRoutineComplete(routine.id, routine.isCompleted)}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span
                  className="tl-routine-icon"
                  dangerouslySetInnerHTML={{ __html: ROUTINE_ICON_MAP[routine.iconId] || ROUTINE_ICON_MAP.stretch }}
                />
                <span className="tl-task-title tl-done">{routine.title}</span>
              </div>
            )
          })}
        </div>
      </div>

      {!hasContent && (
        <p className="tl-empty">이 날의 일정과 할 일이 없습니다</p>
      )}

      {/* 꾹 눌러서 나오는 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="tl-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button className="ctx-menu-item ctx-delete" onClick={handleDelete}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
            삭제
          </button>
          {onMoveItem && (
            <button className="ctx-menu-item" onClick={() => {
              if (contextMenu && onMoveItem) {
                onMoveItem(contextMenu.type, contextMenu.id)
              }
              setContextMenu(null)
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="3" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <path d="M12 13l3 3-3 3" />
                <line x1="8" y1="16" x2="15" y2="16" />
              </svg>
              날짜 이동
            </button>
          )}
        </div>
      )}
    </div>
  )
}
