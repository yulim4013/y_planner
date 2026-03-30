import { useState, useEffect, useRef } from 'react'
import Header from '../layout/Header'
import ProgressBar from '../common/ProgressBar'
import { formatDate } from '../../utils/dateUtils'
import { subscribeTasks, toggleTaskComplete } from '../../services/taskService'
import { subscribeEvents } from '../../services/eventService'
import {
  subscribeRoutinesByDate, addRoutineTemplate, addRoutine,
  toggleRoutineComplete, deleteRoutine, incrementWater, decrementWater,
  subscribeActiveTemplates, deleteRoutineTemplate, updateRoutineOrder,
} from '../../services/routineService'
import {
  requestNotificationPermission, scheduleAllRoutineNotifications,
  getNotificationPermission,
} from '../../services/notificationService'
import { subscribeSleepForDate, calculateSleepDuration } from '../../services/sleepService'
import { subscribeCategories } from '../../services/categoryService'
import { subscribeTransactionsByMonth } from '../../services/budgetService'
import { getBudgetCategory } from '../../utils/constants'
import EventForm from '../calendar/EventForm'
import TaskForm from '../tasks/TaskForm'
import { useUIStore } from '../../store/uiStore'
import { formatNumber } from '../../utils/currencyUtils'
import { format } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import type { Task, CalendarEvent, Routine, RoutineTemplate, SleepRecord, Category, Transaction } from '../../types'
import './DashboardPage.css'

