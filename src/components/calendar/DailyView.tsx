import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toggleTaskComplete, toggleSubItem } from '../../services/taskService'
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

// 롱프레스 핸들러 (훅이 아닌 일반 함수 - .map() 안에서 안전하게 사용 가능)
function createLongPressHandlers(callback: () => void, ms = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0

  return {
    onPointerDown: (e: React.PointerEvent) => {
      startX = e.clientX
      startY = e.clientY
      timer = setTimeout(() => {
        callback()
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
      // 10px 이상 움직여야 취소 (모바일 터치 떨림 방지)
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (timer) { clearTimeout(timer); timer = null }
      }
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
  const [longPressId, setLongPressId] = useState<string | null>(null)

  const sortedEvents = [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    const aTime = a.startTime || ''
    const bTime = b.startTime || ''
    return aTime.localeCompare(bTime)
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
            const lp = onMoveItem ? createLongPressHandlers(() => {
              setLongPressId(event.id)
              onMoveItem('event', event.id)
            }) : {}
            return (
              <div
                key={event.id}
                className={`daily-event ${longPressId === event.id ? 'dragging' : ''}`}
                onClick={() => onEditEvent(event)}
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
            const taskLp = onMoveItem ? createLongPressHandlers(() => {
              setLongPressId(task.id)
              onMoveItem('task', task.id)
            }) : {}
            return (
              <div key={task.id} className={`daily-task ${task.isCompleted ? 'daily-task-done' : ''} ${longPressId === task.id ? 'dragging' : ''}`}>
                <div
                  className="daily-task-header"
                  onClick={() => onEditTask(task)}
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
    </div>
  )
}
