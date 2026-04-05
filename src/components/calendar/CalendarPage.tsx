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
import WeeklyView from './WeeklyView'
import EventForm from './EventForm'
import TaskForm from '../tasks/TaskForm'
import { subscribeEvents, updateEvent, deleteEvent as deleteEventService, addEvent } from '../../services/eventService'
import { subscribeTasks, updateTask, deleteTask as deleteTaskService, addTask } from '../../services/taskService'
import { subscribeCategories } from '../../services/categoryService'
import { subscribeRoutinesByDate } from '../../services/routineService'
import { subscribeTransactionsByMonth } from '../../services/budgetService'
import { subscribeSleepForDate, calculateSleepDuration } from '../../services/sleepService'
import { getMonthYear } from '../../utils/dateUtils'
import { matchesRepeatDate } from '../../utils/repeatUtils'
import type { CalendarEvent, Task, Category, Routine, Transaction, SleepRecord } from '../../types'
import './CalendarPage.css'

type ViewType = 'month' | 'day' | 'week'

export default function CalendarPage() {
  const [view, setView] = useState<ViewType>(() => {
    const saved = localStorage.getItem('calendarView')
    return saved && ['month', 'day', 'week'].includes(saved) ? saved as ViewType : 'day'
  })
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
  const [selectedItem, setSelectedItem] = useState<{ type: 'event' | 'task'; id: string } | null>(null)
  const [copiedItem, setCopiedItem] = useState<{ type: 'event' | 'task'; data: CalendarEvent | Task } | null>(null)
  const [ymPickerOpen, setYmPickerOpen] = useState(false)

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
    // 원본 날짜 매칭
    if (selectedDate >= start && selectedDate <= end) return true
    // 반복 일정 매칭
    return matchesRepeatDate(start, selectedDate, e.repeat, e.repeatEndDate)
  })

  const dayTasks = tasks.filter((t) => {
    if (!t.dueDate) return false
    // 원본 날짜 매칭
    if (isSameDay(t.dueDate.toDate(), selectedDate)) return true
    // 반복 태스크 매칭 (완료되지 않은 반복 태스크만)
    if (t.repeat && t.repeat !== 'none' && !t.isCompleted) {
      return matchesRepeatDate(t.dueDate.toDate(), selectedDate, t.repeat, t.repeatEndDate)
    }
    return false
  })

  // 일 뷰 주간 스트립
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  // 스와이프용 인접 주간 (이전/다음)
  const adjWeekDays = (() => {
    const adjStart = startOfWeek(addDays(selectedDate, 7), { weekStartsOn: 0 })
    const adjEnd = endOfWeek(adjStart, { weekStartsOn: 0 })
    return {
      prev: eachDayOfInterval({ start: subDays(weekStart, 7), end: subDays(weekEnd, 7) }),
      next: eachDayOfInterval({ start: adjStart, end: adjEnd }),
    }
  })()

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
      const target = e.currentTarget as HTMLElement
      const width = target?.clientWidth || window.innerWidth
      setStripAnimating(true)
      setStripOffset(dx > 0 ? width : -width)
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
      const target = e.currentTarget as HTMLElement
      const width = target?.clientWidth || window.innerWidth
      setMonthAnimating(true)
      setMonthOffset(dx > 0 ? width : -width)
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
    else if (view === 'week') setSelectedDate(subWeeks(selectedDate, 1))
    else setSelectedDate(subWeeks(selectedDate, 1))
  }

  const handleNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
    else if (view === 'week') setSelectedDate(addWeeks(selectedDate, 1))
    else setSelectedDate(addWeeks(selectedDate, 1))
  }

  const getNavTitle = () => {
    if (view === 'month') return getMonthYear(currentDate)
    return format(selectedDate, 'yyyy년 M월', { locale: ko })
  }

  // Weekly view: add event at specific time on a specific day
  const handleAddEventAtTimeForDay = (date: Date, startTime: string) => {
    setSelectedDate(date)
    setDefaultStartTime(startTime)
    setEditEvent(null)
    setEventFormOpen(true)
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

  // 키보드 단축키: Backspace(삭제), Cmd+C(복사), Cmd+V(붙여넣기), Esc(선택 해제)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc → 선택 해제 (폼이 열려있으면 폼이 처리)
      if (e.key === 'Escape') {
        if (!eventFormOpen && !taskFormOpen) {
          setSelectedItem(null)
        }
        return
      }

      // 폼이 열려있으면 단축키 무시
      if (eventFormOpen || taskFormOpen) return

      // Backspace/Delete → 선택된 아이템 삭제
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedItem) {
        e.preventDefault()
        const itemTitle = selectedItem.type === 'task'
          ? tasks.find((t) => t.id === selectedItem.id)?.title
          : events.find((ev) => ev.id === selectedItem.id)?.title
        if (confirm(`"${itemTitle}" 삭제하시겠습니까?`)) {
          if (selectedItem.type === 'task') deleteTaskService(selectedItem.id)
          else deleteEventService(selectedItem.id)
        }
        setSelectedItem(null)
        return
      }

      // Cmd+C / Ctrl+C → 복사
      if (e.key === 'c' && (e.metaKey || e.ctrlKey) && selectedItem) {
        e.preventDefault()
        if (selectedItem.type === 'event') {
          const ev = events.find((e) => e.id === selectedItem.id)
          if (ev) setCopiedItem({ type: 'event', data: ev })
        } else {
          const t = tasks.find((t) => t.id === selectedItem.id)
          if (t) setCopiedItem({ type: 'task', data: t })
        }
        return
      }

      // Cmd+V / Ctrl+V → 붙여넣기
      if (e.key === 'v' && (e.metaKey || e.ctrlKey) && copiedItem) {
        e.preventDefault()
        if (copiedItem.type === 'event') {
          const src = copiedItem.data as CalendarEvent
          addEvent({
            title: src.title,
            description: src.description || '',
            startDate: new Date(selectedDate),
            endDate: new Date(selectedDate),
            startTime: src.startTime || null,
            endTime: src.endTime || null,
            isAllDay: src.isAllDay,
            categoryId: src.categoryId || null,
            location: src.location || '',
            reminder: src.reminder ?? null,
            repeat: 'none',
            repeatEndDate: null,
          })
        } else {
          const src = copiedItem.data as Task
          addTask({
            title: src.title,
            description: src.description || '',
            dueDate: new Date(selectedDate),
            dueTime: src.dueTime || null,
            priority: src.priority || 'medium',
            categoryId: src.categoryId || null,
            reminder: src.reminder ?? null,
            repeat: 'none',
            repeatEndDate: null,
          })
        }
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem, copiedItem, eventFormOpen, taskFormOpen, events, tasks, selectedDate])

  // 선택 핸들러
  const handleSelectItem = useCallback((type: 'event' | 'task', id: string) => {
    setSelectedItem((prev) => prev?.id === id ? null : { type, id })
  }, [])

  // 이동 중인 아이템 이름
  const movingItemName = movingItem
    ? movingItem.type === 'task'
      ? tasks.find((t) => t.id === movingItem.id)?.title
      : events.find((e) => e.id === movingItem.id)?.title
    : null

  return (
    <div className={`page ${view === 'day' || view === 'week' ? 'page-fixed' : ''}`}>
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
            onClick={() => { setView(v); localStorage.setItem('calendarView', v) }}
          >
            {v === 'month' ? '월' : '일'}
          </button>
        ))}
        <button
          className={`view-toggle-btn view-toggle-week ${view === 'week' ? 'active' : ''}`}
          onClick={() => { setView('week'); localStorage.setItem('calendarView', 'week') }}
        >
          주
        </button>
      </div>

      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={handlePrev}>&lt;</button>
        <button
          className="cal-nav-title cal-nav-title-btn"
          onClick={() => setYmPickerOpen(true)}
          type="button"
        >
          {getNavTitle()}
        </button>
        <button className="cal-nav-btn" onClick={handleNext}>&gt;</button>
        <button className="cal-today-btn" onClick={handleGoToday}>오늘</button>
      </div>

      {ymPickerOpen && (
        <>
          <div className="ym-picker-overlay" onClick={() => setYmPickerOpen(false)} />
          <div className="ym-picker">
            <div className="ym-picker-header">
              <button
                className="ym-picker-nav"
                onClick={() => {
                  const d = view === 'month' ? currentDate : selectedDate
                  const newDate = new Date(d.getFullYear() - 1, d.getMonth(), 1)
                  if (view === 'month') setCurrentDate(newDate)
                  else { setSelectedDate(newDate); setCurrentDate(newDate) }
                }}
                type="button"
              >&lt;</button>
              <span className="ym-picker-year">
                {(view === 'month' ? currentDate : selectedDate).getFullYear()}년
              </span>
              <button
                className="ym-picker-nav"
                onClick={() => {
                  const d = view === 'month' ? currentDate : selectedDate
                  const newDate = new Date(d.getFullYear() + 1, d.getMonth(), 1)
                  if (view === 'month') setCurrentDate(newDate)
                  else { setSelectedDate(newDate); setCurrentDate(newDate) }
                }}
                type="button"
              >&gt;</button>
            </div>
            <div className="ym-picker-grid">
              {Array.from({ length: 12 }, (_, i) => i).map((m) => {
                const activeDate = view === 'month' ? currentDate : selectedDate
                const isSelected = activeDate.getMonth() === m
                return (
                  <button
                    key={m}
                    className={`ym-picker-month ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      const newDate = new Date(activeDate.getFullYear(), m, 1)
                      if (view === 'month') setCurrentDate(newDate)
                      else { setSelectedDate(newDate); setCurrentDate(newDate) }
                      setYmPickerOpen(false)
                    }}
                    type="button"
                  >
                    {m + 1}월
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {view === 'month' && (
        <div className="cal-desktop-row">
          <GlassCard>
            <div
              className="month-swipe-frame"
              onTouchStart={handleMonthTouchStart}
              onTouchMove={handleMonthTouchMove}
              onTouchEnd={handleMonthTouchEnd}
            >
              <div
                className="month-swipe-slide"
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
              {(monthOffset !== 0 || monthAnimating) && (
                <div
                  className="month-swipe-adjacent"
                  style={{
                    transform: `translateX(${monthOffset > 0 ? 'calc(-100% + ' + monthOffset + 'px)' : 'calc(100% + ' + monthOffset + 'px)'})`,
                    transition: monthAnimating ? 'transform 0.35s ease-out' : 'none',
                  }}
                >
                  <MonthlyView
                    currentDate={monthOffset > 0 ? subMonths(currentDate, 1) : addMonths(currentDate, 1)}
                    events={events}
                    tasks={tasks}
                    transactions={transactions}
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                    isMoving={!!movingItem}
                    onMoveToDate={handleMoveToDate}
                  />
                </div>
              )}
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
              <div className="week-strip-days-frame">
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
              {(stripOffset !== 0 || stripAnimating) && (
                <div
                  className="week-strip-days week-strip-adjacent"
                  style={{
                    transform: `translateX(${stripOffset > 0 ? 'calc(-100% + ' + stripOffset + 'px)' : 'calc(100% + ' + stripOffset + 'px)'})`,
                    transition: stripAnimating ? 'transform 0.35s ease-out' : 'none',
                  }}
                >
                  {(stripOffset > 0 ? adjWeekDays.prev : adjWeekDays.next).map((day) => {
                    const today = isToday(day)
                    const dayOfWeek = day.getDay()
                    const dots = hasDotForDay(day)
                    return (
                      <div
                        key={day.toISOString()}
                        className={`ws-day ${today ? 'ws-today' : ''}`}
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
              )}
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
              selectedItemId={selectedItem?.id ?? null}
              onSelectItem={handleSelectItem}
              onEditEvent={handleEditEvent}
              onEditTask={handleEditTask}
              onAddEventAtTime={handleAddEventAtTime}
              onSwipePrev={() => setSelectedDate((d) => subDays(d, 1))}
              onSwipeNext={() => setSelectedDate((d) => addDays(d, 1))}
            />
          </div>
        </div>
      )}

      {view === 'week' && (
        <div className="week-view-layout">
          <WeeklyView
            weekStart={weekStart}
            events={events}
            tasks={tasks}
            categories={categories}
            selectedDate={selectedDate}
            selectedItemId={selectedItem?.id ?? null}
            onSelectDate={handleSelectDate}
            onSelectItem={handleSelectItem}
            onEditEvent={handleEditEvent}
            onEditTask={handleEditTask}
            onAddEventAtTime={handleAddEventAtTimeForDay}
          />
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
        defaultDate={selectedDate}
      />
    </div>
  )
}
