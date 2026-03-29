import { useState, useEffect } from 'react'
import { subscribeCategories, addCategory } from '../../services/categoryService'
import { PASTEL_COLORS } from '../../utils/constants'
import type { Category } from '../../types'
import './CategoryPicker.css'

interface CategoryPickerProps {
  type: 'task' | 'event'
  value: string | null
  onChange: (id: string | null) => void
}

export default function CategoryPicker({ type, value, onChange }: CategoryPickerProps) {
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [newColor, setNewColor] = useState(PASTEL_COLORS[0].value)
  const [newEventCategoryId, setNewEventCategoryId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeCategories(setAllCategories)
    return unsub
  }, [])

  const eventCats = allCategories.filter((c) => c.type === 'event' || c.type === 'all')
  const categories = allCategories.filter((c) => {
    if (type === 'event') return c.type === 'event' || c.type === 'all'
    return c.type === 'task' || c.type === 'all'
  })

  // Task 타입일 때 이벤트 카테고리별 그룹핑
  const taskGroups = (() => {
    if (type !== 'task') return null

    const groups: { eventCat: Category | null; tasks: Category[] }[] = []
    const byEventCat = new Map<string | null, Category[]>()

    categories.forEach((c) => {
      const key = c.eventCategoryId || null
      if (!byEventCat.has(key)) byEventCat.set(key, [])
      byEventCat.get(key)!.push(c)
    })

    // 상위 카테고리가 있는 그룹
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

  const handleAdd = async () => {
    if (!newName.trim()) return
    const result = await addCategory({
      name: newName.trim(),
      color: newColor,
      icon: newIcon || '📌',
      type,
      order: categories.length,
      eventCategoryId: type === 'task' ? newEventCategoryId : null,
    })
    if (result) {
      onChange(result.id)
    }
    setNewName('')
    setNewIcon('')
    setNewColor(PASTEL_COLORS[0].value)
    setNewEventCategoryId(null)
    setAdding(false)
  }

  return (
    <div className="cat-picker">
      <label className="cat-picker-label">카테고리</label>

      {/* Task: 상위 카테고리별 그룹 */}
      {type === 'task' && taskGroups ? (
        <div className="cp-grouped">
          <button
            className={`cp-btn ${!value ? 'cp-active' : ''}`}
            onClick={() => onChange(null)}
            type="button"
          >
            없음
          </button>
          {taskGroups.map((group, gi) => (
            <div key={gi} className="cp-group">
              {group.eventCat && (
                <div className="cp-group-label">
                  <span className="cp-group-color" style={{ background: group.eventCat.color }} />
                  {group.eventCat.icon} {group.eventCat.name}
                </div>
              )}
              <div className="cp-group-items">
                {group.tasks.map((cat) => (
                  <button
                    key={cat.id}
                    className={`cp-btn ${value === cat.id ? 'cp-active' : ''}`}
                    onClick={() => onChange(cat.id)}
                    type="button"
                    style={value === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            className="cp-btn cp-add"
            onClick={() => setAdding(!adding)}
            type="button"
          >
            + 추가
          </button>
        </div>
      ) : (
        /* Event: 플랫 리스트 */
        <div className="cat-picker-list">
          <button
            className={`cp-btn ${!value ? 'cp-active' : ''}`}
            onClick={() => onChange(null)}
            type="button"
          >
            없음
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`cp-btn ${value === cat.id ? 'cp-active' : ''}`}
              onClick={() => onChange(cat.id)}
              type="button"
              style={value === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
          <button
            className="cp-btn cp-add"
            onClick={() => setAdding(!adding)}
            type="button"
          >
            + 추가
          </button>
        </div>
      )}

      {adding && (
        <div className="cp-add-form">
          <div className="cp-add-row">
            <input
              className="cp-add-icon"
              placeholder="🏷️"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              maxLength={2}
            />
            <input
              className="cp-add-name"
              placeholder="카테고리 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Task 카테고리 추가 시 상위 일정 카테고리 선택 */}
          {type === 'task' && eventCats.length > 0 && (
            <div className="cp-add-row">
              <select
                className="cp-add-parent"
                value={newEventCategoryId || ''}
                onChange={(e) => setNewEventCategoryId(e.target.value || null)}
              >
                <option value="">상위 일정 카테고리 없음</option>
                {eventCats.map((ec) => (
                  <option key={ec.id} value={ec.id}>{ec.icon} {ec.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="cp-colors">
            {PASTEL_COLORS.map((c) => (
              <button
                key={c.value}
                className={`cp-color ${newColor === c.value ? 'cp-color-sel' : ''}`}
                style={{ background: c.value }}
                onClick={() => setNewColor(c.value)}
                type="button"
              />
            ))}
          </div>
          <div className="cp-add-actions">
            <button className="cp-cancel" onClick={() => setAdding(false)} type="button">취소</button>
            <button className="cp-save" onClick={handleAdd} disabled={!newName.trim()} type="button">추가</button>
          </div>
        </div>
      )}
    </div>
  )
}
