// 브라우저 알림(Notification API) 기반 루틴 알림 서비스
// FCM 없이 클라이언트 사이드에서 동작. 앱이 열려 있을 때만 작동.

import type { Routine } from '../types'

let scheduledTimers: Map<string, number> = new Map()

// 알림 권한 요청
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('이 브라우저는 알림을 지원하지 않습니다')
    return false
  }
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

// 알림 권한 상태
export function getNotificationPermission(): string {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

// 알림 보내기
function showNotification(title: string, body: string, iconId?: string) {
  if (Notification.permission !== 'granted') return

  const iconMap: Record<string, string> = {
    sunrise: '\u{1F305}',
    moon: '\u{1F319}',
    stretch: '\u{1F9D8}',
    water: '\u{1F4A7}',
    pill: '\u{1F48A}',
    journal: '\u{1F4DD}',
  }
  const emoji = iconId ? iconMap[iconId] || '\u{23F0}' : '\u{23F0}'

  try {
    new Notification(`${emoji} ${title}`, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `routine-${title}`,
      requireInteraction: false,
    })
  } catch {
    // 모바일 Safari 등에서 Notification 생성자 미지원 시
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: `${emoji} ${title}`,
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
    scheduledTimers.delete(routine.id)
  }, diff)

  scheduledTimers.set(routine.id, timerId)
}

// 모든 루틴 알림 스케줄링 (루틴 목록이 변경될 때 호출)
export function scheduleAllRoutineNotifications(routines: Routine[]) {
  // 기존 타이머 모두 제거
  clearAllScheduledNotifications()

  if (Notification.permission !== 'granted') return

  routines.forEach((routine) => {
    scheduleRoutineNotification(routine)
  })
}

// 모든 스케줄된 알림 취소
export function clearAllScheduledNotifications() {
  scheduledTimers.forEach((timerId) => window.clearTimeout(timerId))
  scheduledTimers.clear()
}
