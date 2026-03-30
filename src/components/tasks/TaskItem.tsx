import { useState, useRef } from 'react'
import { Timestamp } from 'firebase/firestore'
import { toggleTaskComplete, toggleSubItem, deleteTask } from '../../services/taskService'
import { PRIORITY_LABELS } from '../../utils/constants'
import type { Task, Category } from '../../types'
import './TaskItem.css'

interface TaskItemProps {
  task: Task
  onEdit: (task: Task) => void
  categories?: Category[]
  hideCategory?: boolean
}

function formatDueDate(dueDate: Timestamp | null, dueTime: string | null): string {
  if (!dueDate) return ''
  const date = dueDate.toDate()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  let label = ''
  if (diff === 0) label = '오늘'
  else if (diff === 1) label = '내일'
  else if (diff === -1) label = '어제'
  else if (diff < -1) label = `${Math.abs(diff)}일 전`
  else label = `${diff}일 후`

  if (dueTime) label += ` ${dueTime}`
  return label
}

export default function TaskItem({ task, onEdit, categories = [], hideCategory }: TaskItemProps) {
  const category = task.categoryId ? categories.find((c) => c.id === task.categoryId) : null
  const isOverdue = task.dueDate && !task.isCompleted &&
    task.dueDate.toDate().getTime() < new Date().setHours(0, 0, 0, 0)

  const subItems = task.subItems || []
  const hasSubItems = subItems.length > 0

  // 스와이프 상태
  const [swipeX, setSwipeX] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const swipingRef = useRef(false)
  const directionDecidedRef = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating) return
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    swipingRef.current = false
    directionDecidedRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAnimating) return
    const dx = e.touches[0].clientX - touchStartRef.current.x
    const dy = e.touches[0].clientY - touchStartRef.current.y

    if (!directionDecidedRef.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      directionDecidedRef.current = true
      swipingRef.current = Math.abs(dx) > Math.abs(dy)
    }

    if (swipingRef.current) {
      const newX = Math.min(0, Math.max(-100, dx))
      setSwipeX(newX)
    }
  }

  const handleTouchEnd = () => {
    if (isAnimating) return
    setIsAnimating(true)
    if (swipeX < -50) {
      setSwipeX(-80)
    } else {
      setSwipeX(0)
    }
    setTimeout(() => setIsAnimating(false), 200)
  }

  const handleDelete = async () => {
    if (confirm('이 할 일을 삭제하시겠습니까?')) {
      await deleteTask(task.id)
    } else {
      setSwipeX(0)
    }
  }

  const handleToggleSubItem = (e: React.MouseEvent, subItemId: string) => {
    e.stopPropagation()
    toggleSubItem(task.id, subItems, subItemId, !!task.dueDate)
  }

  // 스와이프 중이면 클릭 방지
  const handleClick = () => {
    if (Math.abs(swipeX) > 5) {
      setSwipeX(0)
      return
    }
    onEdit(task)
  }

  return (
    <div className="task-item-swipe-wrapper">
      {/* 삭제 버튼 (뒤에 숨겨져 있다가 스와이프 시 노출) */}
      <div className="task-swipe-delete" onClick={handleDelete}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
          <path d="M10 11v6" /><path d="M14 11v6" />
        </svg>
        <span>삭제</span>
      </div>

      {/* 스와이프 가능한 아이템 */}
      <div
        className={`task-item ${task.isCompleted ? 'task-completed' : ''}`}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isAnimating ? 'transform 0.2s ease-out' : 'none',
        }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          className={`task-checkbox ${task.isCompleted ? 'done' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            toggleTaskComplete(task.id, task.isCompleted, !!task.dueDate)
          }}
        >
          {task.isCompleted && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7l3 3L11 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="task-content">
          {!hideCategory && category && (
            <span className="task-category-badge" style={{ background: category.color }}>
              {category.icon} {category.name}
            </span>
          )}
          <div className="task-title-row">
            <span className="task-title">{task.title}</span>
            <span className={`task-priority priority-${task.priority}`}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          </div>
          {task.dueDate && (
            <div className="task-meta">
              <span className={`task-due ${isOverdue ? 'task-overdue' : ''}`}>
                {formatDueDate(task.dueDate, task.dueTime)}
              </span>
            </div>
          )}

          {hasSubItems && (
            <div className="task-subitems">
              {subItems.map((item) => (
                <div
                  key={item.id}
                  className={`task-subitem ${item.isCompleted ? 'subitem-done' : ''}`}
                  onClick={(e) => handleToggleSubItem(e, item.id)}
                >
                  <span className={`subitem-check ${item.isCompleted ? 'done' : ''}`}>
                    {item.isCompleted && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="subitem-text">{item.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
