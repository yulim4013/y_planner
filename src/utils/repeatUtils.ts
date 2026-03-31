/**
 * 반복 일정/태스크가 특정 날짜에 해당하는지 확인
 * @param originalDate 원본 시작 날짜
 * @param targetDate 확인할 날짜
 * @param repeat 반복 유형
 * @returns 해당 날짜에 반복 인스턴스가 있는지
 */
export function matchesRepeatDate(
  originalDate: Date,
  targetDate: Date,
  repeat: string | undefined,
): boolean {
  if (!repeat || repeat === 'none') return false

  // 원본 날짜와 같거나 이전이면 false (원본은 이미 표시됨)
  const orig = new Date(originalDate)
  orig.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)

  if (target.getTime() <= orig.getTime()) return false

  switch (repeat) {
    case 'daily':
      return true

    case 'weekly':
      return orig.getDay() === target.getDay()

    case 'monthly': {
      const origDay = orig.getDate()
      const targetDay = target.getDate()
      // 원본 날짜가 31일인데 해당 월이 30일까지만 있는 경우 → 마지막 날에 표시
      const lastDayOfMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      if (origDay > lastDayOfMonth) {
        return targetDay === lastDayOfMonth
      }
      return origDay === targetDay
    }

    case 'yearly': {
      const origMonth = orig.getMonth()
      const origDay = orig.getDate()
      // 2/29 → 윤년 아닌 해에는 2/28에 표시
      if (origMonth === 1 && origDay === 29) {
        const lastFeb = new Date(target.getFullYear(), 2, 0).getDate()
        return target.getMonth() === 1 && target.getDate() === lastFeb
      }
      return target.getMonth() === origMonth && target.getDate() === origDay
    }

    default:
      return false
  }
}
