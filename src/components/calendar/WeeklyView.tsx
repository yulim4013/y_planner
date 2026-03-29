import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  format,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { toggleTaskComplete, toggleSubItem } from '../../services/taskService'
import { PRIORITY_LABELS } from '../../utils/constants'
import type { CalendarEvent, Task } from '../../types'
import './WeeklyView.css'

interface WeeklyViewProps {
  currentDate: Date
  events: CalendarEvent[]
  tasks: Task[]
  onEditEvent: (event: CalendarEvent) => void
  onEditTask: (task: Task) => void
}

export default function WeeklyView({ currentDate, events, tasks, onEditEvent, onEditTask }: WeeklyViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  function getEventsForDay(day: Date) {
    return events.filter((e) => {
      const start = e.startDate.toDate()
      const end = e.endDate.toDate()
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      return day >= start && day <= end
    })
  }

  function getTasksForDay(day: Date) {
    return tasks.filter((t) => t.dueDate && isSameDay(t.dueDate.toDate(), day))
  }

  return (
    <div className="weekly-view">
      {days.map((day) => {
        const dayEvents = getEventsForDay(day)
        const dayTasks = getTasksForDay(day)
        const today = isToday(day)
        const dayOfWeek = day.getDay()

        if (dayEvents.length === 0 && dayTasks.length === 0) return null

        return (
          <div key={day.toISOString()} className={`week-day ${today ? 'week-today' : ''}`}>
            <div className="week-day-header">
              <span className={`week-day-name ${dayOfWeek === 0 ? 'sun' : dayOfWeek === 6 ? 'sat' : ''}`}>
                {format(day, 'EEE', { locale: ko })}
              </span>
              <span className={`week-day-num ${today ? 'today-num' : ''}`}>
                {format(day, 'd')}
              </span>
            </div>
            <div className="week-day-items">
              {dayEvents.map((event) => (
                <div key={event.id} className="week-event" onClick={() => onEditEvent(event)}>
                  <span className="week-event-dot" />
                  <span className="week-event-title">{event.title}</span>
                  {!event.isAllDay && event.startTime && (
                    <span className="week-event-time">{event.startTime}</span>
                  )}
                </div>
              ))}
              {dayTasks.map((task) => (
                <div key={task.id} className={`week-task ${task.isCompleted ? 'week-task-done' : ''}`}>
                  <button
                    className="week-task-check"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate)
                    }}
                  >
                    {task.isCompleted ? '☑' : '☐'}
                  </button>
                  <span className="week-task-title" onClick={() => onEditTask(task)}>{task.title}</span>
                  <span className={`week-task-pri priority-${task.priority}`}>
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                  {(task.subItems || []).length > 0 && (
                    <div className="week-task-subs">
                      {(task.subItems || []).map((item) => (
                        <div
                          key={item.id}
                          className={`week-sub ${item.isCompleted ? 'week-sub-done' : ''}`}
                          onClick={() => toggleSubItem(task.id, task.subItems || [], item.id, !!task.dueDate)}
                        >
                          <span>{item.isCompleted ? '☑' : '☐'}</span>
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
