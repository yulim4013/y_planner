import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday as isDateToday,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../layout/Header'
import GlassCard from '../common/GlassCard'
import DiaryForm from './DiaryForm'
import { subscribeDiaryEntries, deleteDiaryEntry } from '../../services/diaryService'
import type { DiaryEntry, Mood } from '../../types'
import './DiaryPage.css'

const MOOD_EMOJI: Record<Mood, string> = {
  great: '\u{1F606}',
  good: '\u{1F60A}',
  okay: '\u{1F610}',
  bad: '\u{1F615}',
  terrible: '\u{1F622}',
}
const MOOD_LABEL: Record<Mood, string> = {
  great: '최고',
  good: '좋음',
  okay: '보통',
  bad: '별로',
  terrible: '나쁨',
}

function isSameDayFn(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function DiaryPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null)

  useEffect(() => {
    return subscribeDiaryEntries((data) => setEntries(data))
  }, [])

  // 월별 그리드 데이터
  const calDays = useMemo(() => {
    const ms = startOfMonth(currentMonth)
    const me = endOfMonth(currentMonth)
    const cs = startOfWeek(ms, { weekStartsOn: 0 })
    const ce = endOfWeek(me, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: cs, end: ce })
  }, [currentMonth])

  // 날짜별 일기 매핑
  const entryMap = useMemo(() => {
    const map = new Map<string, DiaryEntry>()
    entries.forEach((e) => {
      const d = e.date.toDate()
      map.set(format(d, 'yyyy-MM-dd'), e)
    })
    return map
  }, [entries])

  const selectedEntry = selectedDate
    ? entries.find((e) => isSameDayFn(e.date.toDate(), selectedDate))
    : null

  const handlePrevMonth = useCallback(() => setCurrentMonth((d) => subMonths(d, 1)), [])
  const handleNextMonth = useCallback(() => setCurrentMonth((d) => addMonths(d, 1)), [])
  const handleGoToday = useCallback(() => {
    setCurrentMonth(new Date())
    setSelectedDate(null)
  }, [])

  const handleDayClick = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd')
    const entry = entryMap.get(key)
    if (entry) {
      setSelectedDate(day)
    } else {
      setSelectedDate(day)
      setEditEntry(null)
      setFormOpen(true)
    }
  }

  const handleWrite = () => {
    if (selectedEntry) {
      setEditEntry(selectedEntry)
    } else {
      setEditEntry(null)
    }
    setFormOpen(true)
  }

  const handleEditEntry = (entry: DiaryEntry) => {
    setSelectedDate(entry.date.toDate())
    setEditEntry(entry)
    setFormOpen(true)
  }

  const handleDeleteEntry = async (id: string) => {
    if (confirm('이 일기를 삭제할까요?')) {
      await deleteDiaryEntry(id)
      setSelectedDate(null)
    }
  }

  return (
    <div className="page">
      <Header title="DIARY" right={
        <button className="header-add-btn" onClick={handleWrite}>+</button>
      } />

      {/* 월 네비게이션 */}
      <div className="diary-date-nav">
        <button className="diary-nav-btn" onClick={handlePrevMonth}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button className="diary-date-label" onClick={handleGoToday}>
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </button>
        <button className="diary-nav-btn" onClick={handleNextMonth}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 월별 그리드 캘린더 */}
      <div className="diary-month-grid">
        <div className="diary-weekday-header">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={`diary-weekday ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}`}>{d}</div>
          ))}
        </div>
        <div className="diary-cal-grid">
          {calDays.map((day) => {
            const inMonth = isSameMonth(day, currentMonth)
            const today = isDateToday(day)
            const selected = selectedDate && isSameDay(day, selectedDate)
            const key = format(day, 'yyyy-MM-dd')
            const entry = entryMap.get(key)
            const dayOfWeek = day.getDay()

            return (
              <div
                key={day.toISOString()}
                className={`diary-cal-day ${!inMonth ? 'other-month' : ''} ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${dayOfWeek === 0 ? 'sun' : dayOfWeek === 6 ? 'sat' : ''}`}
                onClick={() => inMonth && handleDayClick(day)}
              >
                <span className="diary-cal-num">{format(day, 'd')}</span>
                {entry && (
                  <span className="diary-cal-mood">{entry.mood ? MOOD_EMOJI[entry.mood] : '📝'}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 선택된 날짜의 일기 */}
      {selectedDate && selectedEntry && (
        <GlassCard>
          <div className="diary-entry-card">
            <div className="diary-entry-header">
              <span className="diary-entry-date-label">
                {format(selectedDate, 'M월 d일 EEEE', { locale: ko })}
              </span>
              <div className="diary-entry-actions">
                <button className="diary-edit-btn" onClick={() => handleEditEntry(selectedEntry)}>수정</button>
                <button className="diary-delete-btn" onClick={() => handleDeleteEntry(selectedEntry.id)}>삭제</button>
              </div>
            </div>
            {selectedEntry.mood && (
              <span className="diary-mood-display">
                <span className="diary-mood-emoji">{MOOD_EMOJI[selectedEntry.mood]}</span>
                <span className="diary-mood-text">{MOOD_LABEL[selectedEntry.mood]}</span>
              </span>
            )}
            {selectedEntry.title && <h4 className="diary-entry-title">{selectedEntry.title}</h4>}
            <p className="diary-entry-content">{selectedEntry.content}</p>
            {selectedEntry.photos && selectedEntry.photos.length > 0 && (
              <div className="diary-entry-photos">
                {selectedEntry.photos.map((photo, i) => (
                  <div key={i} className="diary-entry-photo">
                    <img src={photo.url} alt="" />
                  </div>
                ))}
              </div>
            )}
            {selectedEntry.links && selectedEntry.links.length > 0 && (
              <div className="diary-entry-links">
                {selectedEntry.links.map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="diary-entry-link">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                    <span>{link.replace(/^https?:\/\//, '').slice(0, 50)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {selectedDate && !selectedEntry && (
        <GlassCard>
          <div className="diary-empty-state">
            <p className="diary-empty-text">{format(selectedDate, 'M월 d일', { locale: ko })} 일기가 없어요</p>
            <button className="diary-write-btn" onClick={handleWrite}>일기 쓰기</button>
          </div>
        </GlassCard>
      )}

      <DiaryForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditEntry(null) }}
        editEntry={editEntry}
        selectedDate={selectedDate || new Date()}
      />
    </div>
  )
}
