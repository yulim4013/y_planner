import { useState, useEffect } from 'react'
import BottomSheet from '../common/BottomSheet'
import { subscribeCategories, addCategory, updateCategory, deleteCategory } from '../../services/categoryService'
import { PASTEL_COLORS } from '../../utils/constants'
import type { Category } from '../../types'
import './CategoryManager.css'

interface CategoryManagerProps {
  isOpen: boolean
  onClose: () => void
}

export default function CategoryManager({ isOpen, onClose }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PASTEL_COLORS[0].value)
  const [icon, setIcon] = useState('')
  const [type, setType] = useState<'task' | 'event'>('task')
  const [eventCategoryId, setEventCategoryId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeCategories(setCategories)
    return unsub
  }, [])

  const eventCats = categories.filter((c) => c.type === 'event' || c.type === 'all')
  const taskCats = categories.filter((c) => c.type === 'task' || c.type === 'all')


  const openAdd = (catType: 'task' | 'event') => {
    setEditCat(null)
    setName('')
    setColor(PASTEL_COLORS[0].value)
    setIcon('')
    setType(catType)
    setEventCategoryId(null)
    setFormOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditCat(cat)
    setName(cat.name)
    setColor(cat.color)
    setIcon(cat.icon)
    setType(cat.type === 'expense' || cat.type === 'all' ? 'task' : cat.type)
    setEventCategoryId(cat.eventCategoryId || null)
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (editCat) {
      await updateCategory(editCat.id, {
        name: name.trim(),
        color,
        icon,
        type,
        eventCategoryId: type === 'task' ? eventCategoryId : null,
      })
    } else {
      await addCategory({
        name: name.trim(),
        color,
        icon,
        type,
        order: categories.length,
        eventCategoryId: type === 'task' ? eventCategoryId : null,
      })
    }
    setFormOpen(false)
  }

  const handleDelete = async () => {
    if (!editCat) return
    if (confirm(`"${editCat.name}" 카테고리를 삭제하시겠습니까?`)) {
      await deleteCategory(editCat.id)
      setFormOpen(false)
    }
  }

  // Task 카테고리를 상위 일정 카테고리별로 그룹핑
  const groupedTaskCats = (() => {
    const groups: { eventCat: Category | null; tasks: Category[] }[] = []
    const byEventCat = new Map<string | null, Category[]>()

    taskCats.forEach((tc) => {
      const key = tc.eventCategoryId || null
      if (!byEventCat.has(key)) byEventCat.set(key, [])
      byEventCat.get(key)!.push(tc)
    })

    // 상위 카테고리가 있는 것 먼저
    eventCats.forEach((ec) => {
      const tasks = byEventCat.get(ec.id)
      if (tasks) {
        groups.push({ eventCat: ec, tasks })
        byEventCat.delete(ec.id)
      }
    })

    // 상위 없는 task 카테고리
    const ungrouped = byEventCat.get(null)
    if (ungrouped) {
      groups.push({ eventCat: null, tasks: ungrouped })
    }

    return groups
  })()

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title="카테고리 관리">
        <div className="cat-manager">
          {/* 일정 카테고리 */}
          <div className="cat-section">
            <div className="cat-section-header">
              <span className="cat-section-title">일정 카테고리</span>
              <button className="cat-section-add" onClick={() => openAdd('event')}>+</button>
            </div>
            {eventCats.length === 0 && <p className="cat-empty">카테고리가 없습니다</p>}
            {eventCats.map((cat) => (
              <div key={cat.id} className="cat-item" onClick={() => openEdit(cat)}>
                <span className="cat-color" style={{ background: cat.color }} />
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
                <span className="cat-type-badge">일정</span>
              </div>
            ))}
          </div>

          {/* Task 카테고리 */}
          <div className="cat-section">
            <div className="cat-section-header">
              <span className="cat-section-title">Task 카테고리</span>
              <button className="cat-section-add" onClick={() => openAdd('task')}>+</button>
            </div>
            {taskCats.length === 0 && <p className="cat-empty">카테고리가 없습니다</p>}
            {groupedTaskCats.map((group, gi) => (
              <div key={gi}>
                {group.eventCat && (
                  <div className="cat-group-header">
                    <span className="cat-color" style={{ background: group.eventCat.color }} />
                    <span className="cat-group-name">{group.eventCat.icon} {group.eventCat.name}</span>
                  </div>
                )}
                {group.tasks.map((cat) => (
                  <div
                    key={cat.id}
                    className={`cat-item ${group.eventCat ? 'cat-child' : ''}`}
                    onClick={() => openEdit(cat)}
                  >
                    <span className="cat-color" style={{ background: cat.color }} />
                    <span className="cat-icon">{cat.icon}</span>
                    <span className="cat-name">{cat.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={formOpen} onClose={() => setFormOpen(false)} title={editCat ? '카테고리 수정' : '카테고리 추가'}>
        <div className="cat-form">
          <input
            className="cat-form-input"
            placeholder="카테고리 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="cat-form-input"
            placeholder="아이콘 (이모지)"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={2}
          />

          <div className="cat-form-row">
            <label className="cat-form-label">유형</label>
            <div className="cat-type-selector">
              {(['event', 'task'] as const).map((t) => (
                <button
                  key={t}
                  className={`cat-type-btn ${type === t ? 'active' : ''}`}
                  onClick={() => setType(t)}
                  type="button"
                >
                  {t === 'task' ? 'Task' : '일정'}
                </button>
              ))}
            </div>
          </div>

          {/* Task 카테고리일 때 상위 일정 카테고리 선택 */}
          {type === 'task' && eventCats.length > 0 && (
            <div className="cat-form-row">
              <label className="cat-form-label">상위 일정</label>
              <select
                className="cat-form-select"
                value={eventCategoryId || ''}
                onChange={(e) => setEventCategoryId(e.target.value || null)}
              >
                <option value="">없음</option>
                {eventCats.map((ec) => (
                  <option key={ec.id} value={ec.id}>{ec.icon} {ec.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="cat-form-section">
            <label className="cat-form-label">색상</label>
            <div className="cat-color-grid">
              {PASTEL_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`cat-color-btn ${color === c.value ? 'selected' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => setColor(c.value)}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div className="cat-form-actions">
            {editCat && (
              <button className="cat-form-delete" onClick={handleDelete} type="button">삭제</button>
            )}
            <button className="cat-form-save" onClick={handleSave} disabled={!name.trim()} type="button">
              {editCat ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
