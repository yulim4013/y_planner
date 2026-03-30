import { useState, useEffect, useRef, useCallback } from 'react'
import {
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
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
import { subscribeSleepForDate, calculateSleepDuration } from '../../services/sleepService'
import { getMonthYear } from '../../utils/dateUtils'
import type { CalendarEvent, Task, Category, Routine, Transaction, SleepRecord } from '../../types'
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
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([])

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

  // Subscribe to routines and sleep for selected date
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')
  useEffect(() => {
    const unsub = subscribeRoutinesByDate(selectedDateStr, setRoutines)
    const unsubSleep = subscribeSleepForDate(selectedDateStr, setSleepRecords)
    return () => { unsub(); unsubSleep() }
  }, [selectedDateStr])

  const sleepInfo = calculateSleepDuration(sleepRecords, selectedDateStr)

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

  // 스와이프 공통 (주간 스트립 + 월간 뷰)
  const swipeRef = useRef<{ startX: number; startY: number; decided: boolean; isHorizontal: boolean } | null>(null)
  const [stripOffset, setStripOffset] = useState(0)
  const [stripAnimating, setStripAnimating] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)
  const [monthAnimating, setMonthAnimating] = useState(false)

  const handleStripTouchStart = useCallback((e: React.TouchEvent) => {
    setStripAnimating(false)
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, decided: false, isHorizontal: false }
  }, [])

  const handleStripTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current) return
    const dx = e.touches[0].clientX - swipeRef.current.startX
    const dy = e.touches[0].clientY - swipeRef.current.startY
    if (!swipeRef.current.decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipeRef.current.decided = true
      swipeRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy)
    }
    if (swipeRef.current.isHorizontal) {
      setStripOffset(dx)
    }
  }, [])

  const handleStripTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current) return
    const dx = e.changedTouches[0].clientX - swipeRef.current.startX
    const isHoriz = swipeRef.current.isHorizontal
    swipeRef.current = null

    if (isHoriz && Math.abs(dx) > 50) {
      setStripAnimating(true)
      setStripOffset(dx > 0 ? window.innerWidth : -window.innerWidth)
      setTimeout(() => {
        if (dx > 0) setSelectedDate((d) => subWeeks(d, 1))
        else setSelectedDate((d) => addWeeks(d, 1))
        setStripOffset(0)
        setStripAnimating(false)
      }, 350)
    } else {
      setStripAnimating(true)
      setStripOffset(0)
      setTimeout(() => setStripAnimating(false), 350)
    }
  }, [])

  // 월간 뷰 스와이프
  const monthSwipeRef = useRef<{ startX: number; startY: number; decided: boolean; isHorizontal: boolean } | null>(null)

  const handleMonthTouchStart = useCallback((e: React.TouchEvent) => {
    setMonthAnimating(false)
    monthSwipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, decided: false, isHorizontal: false }
  }, [])

  const handleMonthTouchMove = useCallback((e: React.TouchEvent) => {
    if (!monthSwipeRef.current) return
    const dx = e.touches[0].clientX - monthSwipeRef.current.startX
    const dy = e.touches[0].clientY - monthSwipeRef.current.startY
    if (!monthSwipeRef.current.decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      monthSwipeRef.current.decided = true
      monthSwipeRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy)
    }
    if (monthSwipeRef.current.isHorizontal) {
      setMonthOffset(dx)
    }
  }, [])

  const handleMonthTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!monthSwipeRef.current) return
    const dx = e.changedTouches[0].clientX - monthSwipeRef.current.startX
    const isHoriz = monthSwipeRef.current.isHorizontal
    monthSwipeRef.current = null

    if (isHoriz && Math.abs(dx) > 50) {
      setMonthAnimating(true)
      setMonthOffset(dx > 0 ? window.innerWidth : -window.innerWidth)
      setTimeout(() => {
        if (dx > 0) setCurrentDate((d) => subMonths(d, 1))
        else setCurrentDate((d) => addMonths(d, 1))
        setMonthOffset(0)
        setMonthAnimating(false)
      }, 350)
    } else {
      setMonthAnimating(true)
      setMonthOffset(0)
      setTimeout(() => setMonthAnimating(false), 350)
    }
  }, [])

  const handleGoToday = useCallback(() => {
    setSelectedDate(new Date())
    setCurrentDate(new Date())
  }, [])

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

  const [defaultStartTime, setDefaultStartTime] = useState<string | undefined>()

  const handleAddEvent = () => {
    setDefaultStartTime(undefined)
    setEditEvent(null)
    setEventFormOpen(true)
    setShowAddPicker(false)
  }

  const handleAddTask = () => {
    setEditTask(null)
    setTaskFormOpen(true)
    setShowAddPicker(false)
  }

  const handleAddEventAtTime = (startTime: string) => {
    setDefaultStartTime(startTime)
    setEditEvent(null)
    setEventFormOpen(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setDefaultStartTime(undefined)
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
    <div className={`page ${view === 'day' ? 'page-fixed' : ''}`}>
      <Header title="CALENDAR" right={
        <div className="cal-add-wrapper">
          <button className="header-add-btn" onClick={() => setShowAddPicker(!showAddPicker)}>+</button>
          {showAddPicker && (
            <>
              <div className="cal-add-overlay" onClick={() => setShowAddPicker(false)} />
              <div className="cal-add-picker">
                <button className="cal-add-option" onClick={handleAddEvent}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  일정 추가
                </button>
                <button className="cal-add-option" onClick={handleAddTask}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                  할 일 추가
                </button>
              </div>
            </>
          )}
        </div>
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
        <button className="cal-today-btn" onClick={handleGoToday}>오늘</button>
      </div>

      {view === 'month' && (
        <div className="cal-desktop-row">
          <GlassCard>
            <div
              onTouchStart={handleMonthTouchStart}
              onTouchMove={handleMonthTouchMove}
              onTouchEnd={handleMonthTouchEnd}
              style={{
                transform: monthOffset ? `translateX(${monthOffset}px)` : undefined,
                transition: monthAnimating ? 'transform 0.35s ease-out' : 'none',
              }}
            >
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
            </div>
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
        </div>
      )}

      {view === 'day' && (
        <div className="day-view-layout">
          {/* 고정 헤더 영역 */}
          <div className="day-view-header-pinned">
            {/* iPhone-style week strip */}
            <div
              className="week-strip"
              onTouchStart={handleStripTouchStart}
              onTouchMove={handleStripTouchMove}
              onTouchEnd={handleStripTouchEnd}
            >
              <div className="week-strip-header">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <div key={d} className={`ws-weekday ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>{d}</div>
                ))}
              </div>
              <div
                className="week-strip-days"
                style={{
                  transform: stripOffset ? `translateX(${stripOffset}px)` : undefined,
                  transition: stripAnimating ? 'transform 0.35s ease-out' : 'none',
                }}
              >
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
              sleepInfo={sleepInfo}
              onEditEvent={handleEditEvent}
              onEditTask={handleEditTask}
              onAddEventAtTime={handleAddEventAtTime}
              onSwipePrev={() => setSelectedDate((d) => subDays(d, 1))}
              onSwipeNext={() => setSelectedDate((d) => addDays(d, 1))}
            />
          </div>
        </div>
      )}

      <EventForm
        isOpen={eventFormOpen}
        onClose={() => { setEventFormOpen(false); setEditEvent(null); setDefaultStartTime(undefined) }}
        editEvent={editEvent}
        defaultDate={selectedDate}
        defaultStartTime={defaultStartTime}
      />

      <TaskForm
        isOpen={taskFormOpen}
        onClose={() => { setTaskFormOpen(false); setEditTask(null) }}
        editTask={editTask}
      />
    </div>
  )
}
