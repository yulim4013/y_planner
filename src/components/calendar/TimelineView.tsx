import { useRef, useEffect, useState, useCallback } from 'react'
import { toggleTaskComplete, deleteTask, updateTask, addTask } from '../../services/taskService'
import { deleteEvent, updateEvent, addEvent } from '../../services/eventService'
import { toggleRoutineComplete } from '../../services/routineService'
import { deleteSleepRecord, updateSleepRecord } from '../../services/sleepService'
import type { CalendarEvent, Task, Category, Routine, SleepRecord } from '../../types'
import './TimelineView.css'

interface SleepInfo {
  sleepTime: string | null
  wakeTime: string | null
  durationMin: number
  sleepRecord: SleepRecord | null
  wakeRecord: SleepRecord | null
}

interface TimelineViewProps {
  events: CalendarEvent[]
  tasks: Task[]
  routines?: Routine[]
  categories?: Category[]
  sleepInfo?: SleepInfo
  onEditEvent: (event: CalendarEvent) => void
  onEditTask: (task: Task) => void
  onMoveItem?: (type: 'task' | 'event', id: string) => void
  onAddEventAtTime?: (startTime: string) => void
  onSwipePrev?: () => void
  onSwipeNext?: () => void
}

interface ActionBarState {
  type: 'event' | 'task' | 'sleep'
  id: string
  id2?: string  // second record id (for sleep pair)
  barTop: number
  barLeft: number
}

type DragMode = 'move' | 'resize-top' | 'resize-bottom'

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

