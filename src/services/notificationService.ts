// 알림 서비스 - 브라우저 Notification API + FCM 연동
// 앱이 열려있을 때: setTimeout 기반 로컬 알림
// 앱이 닫혀있을 때: FCM 백그라운드 푸시 (잠금화면 표시)

import type { Routine, CalendarEvent, Task } from '../types'
import { registerFCMToken } from './fcmService'
import { useAuthStore } from '../store/authStore'

// 타입별로 타이머를 분리 관리
const routineTimers: Map<string, number> = new Map()
const eventTimers: Map<string, number> = new Map()
const taskTimers: Map<string, number> = new Map()

// 알림 권한 요청 + FCM 토큰 등록
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('이 브라우저는 알림을 지원하지 않습니다')
    return false
  }
  if (Notification.permission === 'granted') {
    // 이미 권한 있으면 FCM 토큰만 확인
    const uid = useAuthStore.getState().user?.uid
    if (uid) registerFCMToken(uid).catch(() => {})
    return true
  }
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  if (result === 'granted') {
    // 권한 획득 시 FCM 토큰 등록
    const uid = useAuthStore.getState().user?.uid
    if (uid) registerFCMToken(uid).catch(() => {})
    return true
  }
  return false
}

// 알림 권한 상태
export function getNotificationPermission(): string {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

// 알림 보내기
function showNotification(title: string, body: string, _iconId?: string) {
  if (Notification.permission !== 'granted') return

  try {
    new Notification(title, {
      body,
      icon: '/y_planner/icons/icon-192x192.jpg',
      badge: '/y_planner/icons/icon-192x192.jpg',
      tag: `routine-${title}`,
      requireInteraction: false,
    })
  } catch {
    // 모바일 Safari 등에서 Notification 생성자 미지원 시
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
      })
    }
  }
}

// 특정 루틴에 대한 알림 스케줄링
function scheduleRoutineNotification(routine: Routine) {
  if (!routine.time || routine.isCompleted) return

  const [h, m] = routine.time.split(':').map(Number)
  const now = new Date()
  const target = new Date()
  target.setHours(h, m, 0, 0)

  // 이미 지난 시간이면 스킵
  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return

  // 최대 24시간 내 알림만 스케줄
  if (diff > 24 * 60 * 60 * 1000) return

  const timerId = window.setTimeout(() => {
    showNotification(routine.title, '루틴을 시작할 시간이에요!', routine.iconId)
    routineTimers.delete(routine.id)
  }, diff)

  routineTimers.set(routine.id, timerId)
}

// 모든 루틴 알림 스케줄링 (루틴 목록이 변경될 때 호출)
export function scheduleAllRoutineNotifications(routines: Routine[]) {
  // 루틴 타이머만 초기화 (일정/태스크 타이머는 유지!)
  routineTimers.forEach((timerId) => window.clearTimeout(timerId))
  routineTimers.clear()

  if (Notification.permission !== 'granted') return

  routines.forEach((routine) => {
    scheduleRoutineNotification(routine)
  })
}

// 모든 스케줄된 알림 취소
export function clearAllScheduledNotifications() {
  routineTimers.forEach((t) => window.clearTimeout(t))
  eventTimers.forEach((t) => window.clearTimeout(t))
  taskTimers.forEach((t) => window.clearTimeout(t))
  routineTimers.clear()
  eventTimers.clear()
  taskTimers.clear()
}

// ── 일정/태스크 미리알림 ──

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function scheduleItemReminder(
  timers: Map<string, number>,
  key: string,
  title: string,
  body: string,
  targetTime: Date,
) {
  const diff = targetTime.getTime() - Date.now()
  if (diff <= 0 || diff > 24 * 60 * 60 * 1000) return

  const timerId = window.setTimeout(() => {
    showNotification(title, body)
    timers.delete(key)
  }, diff)
  timers.set(key, timerId)
}

export function scheduleEventNotifications(events: CalendarEvent[]) {
  // 일정 타이머만 초기화
  eventTimers.forEach((t) => window.clearTimeout(t))
  eventTimers.clear()

  if (Notification.permission !== 'granted') return

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  events.forEach((event) => {
    if (event.reminder == null) return
    if (event.isAllDay || !event.startTime) return

    const reminderMin = event.reminder
    const eventMin = timeToMinutes(event.startTime)
    const targetMin = eventMin - reminderMin

    const targetDate = new Date(today)
    targetDate.setHours(0, targetMin, 0, 0)

    const key = `event-${event.id}`
    const displayTitle = event.title === '(제목 없음)' ? '일정' : event.title
    const body = reminderMin > 0 ? `${reminderMin}분 후 시작` : '지금 시작'
    scheduleItemReminder(eventTimers, key, displayTitle, body, targetDate)
  })
}

export function scheduleTaskNotifications(tasks: Task[]) {
  // 태스크 타이머만 초기화
  taskTimers.forEach((t) => window.clearTimeout(t))
  taskTimers.clear()

  if (Notification.permission !== 'granted') return

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  tasks.forEach((task) => {
    if (task.reminder == null) return
    if (!task.dueTime || task.isCompleted) return

    const reminderMin = task.reminder
    const taskMin = timeToMinutes(task.dueTime)
    const targetMin = taskMin - reminderMin

    const targetDate = new Date(today)
    targetDate.setHours(0, targetMin, 0, 0)

    const key = `task-${task.id}`
    const body = reminderMin > 0 ? `${reminderMin}분 후 시작` : '지금 시작'
    scheduleItemReminder(taskTimers, key, task.title, body, targetDate)
  })
}
