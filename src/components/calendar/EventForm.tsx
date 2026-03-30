import { useState, useEffect } from 'react'
import { Timestamp } from 'firebase/firestore'
import BottomSheet from '../common/BottomSheet'
import { addEvent, updateEvent, deleteEvent } from '../../services/eventService'
import CategoryPicker from '../common/CategoryPicker'
import type { CalendarEvent } from '../../types'
import './EventForm.css'

interface EventFormProps {
  isOpen: boolean
  onClose: () => void
  editEvent?: CalendarEvent | null
  defaultDate?: Date
}

function toDateInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function EventForm({ isOpen, onClose, editEvent, defaultDate }: EventFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [isAllDay, setIsAllDay] = useState(true)
  const [location, setLocation] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title)
      setCategoryId(editEvent.categoryId || null)
      setDescription(editEvent.description || '')
      setStartDate(toDateInput(editEvent.startDate.toDate()))
      setEndDate(toDateInput(editEvent.endDate.toDate()))
      setStartTime(editEvent.startTime || '')
      setEndTime(editEvent.endTime || '')
      setIsAllDay(editEvent.isAllDay)
      setLocation(editEvent.location || '')
    } else {
      resetForm()
    }
  }, [editEvent, isOpen])

  function resetForm() {
    const d = defaultDate || new Date()
    const dateStr = toDateInput(d)
    setTitle('')
    setDescription('')
    setStartDate(dateStr)
    setEndDate(dateStr)
    setStartTime('')
    setEndTime('')
    setIsAllDay(true)
    setLocation('')
    setCategoryId(null)
  }

  const handleSubmit = async () => {
    if (!startDate) return

    const data = {
      title: title.trim() || '(제목 없음)',
      description: description.trim(),
      startDate: new Date(startDate + 'T00:00:00'),
      endDate: new Date((endDate || startDate) + 'T00:00:00'),
      startTime: isAllDay ? null : (startTime || null),
      endTime: isAllDay ? null : (endTime || null),
      isAllDay,
      categoryId: categoryId || null,
      location: location.trim(),
    }

    if (editEvent) {
      await updateEvent(editEvent.id, {
        ...data,
        startDate: Timestamp.fromDate(data.startDate),
        endDate: Timestamp.fromDate(data.endDate),
      })
    } else {
      await addEvent(data)
    }

    resetForm()
    onClose()
  }

  const handleDelete = async () => {
    if (!editEvent) return
    if (confirm('이 일정을 삭제하시겠습니까?')) {
      await deleteEvent(editEvent.id)
      onClose()
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={editEvent ? '일정 수정' : '일정 추가'} fullScreen>
      <div className="event-form">
        <input
          className="event-form-input"
          placeholder="일정 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          /* autoFocus 제거 - 모바일에서 키보드가 올라오면서 form이 밀리는 문제 방지 */
        />

        <div className="event-form-row">
          <label className="event-form-label">종일</label>
          <button
            className={`toggle-btn ${isAllDay ? 'active' : ''}`}
            onClick={() => setIsAllDay(!isAllDay)}
            type="button"
          >
            {isAllDay ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="event-form-row">
          <label className="event-form-label">시작일</label>
          <input
            type="date"
            className="event-form-date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              if (!endDate || e.target.value > endDate) setEndDate(e.target.value)
            }}
          />
        </div>

        {!isAllDay && (
          <div className="event-form-row">
            <label className="event-form-label">시작 시간</label>
            <input
              type="time"
              className="event-form-date"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        )}

        <div className="event-form-row">
          <label className="event-form-label">종료일</label>
          <input
            type="date"
            className="event-form-date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {!isAllDay && (
          <div className="event-form-row">
            <label className="event-form-label">종료 시간</label>
            <input
              type="time"
              className="event-form-date"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        )}

        <div className="event-form-location-row">
          <input
            className="event-form-input"
            placeholder="장소 (선택)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          {location.trim() && (
            <button
              type="button"
              className="event-location-map-btn"
              onClick={() => window.open(`https://map.naver.com/v5/search/${encodeURIComponent(location.trim())}`, '_blank')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </button>
          )}
        </div>

        <CategoryPicker type="event" value={categoryId} onChange={setCategoryId} />

        <textarea
          className="event-form-textarea"
          placeholder="메모 (선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <div className="event-form-actions">
          {editEvent && (
            <button className="event-form-delete" onClick={handleDelete} type="button">
              삭제
            </button>
          )}
          <button
            className="event-form-submit"
            onClick={handleSubmit}
            disabled={!startDate}
            type="button"
          >
            {editEvent ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