export default function TimelineView({ events, tasks, routines = [], categories = [], sleepInfo, onEditEvent, onEditTask, onAddEventAtTime, onSwipePrev, onSwipeNext }: TimelineViewProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const getCat = (id?: string | null) => id ? categories.find((c) => c.id === id) : null

  const eventsRef = useRef(events)
  eventsRef.current = events

  // Action bar
  const [actionBar, setActionBar] = useState<ActionBarState | null>(null)
  const closeActionBar = useCallback(() => setActionBar(null), [])

  // Sleep edit modal
  const [sleepEditOpen, setSleepEditOpen] = useState(false)
  const [sleepEditSleepTime, setSleepEditSleepTime] = useState('')
  const [sleepEditWakeTime, setSleepEditWakeTime] = useState('')
  const [sleepEditIds, setSleepEditIds] = useState<{ sleepId: string; wakeId: string }>({ sleepId: '', wakeId: '' })

  // Drag state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragMode, setDragMode] = useState<DragMode>('move')
  const [dragDeltaY, setDragDeltaY] = useState(0)
  const [dragTimeLabel, setDragTimeLabel] = useState('')

  const dragRef = useRef<{
    type: 'event' | 'task'
    id: string
    mode: DragMode
    startY: number
    startScroll: number
    originalStartMin: number
    originalEndMin: number
    element: HTMLElement
    cleanup: () => void
  } | null>(null)

  const lpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lpTriggeredRef = useRef(false)
  const touchStartPosRef = useRef({ x: 0, y: 0 })
  const preMouseRef = useRef<{ moveFn: (e: MouseEvent) => void; upFn: () => void } | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lpTimerRef.current) clearTimeout(lpTimerRef.current)
      dragRef.current?.cleanup()
      if (preMouseRef.current) {
        document.removeEventListener('mousemove', preMouseRef.current.moveFn)
        document.removeEventListener('mouseup', preMouseRef.current.upFn)
      }
    }
  }, [])

  // ── Unified drag system (touch + mouse, move + resize) ──
  const startDragMode = useCallback((
    type: 'event' | 'task',
    id: string,
    mode: DragMode,
    element: HTMLElement,
    originalStartMin: number,
    originalEndMin: number,
    pointerY: number,
    pointerType: 'touch' | 'mouse'
  ) => {
    const scrollContainer = gridRef.current?.closest('.day-view-timeline-scroll')
    const startScroll = scrollContainer?.scrollTop || 0
    const cleanupFns: (() => void)[] = []

    const getScrollDelta = () =>
      (gridRef.current?.closest('.day-view-timeline-scroll')?.scrollTop || 0) - startScroll

    const handleMove = (e: TouchEvent | MouseEvent) => {
      e.preventDefault()
      const y = 'touches' in e ? e.touches[0].clientY : e.clientY
      const totalDy = (y - pointerY) + getScrollDelta()
      setDragDeltaY(totalDy)

      const deltaMins = Math.round((totalDy / HOUR_HEIGHT) * 60 / 15) * 15

      if (mode === 'move') {
        const newMin = Math.max(0, Math.min(23 * 60 + 45, originalStartMin + deltaMins))
        setDragTimeLabel(formatTimeKorean(minutesToTime(newMin)))
      } else if (mode === 'resize-top') {
        const newStart = Math.max(0, Math.min(originalEndMin - 15, originalStartMin + deltaMins))
        setDragTimeLabel(`시작 ${formatTimeKorean(minutesToTime(newStart))}`)
      } else {
        const newEnd = Math.max(originalStartMin + 15, Math.min(24 * 60 - 1, originalEndMin + deltaMins))
        setDragTimeLabel(`종료 ${formatTimeKorean(minutesToTime(newEnd))}`)
      }
    }

    const handleEnd = (e: TouchEvent | MouseEvent) => {
      const y = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY
      const totalDy = (y - pointerY) + getScrollDelta()
      const deltaMins = Math.round((totalDy / HOUR_HEIGHT) * 60 / 15) * 15

      if (mode === 'move') {
        if (Math.abs(deltaMins) >= 15) {
          const newMin = Math.max(0, Math.min(23 * 60 + 45, originalStartMin + deltaMins))
          const newTime = minutesToTime(newMin)
          if (type === 'event') {
            const ev = eventsRef.current.find((e) => e.id === id)
            if (ev?.startTime) {
              const duration = ev.endTime ? timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime) : 60
              updateEvent(id, {
                startTime: newTime,
                endTime: minutesToTime(Math.min(23 * 60 + 59, newMin + duration)),
              })
            }
          } else {
            updateTask(id, { dueTime: newTime })
          }
        } else {
          // No significant drag → show action bar
          const rect = element.getBoundingClientRect()
          const bw = 220
          let bt = rect.bottom + 8
          let bl = rect.left + rect.width / 2
          if (bt + 44 > window.innerHeight - 80) bt = rect.top - 52
          bl = Math.max(bw / 2 + 8, Math.min(bl, window.innerWidth - bw / 2 - 8))
          setActionBar({ type, id, barTop: bt, barLeft: bl })
        }
      } else if (mode === 'resize-top') {
        if (Math.abs(deltaMins) >= 15) {
          const newStart = Math.max(0, Math.min(originalEndMin - 15, originalStartMin + deltaMins))
          updateEvent(id, { startTime: minutesToTime(newStart) })
        }
      } else {
        if (Math.abs(deltaMins) >= 15) {
          const newEnd = Math.max(originalStartMin + 15, Math.min(24 * 60 - 1, originalEndMin + deltaMins))
          updateEvent(id, { endTime: minutesToTime(newEnd) })
        }
      }

      // Cleanup
      cleanupFns.forEach((fn) => fn())
      dragRef.current = null
      setDraggedId(null)
      setDragMode('move')
      setDragDeltaY(0)
      setDragTimeLabel('')
    }

    if (pointerType === 'touch') {
      document.addEventListener('touchmove', handleMove as EventListener, { passive: false })
      document.addEventListener('touchend', handleEnd as EventListener)
      cleanupFns.push(
        () => document.removeEventListener('touchmove', handleMove as EventListener),
        () => document.removeEventListener('touchend', handleEnd as EventListener)
      )
    } else {
      document.addEventListener('mousemove', handleMove as EventListener)
      document.addEventListener('mouseup', handleEnd as EventListener)
      cleanupFns.push(
        () => document.removeEventListener('mousemove', handleMove as EventListener),
        () => document.removeEventListener('mouseup', handleEnd as EventListener)
      )
    }

    dragRef.current = {
      type, id, mode,
      startY: pointerY, startScroll,
      originalStartMin, originalEndMin,
      element,
      cleanup: () => cleanupFns.forEach((fn) => fn()),
    }

    setDraggedId(id)
    setDragMode(mode)
    setDragDeltaY(0)
    try { navigator.vibrate?.(25) } catch {}
  }, [])

  // ── Item handlers (long-press → activate/drag) for touch + mouse ──
  const makeItemHandlers = (type: 'event' | 'task', id: string, originalStartMin: number, originalEndMin?: number) => {
    const endMin = originalEndMin ?? originalStartMin + 60

    return {
      onTouchStart: (e: React.TouchEvent) => {
        if (actionBar) { setActionBar(null); return }
        lpTriggeredRef.current = false
        const el = e.currentTarget as HTMLElement
        const touch = e.touches[0]
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
        lpTimerRef.current = setTimeout(() => {
          lpTriggeredRef.current = true
          // 이벤트 활성화 (리사이즈 핸들 표시) - 이미 활성화면 드래그 시작
          if (type === 'event' && activeEventId !== id) {
            setActiveEventId(id)
            try { navigator.vibrate?.(25) } catch {}
          } else {
            startDragMode(type, id, 'move', el, originalStartMin, endMin, touch.clientY, 'touch')
          }
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
      onMouseDown: (e: React.MouseEvent) => {
        if (e.button !== 0) return
        if (actionBar) { setActionBar(null); return }
        e.preventDefault()
        lpTriggeredRef.current = false
        const el = e.currentTarget as HTMLElement
        const startPos = { x: e.clientX, y: e.clientY }

        const onMove = (ev: MouseEvent) => {
          if (Math.abs(ev.clientY - startPos.y) > 5) {
            // 활성화된 이벤트만 드래그 가능
            if (type === 'event' && activeEventId === id) {
              lpTriggeredRef.current = true
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
              preMouseRef.current = null
              startDragMode(type, id, 'move', el, originalStartMin, endMin, startPos.y, 'mouse')
            } else if (type === 'task') {
              lpTriggeredRef.current = true
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
              preMouseRef.current = null
              startDragMode(type, id, 'move', el, originalStartMin, endMin, startPos.y, 'mouse')
            }
          }
        }
        const onUp = () => {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
          preMouseRef.current = null
          if (!lpTriggeredRef.current) el.click()
        }

        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        preMouseRef.current = { moveFn: onMove, upFn: onUp }
      },
      onDoubleClick: (e: React.MouseEvent) => {
        e.stopPropagation()
        if (type === 'event') {
          setActiveEventId(activeEventId === id ? null : id)
        }
      },
    }
  }

  // ── Active event (long-press/double-click activates resize handles) ──
  const [activeEventId, setActiveEventId] = useState<string | null>(null)

  const makeResizeHandlers = (eventId: string, mode: 'resize-top' | 'resize-bottom', startMin: number, endMin: number) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.stopPropagation()
      const el = (e.currentTarget as HTMLElement).closest('.tl-event-block') as HTMLElement
      startDragMode('event', eventId, mode, el, startMin, endMin, e.touches[0].clientY, 'touch')
    },
    onMouseDown: (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const el = (e.currentTarget as HTMLElement).closest('.tl-event-block') as HTMLElement
      startDragMode('event', eventId, mode, el, startMin, endMin, e.clientY, 'mouse')
    },
  })

  // ── Build event groups ──
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

  // 이벤트 겹침 감지 → 컬럼 배치 (Apple Calendar 스타일)
  const eventColumns = (() => {
    const cols = new Map<string, { col: number; total: number }>()
    if (eventGroups.length <= 1) {
      eventGroups.forEach((g) => cols.set(g.event.id, { col: 0, total: 1 }))
      return cols
    }
    // 시작시간 순 정렬된 이벤트 목록
    const sorted = eventGroups.map((g) => ({
      id: g.event.id,
      start: timeToMinutes(g.event.startTime!),
      end: g.event.endTime ? timeToMinutes(g.event.endTime) : timeToMinutes(g.event.startTime!) + 60,
    })).sort((a, b) => a.start - b.start || a.end - b.end)

    // 겹치는 그룹 찾기
    const groups: typeof sorted[] = []
    let currentGroup: typeof sorted = []
    let groupEnd = 0
    for (const ev of sorted) {
      if (currentGroup.length === 0 || ev.start < groupEnd) {
        currentGroup.push(ev)
        groupEnd = Math.max(groupEnd, ev.end)
      } else {
        groups.push(currentGroup)
        currentGroup = [ev]
        groupEnd = ev.end
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup)

    // 각 그룹 내에서 컬럼 할당
    for (const group of groups) {
      const colEnds: number[] = [] // 각 컬럼의 종료시간
      for (const ev of group) {
        let placed = false
        for (let c = 0; c < colEnds.length; c++) {
          if (colEnds[c] <= ev.start) {
            colEnds[c] = ev.end
            cols.set(ev.id, { col: c, total: 0 })
            placed = true
            break
          }
        }
        if (!placed) {
          cols.set(ev.id, { col: colEnds.length, total: 0 })
          colEnds.push(ev.end)
        }
      }
      const total = colEnds.length
      for (const ev of group) {
        const entry = cols.get(ev.id)!
        entry.total = total
      }
    }
    return cols
  })()

  // Auto-scroll: 최초 마운트 시에만 실행
  const initialScrollDone = useRef(false)
  useEffect(() => {
    if (initialScrollDone.current) return
    const scrollContainer = gridRef.current?.closest('.day-view-timeline-scroll')
    if (!scrollContainer) return
    let scrollHour = new Date().getHours() - 1
    if (timedEvents.length > 0) {
      scrollHour = Math.floor(timeToMinutes(timedEvents[0].startTime!) / 60) - 1
    }
    scrollContainer.scrollTop = Math.max(0, scrollHour * HOUR_HEIGHT)
    if (events.length > 0 || tasks.length > 0) initialScrollDone.current = true
  }, [events, tasks])

  // Action bar handlers
  const handleEdit = () => {
    if (!actionBar) return
    if (actionBar.type === 'event') {
      const ev = events.find((e) => e.id === actionBar.id)
      if (ev) onEditEvent(ev)
    } else if (actionBar.type === 'task') {
      const t = tasks.find((t) => t.id === actionBar.id)
      if (t) onEditTask(t)
    } else if (actionBar.type === 'sleep') {
      // Open sleep edit modal
      const sr = sleepInfo?.sleepRecord
      const wr = sleepInfo?.wakeRecord
      if (sr && wr) {
        setSleepEditSleepTime(sr.time)
        setSleepEditWakeTime(wr.time)
        setSleepEditIds({ sleepId: sr.id, wakeId: wr.id })
        setSleepEditOpen(true)
      }
    }
    setActionBar(null)
  }

  const handleSleepEditSave = async () => {
    if (sleepEditIds.sleepId && sleepEditSleepTime) {
      await updateSleepRecord(sleepEditIds.sleepId, sleepEditSleepTime)
    }
    if (sleepEditIds.wakeId && sleepEditWakeTime) {
      await updateSleepRecord(sleepEditIds.wakeId, sleepEditWakeTime)
    }
    setSleepEditOpen(false)
  }

  const handleDelete = async () => {
    if (!actionBar) return
    if (actionBar.type === 'event') await deleteEvent(actionBar.id)
    else if (actionBar.type === 'sleep') {
      await deleteSleepRecord(actionBar.id)
      if (actionBar.id2) await deleteSleepRecord(actionBar.id2)
    }
    else await deleteTask(actionBar.id)
    setActionBar(null)
  }

  const handleDuplicate = async () => {
    if (!actionBar) return
    if (actionBar.type === 'event') {
      const ev = eventsRef.current.find((e) => e.id === actionBar.id)
      if (ev) {
        await addEvent({
          title: ev.title ? `${ev.title} (복사)` : '(제목 없음)',
          description: ev.description,
          startDate: ev.startDate.toDate(),
          endDate: ev.endDate.toDate(),
          startTime: ev.startTime,
          endTime: ev.endTime,
          isAllDay: ev.isAllDay,
          categoryId: ev.categoryId,
          location: ev.location,
        })
      }
    } else {
      const t = tasks.find((t) => t.id === actionBar.id)
      if (t) {
        await addTask({
          title: `${t.title} (복사)`,
          description: t.description,
          priority: t.priority,
          dueDate: t.dueDate?.toDate() || null,
          dueTime: t.dueTime,
          categoryId: t.categoryId,
          subItems: t.subItems?.map((si) => ({ ...si, isCompleted: false })),
        })
      }
    }
    setActionBar(null)
  }

  // Click guard: prevent click after long-press / drag / activation
  const handleItemClick = (type: 'event' | 'task', item: CalendarEvent | Task) => {
    if (lpTriggeredRef.current) { lpTriggeredRef.current = false; return }
    if (actionBar || draggedId) return
    // 싱글 탭 → 바로 수정 폼 열기 (활성 상태여도 수정 폼 열기)
    if (activeEventId) setActiveEventId(null)
    if (type === 'event') onEditEvent(item as CalendarEvent)
    else onEditTask(item as Task)
  }

  // 그리드 빈 칸: 꾹 누르기(touch) / 더블클릭(mouse)으로 일정 추가
  const gridLpRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gridTouchStartRef = useRef({ x: 0, y: 0 })
  const [lpIndicator, setLpIndicator] = useState<{ top: number; time: string } | null>(null)

  const getTimeFromY = useCallback((clientY: number) => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const y = clientY - rect.top + grid.scrollTop
    const minutes = Math.floor((y / HOUR_HEIGHT) * 60 / 15) * 15
    return Math.max(0, Math.min(23 * 60 + 45, minutes))
  }, [])

  const isGridTarget = (target: HTMLElement) =>
    target.classList.contains('tl-grid-inner') || target.classList.contains('tl-hour-line') || target.classList.contains('tl-hour-row')

  const handleGridTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!onAddEventAtTime) return
    if (!isGridTarget(e.target as HTMLElement)) return
    const touch = e.touches[0]
    gridTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
    // 프리뷰 인디케이터 표시 (200ms 후)
    const previewTimer = setTimeout(() => {
      const min = getTimeFromY(touch.clientY)
      if (min !== null) {
        setLpIndicator({ top: (min / 60) * HOUR_HEIGHT, time: formatTimeKorean(minutesToTime(min)) })
      }
    }, 200)
    gridLpRef.current = setTimeout(() => {
      gridLpRef.current = null
      clearTimeout(previewTimer)
      setActiveEventId(null)
      setLpIndicator(null)
      const min = getTimeFromY(touch.clientY)
      if (min !== null) {
        try { navigator.vibrate?.(25) } catch {}
        onAddEventAtTime(minutesToTime(min))
      }
    }, 500)
    // 취소 시 프리뷰도 지우기
    const origCleanup = gridLpRef.current
    gridLpRef.current = origCleanup
    ;(gridLpRef as any)._previewTimer = previewTimer
  }, [onAddEventAtTime, getTimeFromY])

  const handleGridTouchMove = useCallback((e: React.TouchEvent) => {
    if (gridLpRef.current) {
      const dx = e.touches[0].clientX - gridTouchStartRef.current.x
      const dy = e.touches[0].clientY - gridTouchStartRef.current.y
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(gridLpRef.current)
        clearTimeout((gridLpRef as any)._previewTimer)
        gridLpRef.current = null
        setLpIndicator(null)
      }
    }
  }, [])

  const handleGridTouchEnd = useCallback(() => {
    if (gridLpRef.current) {
      clearTimeout(gridLpRef.current)
      clearTimeout((gridLpRef as any)._previewTimer)
      gridLpRef.current = null
    }
    setLpIndicator(null)
  }, [])

  const handleGridDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onAddEventAtTime) return
    if (!isGridTarget(e.target as HTMLElement)) return
    setActiveEventId(null)
    const min = getTimeFromY(e.clientY)
    if (min !== null) onAddEventAtTime(minutesToTime(min))
  }, [onAddEventAtTime, getTimeFromY])

  const handleGridClick = useCallback(() => {
    setActiveEventId(null)
  }, [])

  // 수면 블록 계산 (sleepInfo에서 이미 매칭된 record 사용)
  const sleepBlocks: { top: number; height: number; label: string; detail: string; sleepId: string; wakeId: string }[] = []
  if (sleepInfo && sleepInfo.durationMin > 0 && sleepInfo.sleepRecord && sleepInfo.wakeRecord) {
    const { sleepRecord, wakeRecord } = sleepInfo
    const [wh, wm] = wakeRecord.time.split(':').map(Number)
    const [sh, sm] = sleepRecord.time.split(':').map(Number)
    const hrs = Math.floor(sleepInfo.durationMin / 60)
    const mins = sleepInfo.durationMin % 60
    const label = `${hrs}시간${mins > 0 ? ` ${mins}분` : ''}`
    const detail = `${sleepInfo.sleepTime} ~ ${sleepInfo.wakeTime}`

    if (sleepRecord.date !== wakeRecord.date) {
      // 전날 밤 취침 → 0시~기상 블록
      const wakeMin = wh * 60 + wm
      if (wakeMin > 0) {
        sleepBlocks.push({ top: 0, height: (wakeMin / 60) * HOUR_HEIGHT, label, detail, sleepId: sleepRecord.id, wakeId: wakeRecord.id })
      }
    } else {
      // 같은 날 수면
      const sleepMin = sh * 60 + sm
      const wakeMin = wh * 60 + wm
      sleepBlocks.push({
        top: (sleepMin / 60) * HOUR_HEIGHT,
        height: ((wakeMin - sleepMin) / 60) * HOUR_HEIGHT,
        label, detail, sleepId: sleepRecord.id, wakeId: wakeRecord.id,
      })
    }
  }

  // ── 타임라인 좌우 스와이프로 일자 이동 ──
  const tlSwipeRef = useRef<{ startX: number; startY: number; decided: boolean; isHorizontal: boolean } | null>(null)
  const [tlSwipeOffset, setTlSwipeOffset] = useState(0)
  const [tlSwipeAnimating, setTlSwipeAnimating] = useState(false)

  const handleTlSwipeStart = useCallback((e: React.TouchEvent) => {
    // 드래그 중에는 스와이프 방지 (롱프레스 타이머는 스와이프 move에서 취소)
    if (draggedId) return
    tlSwipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, decided: false, isHorizontal: false }
  }, [draggedId])

  const handleTlSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!tlSwipeRef.current) return
    const dx = e.touches[0].clientX - tlSwipeRef.current.startX
    const dy = e.touches[0].clientY - tlSwipeRef.current.startY
    if (!tlSwipeRef.current.decided && (Math.abs(dx) > 12 || Math.abs(dy) > 12)) {
      tlSwipeRef.current.decided = true
      tlSwipeRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5
      // 수평 스와이프 감지 시 그리드 롱프레스 + 아이템 롱프레스 타이머 취소
      if (tlSwipeRef.current.isHorizontal) {
        if (gridLpRef.current) { clearTimeout(gridLpRef.current); clearTimeout((gridLpRef as any)._previewTimer); gridLpRef.current = null; setLpIndicator(null) }
        if (lpTimerRef.current) { clearTimeout(lpTimerRef.current); lpTimerRef.current = null }
      }
    }
    if (tlSwipeRef.current.decided && tlSwipeRef.current.isHorizontal) {
      setTlSwipeOffset(dx * 0.4) // 저항감 있는 따라가기
    }
  }, [])

  const handleTlSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!tlSwipeRef.current) return
    const dx = e.changedTouches[0].clientX - tlSwipeRef.current.startX
    const isHoriz = tlSwipeRef.current.isHorizontal
    tlSwipeRef.current = null

    if (isHoriz && Math.abs(dx) > 80) {
      setTlSwipeAnimating(true)
      setTlSwipeOffset(dx > 0 ? window.innerWidth * 0.3 : -window.innerWidth * 0.3)
      setTimeout(() => {
        if (dx > 0) onSwipePrev?.()
        else onSwipeNext?.()
        setTlSwipeOffset(0)
        setTlSwipeAnimating(false)
      }, 250)
    } else if (isHoriz) {
      setTlSwipeAnimating(true)
      setTlSwipeOffset(0)
      setTimeout(() => setTlSwipeAnimating(false), 200)
    } else {
      setTlSwipeOffset(0)
    }
  }, [onSwipePrev, onSwipeNext])

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const hasContent = events.length > 0 || tasks.length > 0 || routines.length > 0 || sleepBlocks.length > 0

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
                onClick={() => handleItemClick('event', event)}
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
          {untimedTasks.map((task) => {
            const cat = getCat(task.categoryId)
            return (
              <div
                key={task.id}
                className={`tl-untimed-task ${actionBar?.id === task.id ? 'tl-selected' : ''}`}
                onClick={() => handleItemClick('task', task)}
              >
                <button
                  className={`tl-task-check ${task.isCompleted ? 'done' : ''}`}
                  style={!task.isCompleted && cat ? { boxShadow: `inset 0 0 0 2px ${cat.color}` } : undefined}
                  onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate) }}
                >
                  {task.isCompleted && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                {cat && <span className="tl-untimed-cat" style={{ color: cat.color }}>{cat.icon} {cat.name}</span>}
                <span className={`tl-untimed-title ${task.isCompleted ? 'tl-done' : ''}`}>{task.title}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 타임라인 그리드 */}
      <div
        className="tl-grid"
        ref={gridRef}
        onTouchStart={handleTlSwipeStart}
        onTouchMove={handleTlSwipeMove}
        onTouchEnd={handleTlSwipeEnd}
      >
        <div
          className="tl-grid-inner"
          style={{
            height: 24 * HOUR_HEIGHT,
            transform: tlSwipeOffset ? `translateX(${tlSwipeOffset}px)` : undefined,
            transition: tlSwipeAnimating ? 'transform 0.25s ease-out' : 'none',
          }}
          onClick={handleGridClick}
          onDoubleClick={handleGridDoubleClick}
          onTouchStart={handleGridTouchStart}
          onTouchMove={handleGridTouchMove}
          onTouchEnd={handleGridTouchEnd}
        >
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
            const color = eventCat?.color || '#64B5F6'
            const isDragging = draggedId === event.id
            const isMoving = isDragging && dragMode === 'move'
            const isResizing = isDragging && dragMode !== 'move'
            const handlers = makeItemHandlers('event', event.id, startMin, endMin)

            // Calculate block position and size (with resize adjustments)
            let blockTop = (startMin / 60) * HOUR_HEIGHT
            const taskRowHeight = groupTasks.length * 36
            const headerHeight = 52
            let baseHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT

            if (isDragging && dragMode === 'resize-top') {
              const deltaMins = Math.round((dragDeltaY / HOUR_HEIGHT) * 60 / 15) * 15
              const newStart = Math.max(0, Math.min(endMin - 15, startMin + deltaMins))
              blockTop = (newStart / 60) * HOUR_HEIGHT
              baseHeight = ((endMin - newStart) / 60) * HOUR_HEIGHT
            } else if (isDragging && dragMode === 'resize-bottom') {
              const deltaMins = Math.round((dragDeltaY / HOUR_HEIGHT) * 60 / 15) * 15
              const newEnd = Math.max(startMin + 15, Math.min(24 * 60 - 1, endMin + deltaMins))
              baseHeight = ((newEnd - startMin) / 60) * HOUR_HEIGHT
            }

            const minHeight = Math.max(baseHeight, headerHeight + taskRowHeight)

            // Compute display times
            let displayStart = event.startTime!
            let displayEnd = event.endTime || ''
            if (isDragging) {
              const deltaMins = Math.round((dragDeltaY / HOUR_HEIGHT) * 60 / 15) * 15
              if (dragMode === 'move') {
                const newMin = Math.max(0, Math.min(23 * 60 + 45, startMin + deltaMins))
                displayStart = minutesToTime(newMin)
                if (event.endTime) displayEnd = minutesToTime(Math.min(23 * 60 + 59, newMin + (endMin - startMin)))
              } else if (dragMode === 'resize-top') {
                const newStart = Math.max(0, Math.min(endMin - 15, startMin + deltaMins))
                displayStart = minutesToTime(newStart)
              } else {
                const newEnd = Math.max(startMin + 15, Math.min(24 * 60 - 1, endMin + deltaMins))
                displayEnd = minutesToTime(newEnd)
              }
            }

            const isActive = activeEventId === event.id

            // 겹침 컬럼 계산
            const colInfo = eventColumns.get(event.id) || { col: 0, total: 1 }
            const colStyle = colInfo.total > 1
              ? { left: `calc(66px + (100% - 74px) * ${colInfo.col} / ${colInfo.total})`, width: `calc((100% - 74px) / ${colInfo.total})`, right: 'auto' as const }
              : {}

            return (
              <div
                key={event.id}
                className={`tl-event-block ${isDragging ? 'tl-dragging' : ''} ${isActive ? 'tl-active' : ''} ${actionBar?.id === event.id ? 'tl-selected' : ''}`}
                style={{
                  top: blockTop,
                  minHeight,
                  borderLeftColor: color,
                  background: `${color}22`,
                  ...colStyle,
                  ...(isMoving ? { transform: `translateY(${dragDeltaY}px)`, zIndex: 100 } : {}),
                  ...(isResizing ? { zIndex: 100 } : {}),
                }}

                onClick={() => handleItemClick('event', event)}
                {...handlers}
              >
                {/* Top resize handle - only when active */}
                {isActive && <div className="tl-resize-handle tl-resize-top" onClick={(e) => e.stopPropagation()} {...makeResizeHandlers(event.id, 'resize-top', startMin, endMin)} />}

                <div className="tl-event-header">
                  <div className="tl-event-header-top">
                    <span className="tl-event-cat-icon">{eventCat?.icon || ''}</span>
                    <span className="tl-event-cat-name">{eventCat?.name || event.title}</span>
                    {event.title && event.title !== '(제목 없음)' && (
                      <span className="tl-event-title-right">{event.title}</span>
                    )}
                  </div>
                  <div className="tl-event-meta-row">
                    {event.location && (
                      <span className="tl-event-location">📍 {event.location}</span>
                    )}
                    <span className="tl-event-time">
                      {formatTimeKorean(displayStart)} ~ {displayEnd ? formatTimeKorean(displayEnd) : ''}
                    </span>
                  </div>
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
                          style={taskCat ? { borderLeft: `3px solid ${taskCat.color}` } : undefined}
                          onClick={(e) => { e.stopPropagation(); handleItemClick('task', task) }}
                          onTouchStart={(e) => { e.stopPropagation(); taskHandlers.onTouchStart(e) }}
                          onTouchMove={taskHandlers.onTouchMove}
                          onTouchEnd={taskHandlers.onTouchEnd}
                          onMouseDown={(e) => { e.stopPropagation(); taskHandlers.onMouseDown(e) }}
                        >
                          <button
                            className={`tl-task-check ${task.isCompleted ? 'done' : ''}`}
                            style={!task.isCompleted && taskCat ? { boxShadow: `inset 0 0 0 2px ${taskCat.color}` } : undefined}
                            onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate) }}
                          >
                            {task.isCompleted && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                          {taskTime && <span className="tl-nested-time">{formatTimeKorean(taskTime)}</span>}
                          {taskCat && <span className="tl-nested-cat" style={{ color: taskCat.color }}>{taskCat.name}</span>}
                          <span className={`tl-nested-title ${task.isCompleted ? 'tl-done' : ''}`}>{task.title}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Bottom resize handle - only when active */}
                {isActive && <div className="tl-resize-handle tl-resize-bottom" onClick={(e) => e.stopPropagation()} {...makeResizeHandlers(event.id, 'resize-bottom', startMin, endMin)} />}
              </div>
            )
          })}

          {/* 그룹 밖 태스크 (겹치면 나란히 배치) */}
          {(() => {
            // 같은 시간대 태스크 그룹핑
            const tasksByTime = new Map<number, typeof ungroupedTasks>()
            ungroupedTasks.forEach((task) => {
              const displayTime = task.isCompleted && task.completedTime ? task.completedTime : task.dueTime!
              const min = timeToMinutes(displayTime)
              const group = tasksByTime.get(min) || []
              group.push(task)
              tasksByTime.set(min, group)
            })

            return ungroupedTasks.map((task) => {
              const displayTime = task.isCompleted && task.completedTime ? task.completedTime : task.dueTime!
              const min = timeToMinutes(displayTime)
              const top = (min / 60) * HOUR_HEIGHT
              const cat = getCat(task.categoryId)
              const isDragging = draggedId === task.id
              const handlers = makeItemHandlers('task', task.id, min)

              // 같은 시간 태스크 중 인덱스 계산
              const sameTimeTasks = tasksByTime.get(min) || [task]
              const colIndex = sameTimeTasks.indexOf(task)
              const colCount = sameTimeTasks.length
              const colWidth = colCount > 1 ? `calc((100% - 74px) / ${colCount})` : undefined
              const colLeft = colCount > 1 ? `calc(66px + (100% - 74px) * ${colIndex} / ${colCount})` : undefined

              return (
                <div
                  key={task.id}
                  className={`tl-task-row ${isDragging ? 'tl-dragging' : ''} ${actionBar?.id === task.id ? 'tl-selected' : ''}`}
                  style={{
                    top,
                    ...(colCount > 1 ? { left: colLeft, width: colWidth, right: 'auto' } : {}),
                    ...(isDragging ? { transform: `translateY(${dragDeltaY}px)`, zIndex: 100 } : {}),
                  }}
                  onClick={() => handleItemClick('task', task)}
                  {...handlers}
                >
                  <button
                    className={`tl-task-check ${task.isCompleted ? 'done' : ''}`}
                    style={!task.isCompleted && cat ? { boxShadow: `inset 0 0 0 2px ${cat.color}` } : undefined}
                    onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate) }}
                  >
                    {task.isCompleted && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6l2.5 2.5L9.5 4" stroke="#5a5a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <span className={`tl-task-title ${task.isCompleted ? 'tl-done' : ''}`}>{task.title}</span>
                  {cat && <span className="tl-task-cat-text" style={{ color: cat.color }}>{cat.name}</span>}
                </div>
              )
            })
          })()}

          {/* 수면 블록 */}
          {sleepBlocks.map((block, i) => (
            <div
              key={`sleep-${i}`}
              className={`tl-sleep-block ${actionBar?.type === 'sleep' && actionBar.id === block.sleepId ? 'tl-selected' : ''}`}
              style={{ top: block.top, height: Math.max(block.height, 40) }}
              onClick={(e) => {
                e.stopPropagation()
                if (lpTriggeredRef.current) { lpTriggeredRef.current = false; return }
                if (actionBar || draggedId) return
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                const bw = 180
                let bt = rect.bottom + 8
                let bl = rect.left + rect.width / 2
                if (bt + 44 > window.innerHeight - 80) bt = rect.top - 52
                bl = Math.max(bw / 2 + 8, Math.min(bl, window.innerWidth - bw / 2 - 8))
                setActionBar({ type: 'sleep', id: block.sleepId, id2: block.wakeId, barTop: bt, barLeft: bl })
              }}
            >
              <div className="tl-sleep-content">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h6l-6 6h6"/><path d="M12 2h4l-4 4h4"/><path d="M18 8h2l-2 2h2"/>
                </svg>
                <span className="tl-sleep-label">{block.label}</span>
                <span className="tl-sleep-detail">{block.detail}</span>
              </div>
            </div>
          ))}

          {/* 꾹 누르기 위치 인디케이터 */}
          {lpIndicator && (
            <div className="tl-lp-indicator" style={{ top: lpIndicator.top }}>
              <span className="tl-lp-time">{lpIndicator.time}</span>
              <div className="tl-lp-line" />
            </div>
          )}

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
            {actionBar.type !== 'sleep' && <button className="action-bar-btn" onClick={handleDuplicate}>복제</button>}
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

      {/* 수면 시간 수정 모달 */}
      {sleepEditOpen && (
        <>
          <div className="tl-action-overlay" onClick={() => setSleepEditOpen(false)} />
          <div className="tl-sleep-edit-modal">
            <div className="tl-sleep-edit-title">수면 시간 수정</div>
            <div className="tl-sleep-edit-row">
              <label>취침</label>
              <input type="time" value={sleepEditSleepTime} onChange={(e) => setSleepEditSleepTime(e.target.value)} />
            </div>
            <div className="tl-sleep-edit-row">
              <label>기상</label>
              <input type="time" value={sleepEditWakeTime} onChange={(e) => setSleepEditWakeTime(e.target.value)} />
            </div>
            <div className="tl-sleep-edit-actions">
              <button className="tl-sleep-edit-cancel" onClick={() => setSleepEditOpen(false)}>취소</button>
              <button className="tl-sleep-edit-save" onClick={handleSleepEditSave}>저장</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