const ROUTINE_ICONS = [
  {
    id: 'sunrise',
    label: '모닝루틴',
    svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 18a5 5 0 00-10 0"/><line x1="12" y1="9" x2="12" y2="2"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/></svg>`,
  },
  {
    id: 'moon',
    label: '나이트루틴',
    svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`,
  },
  {
    id: 'stretch',
    label: '스트레칭',
    svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="4" r="2"/><line x1="2" y1="20" x2="22" y2="20"/><path d="M17 7l-3 4-3-1-4 3"/><path d="M17 7v4"/><path d="M7 13v4c0 1 0 3 2 3"/><path d="M14 11l-1 5c0 1 0 3 1 4"/></svg>`,
  },
  {
    id: 'water',
    label: '물 마시기',
    svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c0 0-7 8.5-7 13a7 7 0 0014 0c0-4.5-7-13-7-13z"/></svg>`,
  },
  {
    id: 'pill',
    label: '영양제',
    svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="3" width="10" height="18" rx="5"/><line x1="7" y1="12" x2="17" y2="12"/><circle cx="10" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="8" r="1" fill="currentColor" stroke="none"/></svg>`,
  },
  {
    id: 'journal',
    label: '모닝페이지',
    svg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
  },
]

function getIconSvg(iconId: string): string {
  return ROUTINE_ICONS.find((i) => i.id === iconId)?.svg || ROUTINE_ICONS[0].svg
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

export default function DashboardPage() {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const openAddSheet = useUIStore((s) => s.openAddSheet)

  // 루틴은 매일 오전 6시 기준으로 리셋 (6시 이전이면 전날 루틴 표시)
  const routineDateStr = (() => {
    const now = new Date()
    if (now.getHours() < 6) {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      return format(yesterday, 'yyyy-MM-dd')
    }
    return todayStr
  })()

  const [tasks, setTasks] = useState<Task[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [templates, setTemplates] = useState<RoutineTemplate[]>([])
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [eventFormOpen, setEventFormOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [showRoutineForm, setShowRoutineForm] = useState(false)
  const [showTemplateList, setShowTemplateList] = useState(false)
  const [selectedIconId, setSelectedIconId] = useState(ROUTINE_ICONS[0].id)
  const [routineTitle, setRoutineTitle] = useState('')
  const [waterGoal, setWaterGoal] = useState('2000')
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState('2026-12-31')
  const [routineTime, setRoutineTime] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  const currentMonthStr = format(today, 'yyyy-MM')

  useEffect(() => {
    const unsubTasks = subscribeTasks(setTasks)
    const unsubEvents = subscribeEvents(setEvents)
    const unsubRoutines = subscribeRoutinesByDate(routineDateStr, setRoutines)
    const unsubTemplates = subscribeActiveTemplates(setTemplates)
    const unsubSleep = subscribeSleepForDate(todayStr, setSleepRecords)
    const unsubCats = subscribeCategories(setCategories)
    const unsubTxns = subscribeTransactionsByMonth(currentMonthStr, setTransactions)
    return () => { unsubTasks(); unsubEvents(); unsubRoutines(); unsubTemplates(); unsubSleep(); unsubCats(); unsubTxns() }
  }, [todayStr, currentMonthStr, routineDateStr])

  // 루틴 알림 스케줄링
  useEffect(() => {
    if (routines.length > 0) {
      scheduleAllRoutineNotifications(routines)
    }
  }, [routines])

  // Today's tasks
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
  const todayTasks = tasks.filter((t) => {
    if (!t.dueDate) return !t.isCompleted
    const d = t.dueDate.toDate()
    return d >= todayStart && d <= todayEnd
  })
  const taskCompletedCount = todayTasks.filter((t) => t.isCompleted).length

  // Today's events
  const todayEvents = events.filter((e) => {
    const start = e.startDate.toDate(); start.setHours(0, 0, 0, 0)
    const end = e.endDate.toDate(); end.setHours(23, 59, 59, 999)
    return today >= start && today <= end
  }).sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1
    if (!a.isAllDay && b.isAllDay) return 1
    if (a.startTime && b.startTime) return timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    return 0
  })

  // Routine progress
  const routineCompletedCount = routines.filter((r) => r.isCompleted).length

  // 일정 카테고리별 시간 통계 (카테고리 ID 기반 매칭)
  const categoryTimeStats = (() => {
    const statsMap = new Map<string, { name: string; icon: string; color: string; minutes: number }>()

    todayEvents.forEach((evt) => {
      if (evt.isAllDay || !evt.startTime || !evt.endTime) return
      const durationMin = timeToMinutes(evt.endTime) - timeToMinutes(evt.startTime)
      if (durationMin <= 0) return

      const cat = evt.categoryId ? categories.find((c) => c.id === evt.categoryId) : null
      if (!cat) return

      const key = cat.id
      const existing = statsMap.get(key)
      if (existing) {
        existing.minutes += durationMin
      } else {
        statsMap.set(key, { name: cat.name, icon: cat.icon, color: cat.color, minutes: durationMin })
      }
    })

    return Array.from(statsMap.values()).sort((a, b) => b.minutes - a.minutes)
  })()

  const handleAddRoutine = async () => {
    if (!routineTitle.trim()) return
    const isWater = selectedIconId === 'water'
    const targetMl = isWater ? parseInt(waterGoal) || 2000 : undefined
    const timeValue = routineTime || undefined

    // 시간 알림이 설정된 경우 알림 권한 요청
    if (timeValue && getNotificationPermission() !== 'granted') {
      await requestNotificationPermission()
    }

    // 낙관적 UI 업데이트 - 즉시 화면에 반영
    const tempId = `temp-${Date.now()}`
    const newRoutine: Routine = {
      id: tempId,
      templateId: '',
      iconId: selectedIconId,
      title: routineTitle.trim(),
      isCompleted: false,
      date: routineDateStr,
      order: templates.length,
      checkedAt: null,
      ...(targetMl ? { targetMl, currentMl: 0 } : {}),
      ...(timeValue ? { time: timeValue } : {}),
    } as Routine
    setRoutines((prev) => [...prev, newRoutine])

    const tmplDoc = await addRoutineTemplate({
      iconId: selectedIconId,
      title: routineTitle.trim(),
      order: templates.length,
      startDate,
      endDate,
      targetMl,
      time: timeValue,
    })
    if (tmplDoc && startDate <= routineDateStr && endDate >= routineDateStr) {
      await addRoutine({
        templateId: tmplDoc.id,
        iconId: selectedIconId,
        title: routineTitle.trim(),
        date: routineDateStr,
        order: templates.length,
        targetMl,
        time: timeValue,
      })
    }
    setRoutineTitle('')
    setSelectedIconId(ROUTINE_ICONS[0].id)
    setWaterGoal('2000')
    setStartDate(todayStr)
    setEndDate('2026-12-31')
    setRoutineTime('')
    setShowRoutineForm(false)
  }

  const handleRoutineFormOpen = () => {
    setShowRoutineForm(true)
    setTimeout(() => titleInputRef.current?.focus(), 100)
  }

  // 수면 시간 계산
  const sleepInfo = calculateSleepDuration(sleepRecords, todayStr)
  const sleepHours = Math.floor(sleepInfo.durationMin / 60)
  const sleepMins = sleepInfo.durationMin % 60

  // 루틴 낙관적 업데이트 핸들러
  const handleToggleRoutine = async (routineId: string, currentCompleted: boolean) => {
    const willComplete = !currentCompleted
    setRoutines(prev => prev.map(r =>
      r.id === routineId
        ? { ...r, isCompleted: willComplete, checkedAt: willComplete ? Timestamp.now() : null } as Routine
        : r
    ))
    await toggleRoutineComplete(routineId, currentCompleted)
  }

  const handleIncrementWater = async (routineId: string, currentMl: number, targetMl: number) => {
    const newMl = currentMl + 250
    const isComplete = newMl >= targetMl
    setRoutines(prev => prev.map(r =>
      r.id === routineId
        ? { ...r, currentMl: newMl, isCompleted: isComplete, checkedAt: isComplete ? Timestamp.now() : null } as Routine
        : r
    ))
    await incrementWater(routineId, currentMl, targetMl)
  }

  const handleDecrementWater = async (routineId: string, currentMl: number) => {
    const newMl = Math.max(0, currentMl - 250)
    setRoutines(prev => prev.map(r =>
      r.id === routineId
        ? { ...r, currentMl: newMl, isCompleted: false, checkedAt: null } as Routine
        : r
    ))
    await decrementWater(routineId, currentMl)
  }

  // ── 루틴 드래그 정렬 ──
  const dragRoutineRef = useRef<{
    startIdx: number
    startY: number
    itemH: number
    listEl: HTMLElement
    dy: number
  } | null>(null)
  const [dragRoutineIdx, setDragRoutineIdx] = useState<number | null>(null)
  const [dragRoutineDy, setDragRoutineDy] = useState(0)
  const routinesRef = useRef(routines)
  routinesRef.current = routines

  const handleRoutineDragStart = (idx: number, clientY: number, listEl: HTMLElement) => {
    const items = listEl.querySelectorAll('.routine-item')
    const itemH = items.length > 0 ? (items[0] as HTMLElement).offsetHeight : 44
    dragRoutineRef.current = { startIdx: idx, startY: clientY, itemH, listEl, dy: 0 }
    setDragRoutineIdx(idx)
    setDragRoutineDy(0)
    try { navigator.vibrate?.(15) } catch {}
  }

  useEffect(() => {
    if (dragRoutineIdx === null) return

    const onMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!dragRoutineRef.current) return
      const dy = e.touches[0].clientY - dragRoutineRef.current.startY
      dragRoutineRef.current.dy = dy
      setDragRoutineDy(dy)
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRoutineRef.current) return
      const dy = e.clientY - dragRoutineRef.current.startY
      dragRoutineRef.current.dy = dy
      setDragRoutineDy(dy)
    }
    const onEnd = async () => {
      if (!dragRoutineRef.current) return
      const { startIdx, itemH, dy } = dragRoutineRef.current
      const currentRoutines = routinesRef.current
      const offset = Math.round(dy / itemH)
      const toIdx = Math.max(0, Math.min(currentRoutines.length - 1, startIdx + offset))

      if (toIdx !== startIdx) {
        const newRoutines = [...currentRoutines]
        const [moved] = newRoutines.splice(startIdx, 1)
        newRoutines.splice(toIdx, 0, moved)
        setRoutines(newRoutines)
        await Promise.all(newRoutines.map((r, i) => updateRoutineOrder(r.id, i)))
      }

      dragRoutineRef.current = null
      setDragRoutineIdx(null)
      setDragRoutineDy(0)
    }

    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onEnd)
    return () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onEnd)
    }
  }, [dragRoutineIdx])

  return (
    <div className="page">
      <Header title="HOME" right={
        <button className="header-add-btn" onClick={openAddSheet}>+</button>
      } />
      <p className="dashboard-date">{formatDate(today, 'M월 d일 EEEE')}</p>

      {/* 수면 시간 */}
      {sleepInfo.durationMin > 0 && (
        <div className="sleep-summary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4h6l-6 6h6"/><path d="M12 2h4l-4 4h4"/><path d="M18 8h2l-2 2h2"/>
          </svg>
          <span className="sleep-duration">{sleepHours}시간 {sleepMins > 0 ? `${sleepMins}분` : ''}</span>
          <span className="sleep-detail">{sleepInfo.sleepTime} ~ {sleepInfo.wakeTime}</span>
        </div>
      )}

      {/* 카테고리 카드 (업무/공부/운동) */}
      <div className="dash-cat-cards">
        {[
          { name: '업무', color: '#C5D5F5', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="3"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>' },
          { name: '공부', color: '#C8E6C9', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>' },
          { name: '운동', color: '#FFD1DC', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M4 17l4-4 4 4 4-4 4 4"/><line x1="12" y1="7" x2="12" y2="13"/></svg>' },
        ].map((cat) => {
          const stat = categoryTimeStats.find((s) => s.name === cat.name || s.name.includes(cat.name))
          const minutes = stat?.minutes || 0
          return (
            <div key={cat.name} className="dash-cat-card">
              <span className="dash-cat-icon" dangerouslySetInnerHTML={{ __html: cat.svg }} />
              <span className="dash-cat-name">{cat.name}</span>
              <span className="dash-cat-time">
                {minutes > 0
                  ? `${Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60 > 0 ? `${minutes % 60}m` : ''}`
                  : '-'}
              </span>
            </div>
          )
        })}
      </div>

      {/* 루틴 섹션 */}
      <div className="dash-section">
        <div className="dash-section-header">
          <div className="section-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>
          <span className="dash-section-title">오늘의 루틴</span>
          <span className="dash-section-count">{routineCompletedCount}/{routines.length}</span>
        </div>

        <div className="dash-card">
          {routines.length > 0 && (
            <ProgressBar value={routineCompletedCount} max={routines.length} />
          )}

          <div className="routine-list">
            {routines.map((routine, idx) => {
              const isDragging = dragRoutineIdx === idx
              const dragOffset = isDragging ? dragRoutineDy : 0
              return (
              <div
                key={routine.id}
                className={`routine-item ${isDragging ? 'routine-dragging' : ''}`}
                style={isDragging ? { transform: `translateY(${dragOffset}px)`, zIndex: 10 } : undefined}
              >
                {routine.iconId === 'water' && routine.targetMl ? (
                  /* 물 마시기 - 인라인 바 UI */
                  <div className="water-routine">
                    <div className="water-row">
                      <div className={`routine-check ${routine.isCompleted ? 'done' : ''}`}>
                        {routine.isCompleted && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <button
                        className="water-drop-btn"
                        onClick={() => handleIncrementWater(routine.id, routine.currentMl || 0, routine.targetMl!)}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={routine.isCompleted ? '#87CEEB' : 'none'} stroke="var(--color-icon)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2c0 0-7 8.5-7 13a7 7 0 0014 0c0-4.5-7-13-7-13z" />
                        </svg>
                      </button>
                      <span className={`routine-title ${routine.isCompleted ? 'done-text' : ''}`}>
                        {routine.title}
                      </span>
                      <div className="water-inline-bar">
                        <div className="water-bar-track">
                          <div
                            className="water-bar-fill"
                            style={{ width: `${Math.min(100, ((routine.currentMl || 0) / routine.targetMl) * 100)}%` }}
                          />
                        </div>
                        <span className="water-ml">{routine.currentMl || 0}/{routine.targetMl}</span>
                      </div>
                      {(routine.currentMl || 0) > 0 && (
                        <button
                          className="water-undo"
                          onClick={() => handleDecrementWater(routine.id, routine.currentMl || 0)}
                        >−</button>
                      )}
                      <div
                        className="routine-drag-handle"
                        onTouchStart={(e) => {
                          e.stopPropagation()
                          handleRoutineDragStart(idx, e.touches[0].clientY, e.currentTarget.closest('.routine-list') as HTMLElement)
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleRoutineDragStart(idx, e.clientY, (e.currentTarget as HTMLElement).closest('.routine-list') as HTMLElement)
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/>
                        </svg>
                      </div>
                      <button className="routine-delete" onClick={() => { setRoutines((prev) => prev.filter((r) => r.id !== routine.id)); deleteRoutine(routine.id) }}>×</button>
                    </div>
                  </div>
                ) : (
                  /* 일반 루틴 */
                  <>
                    <button
                      className={`routine-check ${routine.isCompleted ? 'done' : ''}`}
                      onClick={() => handleToggleRoutine(routine.id, routine.isCompleted)}
                    >
                      {routine.isCompleted && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span
                      className="routine-icon"
                      dangerouslySetInnerHTML={{ __html: getIconSvg(routine.iconId) }}
                    />
                    <span className={`routine-title ${routine.isCompleted ? 'done-text' : ''}`}>
                      {routine.title}
                    </span>
                    {routine.time && (
                      <span className="routine-time-badge">
                        {formatTimeKorean(routine.time)}
                      </span>
                    )}
                    <div
                      className="routine-drag-handle"
                      onTouchStart={(e) => {
                        e.stopPropagation()
                        handleRoutineDragStart(idx, e.touches[0].clientY, e.currentTarget.closest('.routine-list') as HTMLElement)
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleRoutineDragStart(idx, e.clientY, (e.currentTarget as HTMLElement).closest('.routine-list') as HTMLElement)
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/>
                      </svg>
                    </div>
                    <button className="routine-delete" onClick={() => { setRoutines((prev) => prev.filter((r) => r.id !== routine.id)); deleteRoutine(routine.id) }}>×</button>
                  </>
                )}
              </div>
            )})}
          </div>

          {showRoutineForm ? (
            <div className="routine-form">
              <div className="routine-icon-picker">
                {ROUTINE_ICONS.map((icon) => (
                  <button
                    key={icon.id}
                    className={`routine-icon-btn ${selectedIconId === icon.id ? 'selected' : ''}`}
                    onClick={() => setSelectedIconId(icon.id)}
                    title={icon.label}
                  >
                    <span dangerouslySetInnerHTML={{ __html: icon.svg }} />
                  </button>
                ))}
              </div>
              <div className="routine-input-row">
                <input
                  ref={titleInputRef}
                  className="routine-input"
                  placeholder="루틴 이름 입력"
                  value={routineTitle}
                  onChange={(e) => setRoutineTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRoutine()}
                />
              </div>
              <div className="routine-date-row">
                <label className="routine-date-label">시작일</label>
                <input
                  className="routine-input routine-date-input"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="routine-date-row">
                <label className="routine-date-label">종료일</label>
                <input
                  className="routine-input routine-date-input"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="routine-date-row">
                <label className="routine-date-label">알림</label>
                <div className="routine-time-wrapper">
                  <input
                    className="routine-input routine-date-input routine-time-input"
                    type="time"
                    value={routineTime}
                    onChange={(e) => setRoutineTime(e.target.value)}
                  />
                  {!routineTime && <span className="routine-time-placeholder">시간 선택</span>}
                </div>
                {routineTime && (
                  <button className="routine-time-clear" onClick={() => setRoutineTime('')}>×</button>
                )}
              </div>
              {selectedIconId === 'water' && (
                <div className="routine-input-row water-goal-row">
                  <span className="water-goal-label">목표</span>
                  <input
                    className="routine-input water-goal-input"
                    type="number"
                    value={waterGoal}
                    onChange={(e) => setWaterGoal(e.target.value)}
                  />
                  <span className="water-goal-unit">ml</span>
                </div>
              )}
              <div className="routine-form-actions">
                <button className="routine-add-confirm" onClick={handleAddRoutine}>추가</button>
                <button className="routine-add-cancel" onClick={() => setShowRoutineForm(false)}>취소</button>
              </div>
            </div>
          ) : (
            <div className="routine-bottom-actions">
              <button className="routine-add-btn" onClick={handleRoutineFormOpen}>
                + 루틴 추가
              </button>
              <button className="routine-manage-btn" onClick={() => setShowTemplateList(!showTemplateList)}>
                {showTemplateList ? '닫기' : '관리'}
              </button>
            </div>
          )}

          {showTemplateList && (
            <div className="routine-template-list">
              <div className="routine-template-header">등록된 루틴 템플릿</div>
              {templates.length === 0 ? (
                <p className="dash-empty">등록된 루틴이 없습니다</p>
              ) : (
                templates.map((tmpl) => (
                  <div key={tmpl.id} className="routine-template-item">
                    <span
                      className="routine-icon"
                      dangerouslySetInnerHTML={{ __html: getIconSvg(tmpl.iconId) }}
                    />
                    <div className="routine-template-info">
                      <span className="routine-template-title">{tmpl.title}</span>
                      <span className="routine-template-dates">
                        {tmpl.startDate} ~ {tmpl.endDate}
                        {tmpl.time && ` · ${tmpl.time}`}
                      </span>
                    </div>
                    <button
                      className="routine-delete"
                      onClick={() => deleteRoutineTemplate(tmpl.id)}
                    >×</button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 일정 섹션 */}
      <div className="dash-section">
        <div className="dash-section-header">
          <div className="section-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="3" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="8" y1="2" x2="8" y2="5" />
              <line x1="16" y1="2" x2="16" y2="5" />
            </svg>
          </div>
          <span className="dash-section-title">오늘 일정</span>
          <span className="dash-section-count">{todayEvents.length}건</span>
        </div>

        <div className="dash-card">
          {todayEvents.length === 0 ? (
            <p className="dash-empty">오늘 일정이 없습니다</p>
          ) : (
            <div className="event-list">
              {todayEvents.map((event) => {
                const evCat = event.categoryId ? categories.find((c) => c.id === event.categoryId) : null
                const isNoTitle = !event.title || event.title === '(제목 없음)'
                return (
                  <div key={event.id} className="dash-event-item" onClick={() => { setEditEvent(event); setEventFormOpen(true) }}>
                    <div className="dash-ev-bar" style={evCat ? { background: evCat.color } : {}} />
                    <div className="dash-ev-info">
                      {evCat && <span className="dash-ev-category" style={{ color: evCat.color }}>{evCat.icon} {evCat.name}</span>}
                      {!isNoTitle && <span className="dash-ev-title">{event.title}</span>}
                      <span className="dash-ev-detail">
                        {event.isAllDay
                          ? '종일'
                          : event.startTime
                            ? `${formatTimeKorean(event.startTime)}${event.endTime ? ` ~ ${formatTimeKorean(event.endTime)}` : ''}`
                            : ''}
                        {event.location ? ` · ${event.location}` : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 할 일 섹션 */}
      <div className="dash-section">
        <div className="dash-section-header">
          <div className="section-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M8 12l3 3 5-6" />
            </svg>
          </div>
          <span className="dash-section-title">오늘의 할 일</span>
          <span className="dash-section-count">{taskCompletedCount}/{todayTasks.length}</span>
        </div>

        <div className="dash-card">
          {todayTasks.length > 0 && (
            <ProgressBar value={taskCompletedCount} max={todayTasks.length} />
          )}

          {todayTasks.length === 0 ? (
            <p className="dash-empty">등록된 할 일이 없습니다</p>
          ) : (
            <div className="dash-task-list">
              {todayTasks.map((task) => (
                <div key={task.id} className="dash-task-item" onClick={() => { setEditTask(task); setTaskFormOpen(true) }}>
                  <button
                    className={`dash-task-check ${task.isCompleted ? 'done' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate) }}
                  >
                    {task.isCompleted && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className={`dash-task-title ${task.isCompleted ? 'done-text' : ''}`}>{task.title}</span>
                  {task.dueTime && (
                    <span className="dash-task-time">{formatTimeKorean(task.dueTime)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 지출 섹션 */}
      {(() => {
        const todayExpenses = transactions.filter((t) => {
          if (t.type !== 'expense') return false
          const d = t.date.toDate()
          return d >= todayStart && d <= todayEnd
        })
        const totalExpense = todayExpenses.reduce((sum, t) => sum + t.amount, 0)

        return (
          <div className="dash-section">
            <div className="dash-section-header">
              <div className="section-icon-wrap">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="15" rx="3" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                  <circle cx="17" cy="15" r="2" />
                </svg>
              </div>
              <span className="dash-section-title">오늘 지출</span>
              {todayExpenses.length > 0 && (
                <span className="dash-section-count">{todayExpenses.length}건</span>
              )}
            </div>

            <div className="dash-card">
              {todayExpenses.length === 0 ? (
                <p className="dash-empty">오늘 지출 내역이 없습니다</p>
              ) : (
                <div className="dash-expense-list">
                  <div className="dash-expense-total">
                    <span className="dash-expense-total-label">오늘 총 지출</span>
                    <span className="dash-expense-total-amount">-{formatNumber(totalExpense)}원</span>
                  </div>
                  {todayExpenses.map((tx) => {
                    const cat = getBudgetCategory(tx.category)
                    return (
                      <div key={tx.id} className="dash-expense-item">
                        <span className="dash-expense-icon" style={{ background: cat?.color || '#eee' }}>
                          {cat?.icon || '📦'}
                        </span>
                        <span className="dash-expense-info">
                          <span className="dash-expense-memo">{tx.memo || tx.category}</span>
                          {tx.memo && <span className="dash-expense-category">{tx.category}{tx.paymentMethod ? ` · ${tx.paymentMethod}` : ''}</span>}
                        </span>
                        <span className="dash-expense-amount">-{formatNumber(tx.amount)}원</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <EventForm
        isOpen={eventFormOpen}
        onClose={() => { setEventFormOpen(false); setEditEvent(null) }}
        editEvent={editEvent}
        defaultDate={today}
      />

      <TaskForm
        isOpen={taskFormOpen}
        onClose={() => { setTaskFormOpen(false); setEditTask(null) }}
        editTask={editTask}
      />
    </div>
  )
}
