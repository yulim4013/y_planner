import { useState, useEffect } from 'react'
import Header from '../layout/Header'
import GlassCard from '../common/GlassCard'
import TaskItem from './TaskItem'
import TaskForm from './TaskForm'
import { subscribeTasks } from '../../services/taskService'
import { subscribeCategoriesByType } from '../../services/categoryService'
import type { Task, Category } from '../../types'
import './TasksPage.css'

type FilterType = 'all' | 'todo' | 'done' | 'overdue'
type SortType = 'priority' | 'date' | 'category'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('date')
  const [formOpen, setFormOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const unsub = subscribeTasks(setTasks)
    const unsubCat = subscribeCategoriesByType('task', setCategories)
    return () => { unsub(); unsubCat() }
  }, [])

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const dayAfterTomorrow = new Date(now)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2) // 내일 23:59:59까지

  // 3일치 범위 (어제~내일) + 마감일 없는 미완료 task
  const threeDayTasks = tasks.filter((t) => {
    if (!t.dueDate) return !t.isCompleted // 마감일 없는 미완료는 항상 노출
    const d = t.dueDate.toDate()
    return d >= yesterday && d < dayAfterTomorrow
  })

  const overdueTasks = tasks.filter((t) =>
    !t.isCompleted && t.dueDate && t.dueDate.toDate() < now
  )

  const filtered = threeDayTasks.filter((t) => {
    if (filter === 'todo') return !t.isCompleted
    if (filter === 'done') return t.isCompleted
    if (filter === 'overdue') return !t.isCompleted && t.dueDate && t.dueDate.toDate() < now
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const aDate = a.dueDate ? a.dueDate.toDate().getTime() : Infinity
    const bDate = b.dueDate ? b.dueDate.toDate().getTime() : Infinity
    const aPri = PRIORITY_ORDER[a.priority]
    const bPri = PRIORITY_ORDER[b.priority]

    if (sort === 'category') {
      const aCat = a.categoryId || ''
      const bCat = b.categoryId || ''
      if (aCat !== bCat) return aCat.localeCompare(bCat)
      if (aDate !== bDate) return aDate - bDate
      return aPri - bPri
    }
    if (sort === 'priority') {
      if (aPri !== bPri) return aPri - bPri
      if (aDate !== bDate) return aDate - bDate
      return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
    }
    // 시간순
    if (aDate !== bDate) return aDate - bDate
    if (aPri !== bPri) return aPri - bPri
    return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
  })

  // 카테고리 정렬 시 그룹핑
  const categoryGroups = sort === 'category' ? (() => {
    const groups: { cat: Category | null; tasks: Task[] }[] = []
    const map = new Map<string, Task[]>()
    sorted.forEach((t) => {
      const key = t.categoryId || '__none__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    map.forEach((tasks, key) => {
      const cat = key === '__none__' ? null : categories.find((c) => c.id === key) || null
      groups.push({ cat, tasks })
    })
    // 카테고리 있는 그룹 먼저, 없는 그룹 마지막
    groups.sort((a, b) => {
      if (!a.cat && b.cat) return 1
      if (a.cat && !b.cat) return -1
      return 0
    })
    return groups
  })() : null

  const todoCount = threeDayTasks.filter((t) => !t.isCompleted).length
  const doneCount = threeDayTasks.filter((t) => t.isCompleted).length

  const handleEdit = (task: Task) => {
    setEditTask(task)
    setFormOpen(true)
  }

  const handleAdd = () => {
    setEditTask(null)
    setFormOpen(true)
  }

  return (
    <div className="page">
      <Header title="TASK" right={
        <button className="header-add-btn" onClick={handleAdd}>+</button>
      } />

      <div className="task-controls">
        <div className="task-sort">
          <button
            className={`sort-btn ${sort === 'date' ? 'active' : ''}`}
            onClick={() => setSort('date')}
          >
            시간순
          </button>
          <button
            className={`sort-btn ${sort === 'priority' ? 'active' : ''}`}
            onClick={() => setSort('priority')}
          >
            중요도순
          </button>
          <button
            className={`sort-btn ${sort === 'category' ? 'active' : ''}`}
            onClick={() => setSort('category')}
          >
            카테고리
          </button>
        </div>
        <div className="task-filters">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            전체 ({threeDayTasks.length})
          </button>
          <button className={`filter-btn ${filter === 'todo' ? 'active' : ''}`} onClick={() => setFilter('todo')}>
            진행중 ({todoCount})
          </button>
          <button className={`filter-btn ${filter === 'done' ? 'active' : ''}`} onClick={() => setFilter('done')}>
            완료 ({doneCount})
          </button>
          {overdueTasks.length > 0 && (
            <button className={`filter-btn filter-overdue ${filter === 'overdue' ? 'active' : ''}`} onClick={() => setFilter('overdue')}>
              미완료 ({overdueTasks.length})
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <GlassCard>
          <p style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', padding: '40px 0' }}>
            {filter === 'done' ? '완료된 할 일이 없습니다' :
             filter === 'overdue' ? '미완료된 할 일이 없습니다' :
             '등록된 할 일이 없습니다'}
          </p>
        </GlassCard>
      ) : sort === 'category' && categoryGroups ? (
        categoryGroups.map((group, i) => (
          <GlassCard key={group.cat?.id || '__none__'}>
            <div className="cat-group-header">
              {group.cat ? (
                <span className="cat-group-badge" style={{ background: group.cat.color }}>
                  {group.cat.icon} {group.cat.name}
                </span>
              ) : (
                <span className="cat-group-badge cat-group-none">카테고리 없음</span>
              )}
              <span className="cat-group-count">{group.tasks.length}</span>
            </div>
            {group.tasks.map((task) => (
              <TaskItem key={task.id} task={task} onEdit={handleEdit} categories={categories} hideCategory />
            ))}
          </GlassCard>
        ))
      ) : (
        <GlassCard>
          {sorted.map((task) => (
            <TaskItem key={task.id} task={task} onEdit={handleEdit} categories={categories} />
          ))}
        </GlassCard>
      )}

      <TaskForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditTask(null) }}
        editTask={editTask}
      />
    </div>
  )
}
