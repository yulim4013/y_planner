import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import BottomSheet from '../common/BottomSheet'
import { addTask, updateTask, deleteTask } from '../../services/taskService'
import CategoryPicker from '../common/CategoryPicker'
import type { Task, SubItem } from '../../types'
import './TaskForm.css'

interface TaskFormProps {
  isOpen: boolean
  onClose: () => void
  editTask?: Task | null
}

export default function TaskForm({ isOpen, onClose, editTask }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [subItems, setSubItems] = useState<SubItem[]>([])
  const [newSubItem, setNewSubItem] = useState('')

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title)
      setDescription(editTask.description || '')
      setPriority(editTask.priority)
      setCategoryId(editTask.categoryId || null)
      setDueDate(editTask.dueDate ? formatDateInput(editTask.dueDate.toDate()) : '')
      setDueTime(editTask.dueTime || '')
      setSubItems(editTask.subItems || [])
    } else {
      resetForm()
    }
  }, [editTask, isOpen])

  function resetForm() {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setCategoryId(null)
    setDueDate('')
    setDueTime('')
    setSubItems([])
    setNewSubItem('')
  }

  function formatDateInput(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const handleAddSubItem = () => {
    const text = newSubItem.trim()
    if (!text) return
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    setSubItems((prev) => [
      ...prev,
      { id, text, isCompleted: false, order: prev.length },
    ])
    setNewSubItem('')
  }

  const handleRemoveSubItem = (id: string) => {
    setSubItems(subItems.filter((s) => s.id !== id))
  }

  const handleToggleSubItem = (id: string) => {
    setSubItems(subItems.map((s) =>
      s.id === id ? { ...s, isCompleted: !s.isCompleted } : s
    ))
  }

  const handleSubmit = async () => {
    if (!title.trim()) return

    const plainSubItems = subItems.map((s) => ({
      id: s.id,
      text: s.text,
      isCompleted: s.isCompleted,
      order: s.order,
    }))

    const data = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate ? new Date(dueDate + 'T00:00:00') : null,
      dueTime: dueTime || null,
      categoryId: categoryId || null,
      subItems: plainSubItems,
    }

    if (editTask) {
      await updateTask(editTask.id, {
        ...data,
        dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
      })
    } else {
      await addTask(data)
    }

    resetForm()
    onClose()
  }

  const handleDelete = async () => {
    if (!editTask) return
    if (confirm('이 할 일을 삭제하시겠습니까?')) {
      await deleteTask(editTask.id)
      onClose()
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={editTask ? 'Edit Task' : 'Add Task'}>
      <div className="task-form">
        <input
          className="task-form-input"
          placeholder="제목을 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <textarea
          className="task-form-textarea"
          placeholder="설명 (선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <div className="task-form-row">
          <label className="task-form-label">우선순위</label>
          <div className="priority-selector">
            {(['high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                className={`priority-btn priority-${p} ${priority === p ? 'active' : ''}`}
                onClick={() => setPriority(p)}
                type="button"
              >
                {p === 'high' ? '높음' : p === 'medium' ? '중간' : '낮음'}
              </button>
            ))}
          </div>
        </div>

        <CategoryPicker type="task" value={categoryId} onChange={setCategoryId} />

        <div className="task-form-row">
          <label className="task-form-label">마감일</label>
          <input
            type="date"
            className="task-form-date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="task-form-row">
          <label className="task-form-label">시간</label>
          <input
            type="time"
            className="task-form-date"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>

        <div className="task-form-section">
          <label className="task-form-label">체크리스트</label>
          {subItems.map((item) => (
            <div key={item.id} className="sub-item-row">
              <button
                className="sub-item-check"
                onClick={() => handleToggleSubItem(item.id)}
                type="button"
              >
                {item.isCompleted ? '☑' : '☐'}
              </button>
              <span className={item.isCompleted ? 'sub-item-done' : ''}>{item.text}</span>
              <button
                className="sub-item-remove"
                onClick={() => handleRemoveSubItem(item.id)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
          <div className="sub-item-add">
            <input
              placeholder="항목 추가..."
              value={newSubItem}
              onChange={(e) => setNewSubItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubItem()}
            />
            <button onClick={handleAddSubItem} type="button">+</button>
          </div>
        </div>

        <div className="task-form-actions">
          {editTask && (
            <button className="task-form-delete" onClick={handleDelete} type="button">
              삭제
            </button>
          )}
          <button
            className="task-form-submit"
            onClick={handleSubmit}
            disabled={!title.trim()}
            type="button"
          >
            {editTask ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
