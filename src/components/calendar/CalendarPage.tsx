import { useState, useEffect } from 'react'
import {
  addMonths, subMonths, addWeeks, subWeeks,
  isSameDay, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isToday,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { Timestamp } from 'firebase/firestore'
import Header from '../layout/Header'
import GlassCard from '../common/GlassCard'
import MonthlyView from './MonthlyView'
import DailyView from './DailyView'
import TimelineView from './TimelineView'
import EventForm from './EventForm'
import TaskForm from '../tasks/TaskForm'
import { subscribeEvents, updateEvent } from '../../services/eventService'
import { subscribeTasks, updateTask } from '../../services/taskService'
import { subscribeCategories } from '../../services/categoryService'
import { subscribeRoutinesByDate } from '../../services/routineService'
import { subscribeTransactionsByMonth } from '../../services/budgetService'
import { getMonthYear } from '../../utils/dateUtils'
import type { CalendarEvent, Task, Category, Routine, Transaction } from '../../types'
import './CalendarPage.css'

type ViewType = 'month' | 'day'

export default function CalendarPage() {
  const [view, setView] = useState<ViewType>('day')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [movingItem, setMovingItem] = useState<{ type: 'task' | 'event'; id: string } | null>(null)

  // Current month string for transactions
  const currentMonthStr = format(currentDate, 'yyyy-MM')

  useEffect(() => {
    const unsubEvents = subscribeEvents(setEvents)
    const unsubTasks = subscribeTasks(setTasks)
    const unsubCats = subscribeCategories(setCategories)
    return () => { unsubEvents(); unsubTasks(); unsubCats() }
  }, [])

  useEffect(() => {
    const unsub = subscribeTransactionsByMonth(currentMonthStr, setTransactions)
    return unsub
  }, [currentMonthStr])

  // Subscribe to routines for selected date
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  useEffect(() => {
    const unsub = subscribeRoutinesByDate(selectedDateStr, setRoutines)
    return () => unsub()
  }, [selectedDateStr])

  const dayEvents = events.filter((e) => {
    const start = e.startDate.toDate()
    const end = e.endDate.toDate()
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return selectedDate >= start && selectedDate <= end
  })

  const dayTasks = tasks.filter((t) => {
    if (!t.dueDate) return false
    return isSameDay(t.dueDate.toDate(), selectedDate)
  })

  // 일 뷰 주간 스트립
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const handlePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
    else setSelectedDate(subWeeks(selectedDate, 1))
  }

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else setSelectedDate(addWeeks(selectedDate, 1))
  }

  const getNavTitle = () => {
    if (view === 'month') return getMonthYear(currentDate)
    return format(selectedDate, 'yyyy년 M월', { locale: ko })
  }

  const handleAddEvent = () => {
    setEditEvent(null)
    setEventFormOpen(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setEditEvent(event)
    setEventFormOpen(true)
  }

  const handleEditTask = (task: Task) => {
    setEditTask(task)
    setTaskFormOpen(true)
  }

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date)
  }

  // 이동 모드
  const handleMoveItem = (type: 'task' | 'event', id: string) => {
    setMovingItem({ type, id })
  }

  const handleMoveToDate = async (targetDate: Date) => {
    if (!movingItem) return

    if (movingItem.type === 'task') {
      const newDate = new Date(targetDate)
      newDate.setHours(0, 0, 0, 0)
      await updateTask(movingItem.id, {
        dueDate: Timestamp.fromDate(newDate),
      })
    } else {
      const event = events.find((e) => e.id === movingItem.id)
      if (event) {
        const oldStart = event.startDate.toDate()
        const oldEnd = event.endDate.toDate()
        const diffMs = oldEnd.getTime() - oldStart.getTime()

        const newStart = new Date(targetDate)
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0)
        const newEnd = new Date(newStart.getTime() + diffMs)

        await updateEvent(movingItem.id, {
          startDate: Timestamp.fromDate(newStart),
          endDate: Timestamp.fromDate(newEnd),
        })
      }
    }

    setMovingItem(null)
    setSelectedDate(targetDate)
  }

  const handleCancelMove = () => {
    setMovingItem(null)
  }

  // 특정 날짜에 이벤트/태스크 있는지 확인 (dot 표시용)
  const hasDotForDay = (day: Date) => {
    const hasEvent = events.some((e) => {
      const s = e.startDate.toDate(); s.setHours(0,0,0,0)
      const en = e.endDate.toDate(); en.setHours(23,59,59,999)
      return day >= s && day <= en
    })
    const hasTask = tasks.some((t) => t.dueDate && isSameDay(t.dueDate.toDate(), day))
    return { hasEvent, hasTask }
  }

  // 이동 중인 아이템 이름
  const movingItemName = movingItem
    ? movingItem.type === 'task'
      ? tasks.find((t) => t.id === movingItem.id)?.title
      : events.find((e) => e.id === movingItem.id)?.title
    : null

  return (
    <div className="page">
      <Header title="CALENDAR" right={
        <button className="header-add-btn" onClick={handleAddEvent}>+</button>
      } />

      {/* 이동 모드 배너 */}
      {movingItem && (
        <div className="move-banner">
          <span className="move-banner-text">
            "{movingItemName}" 이동할 날짜를 선택하세요
          </span>
          <button className="move-cancel-btn" onClick={handleCancelMove}>
            취소
          </button>
        </div>
      )}

      <div className="cal-view-toggle">
        {(['month', 'day'] as const).map((v) => (
          <button
            key={v}
            className={`view-toggle-btn ${view === v ? 'active' : ''}`}
            onClick={() => setView(v)}
          >
            {v === 'month' ? '월' : '일'}
          </button>
        ))}
      </div>

      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={handlePrev}>&lt;</button>
        <span className="cal-nav-title">{getNavTitle()}</span>
        <button className="cal-nav-btn" onClick={handleNext}>&gt;</button>
      </div>

      {view === 'month' && (
        <>
          <GlassCard>
            <MonthlyView
              currentDate={currentDate}
              events={events}
              tasks={tasks}
              transactions={transactions}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              isMoving={!!movingItem}
              onMoveToDate={handleMoveToDate}
            />
          </GlassCard>
          <GlassCard className="cal-daily-card">
            <DailyView
              date={selectedDate}
              events={dayEvents}
              tasks={dayTasks}
              categories={categories}
              onEditEvent={handleEditEvent}
              onEditTask={handleEditTask}
              onMoveItem={handleMoveItem}
            />
          </GlassCard>
        </>
      )}

      {view === 'day' && (
        <div className="day-view-layout">
          {/* 고정 헤더 영역 */}
          <div className="day-view-header-pinned">
            {/* iPhone-style week strip */}
            <div className="week-strip">
              <div className="week-strip-header">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <div key={d} className={`ws-weekday ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>{d}</div>
                ))}
              </div>
              <div className="week-strip-days">
                {weekDays.map((day) => {
                  const selected = isSameDay(day, selectedDate)
                  const today = isToday(day)
                  const dayOfWeek = day.getDay()
                  const dots = hasDotForDay(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={`ws-day ${selected ? 'ws-selected' : ''} ${today ? 'ws-today' : ''}`}
                      onClick={() => setSelectedDate(day)}
                    >
                      <span className={`ws-num ${dayOfWeek === 0 ? 'sun' : dayOfWeek === 6 ? 'sat' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      <div className="ws-dots">
                        {dots.hasEvent && <span className="ws-dot ws-dot-event" />}
                        {dots.hasTask && <span className="ws-dot ws-dot-task" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="day-view-date-label">
              {format(selectedDate, 'yyyy년 M월 d일 EEEE', { locale: ko })}
            </div>
          </div>

          {/* 타임라인 - 스크롤 영역 */}
          <div className="day-view-timeline-scroll">
            <TimelineView
              events={dayEvents}
              tasks={dayTasks}
              routines={routines}
              categories={categories}
              onEditEvent={handleEditEvent}
              onEditTask={handleEditTask}
            />
          </div>
        </div>
      )}

      <EventForm
        isOpen={eventFormOpen}
        onClose={() => { setEventFormOpen(false); setEditEvent(null) }}
        editEvent={editEvent}
        defaultDate={selectedDate}
      />

      <TaskForm
        isOpen={taskFormOpen}
        onClose={() => { setTaskFormOpen(false); setEditTask(null) }}
        editTask={editTask}
      />
    </div>
  )
}
