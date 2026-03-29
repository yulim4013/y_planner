export const PASTEL_COLORS = [
  { name: '분홍', value: '#FFD1DC' },
  { name: '파랑', value: '#C5D5F5' },
  { name: '초록', value: '#C8E6C9' },
  { name: '보라', value: '#D1C4E9' },
  { name: '주황', value: '#FFE0B2' },
  { name: '노랑', value: '#FFF9C4' },
  { name: '민트', value: '#B2DFDB' },
  { name: '복숭아', value: '#FFCCBC' },
  { name: '라벤더', value: '#E1BEE7' },
  { name: '하늘', value: '#B3E5FC' },
] as const

export const DEFAULT_TASK_CATEGORIES = [
  { name: '업무', color: '#C5D5F5', icon: '💼' },
  { name: '개인', color: '#D1C4E9', icon: '👤' },
  { name: '쇼핑', color: '#C8E6C9', icon: '🛒' },
  { name: '건강', color: '#FFE0B2', icon: '💪' },
  { name: '공부', color: '#FFF9C4', icon: '📚' },
]

export const DEFAULT_EVENT_CATEGORIES = [
  { name: '미팅', color: '#C5D5F5', icon: '🤝' },
  { name: '약속', color: '#FFD1DC', icon: '📅' },
  { name: '여행', color: '#B2DFDB', icon: '✈️' },
  { name: '기념일', color: '#E1BEE7', icon: '🎉' },
]

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: '식비', color: '#FFE0B2', icon: '🍽️' },
  { name: '교통', color: '#C5D5F5', icon: '🚌' },
  { name: '쇼핑', color: '#FFD1DC', icon: '🛍️' },
  { name: '문화', color: '#D1C4E9', icon: '🎬' },
  { name: '의료', color: '#C8E6C9', icon: '🏥' },
  { name: '주거', color: '#B2DFDB', icon: '🏠' },
  { name: '통신', color: '#B3E5FC', icon: '📱' },
  { name: '기타', color: '#FFF9C4', icon: '📦' },
]

export const INCOME_CATEGORIES = [
  { name: '월급', icon: '💰', color: '#C8E6C9' },
  { name: '기타수입', icon: '💵', color: '#B2DFDB' },
]

export const FIXED_EXPENSE_CATEGORIES = [
  { name: '보험', icon: '🛡️', color: '#C5D5F5' },
  { name: '주거비', icon: '🏠', color: '#B2DFDB' },
  { name: '빚', icon: '💳', color: '#D1C4E9' },
  { name: '통신비', icon: '📱', color: '#B3E5FC' },
  { name: '교통비', icon: '🚗', color: '#FFE0B2' },
  { name: '기부', icon: '❤️', color: '#FFD1DC' },
  { name: '적금', icon: '🏦', color: '#C8E6C9' },
  { name: '구독', icon: '📋', color: '#E1BEE7' },
]

export const VARIABLE_EXPENSE_CATEGORIES = [
  { name: '식비', icon: '🍚', color: '#FFE0B2' },
  { name: '문화생활', icon: '🎬', color: '#D1C4E9' },
  { name: '쇼핑', icon: '🛍️', color: '#FFD1DC' },
  { name: '운동', icon: '🏃', color: '#B3E5FC' },
  { name: '의료비', icon: '🏥', color: '#C8E6C9' },
  { name: '선물', icon: '🎁', color: '#FFCCBC' },
  { name: '기타', icon: '📌', color: '#FFF9C4' },
  { name: '미용', icon: '💇', color: '#E1BEE7' },
]

export const ALL_BUDGET_CATEGORIES = [
  ...INCOME_CATEGORIES.map((c) => ({ ...c, type: 'income' as const, subType: null })),
  ...FIXED_EXPENSE_CATEGORIES.map((c) => ({ ...c, type: 'expense' as const, subType: 'fixed' as const })),
  ...VARIABLE_EXPENSE_CATEGORIES.map((c) => ({ ...c, type: 'expense' as const, subType: 'variable' as const })),
]

export function getBudgetCategory(name: string) {
  return ALL_BUDGET_CATEGORIES.find((c) => c.name === name)
}

export const MOOD_EMOJI: Record<string, string> = {
  great: '😄',
  good: '🙂',
  okay: '😐',
  bad: '😔',
  terrible: '😢',
}

export const PRIORITY_LABELS: Record<string, string> = {
  high: '높음',
  medium: '중간',
  low: '낮음',
}
