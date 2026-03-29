import { Timestamp } from 'firebase/firestore'
import { toggleTaskComplete, toggleSubItem } from '../../services/taskService'
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

  const handleToggleSubItem = (e: React.MouseEvent, subItemId: string) => {
    e.stopPropagation()
    toggleSubItem(task.id, subItems, subItemId, !!task.dueDate)
  }

  return (
    <div
      className={`task-item ${task.isCompleted ? 'task-completed' : ''}`}
      onClick={() => onEdit(task)}
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
  )
}
