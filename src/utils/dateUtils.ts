import { format, isToday, isYesterday, isTomorrow } from 'date-fns'
import { ko } from 'date-fns/locale'

export function formatDate(date: Date, pattern: string = 'yyyy년 M월 d일'): string {
  return format(date, pattern, { locale: ko })
}

export function formatTime(date: Date): string {
  return format(date, 'HH:mm', { locale: ko })
}

export function formatRelativeDate(date: Date): string {
  if (isToday(date)) return '오늘'
  if (isYesterday(date)) return '어제'
  if (isTomorrow(date)) return '내일'
  return format(date, 'M월 d일 (EEEE)', { locale: ko })
}

export function formatDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getDayOfWeek(date: Date): string {
  return format(date, 'EEEE', { locale: ko })
}

export function getMonthYear(date: Date): string {
  return format(date, 'yyyy년 M월', { locale: ko })
}
