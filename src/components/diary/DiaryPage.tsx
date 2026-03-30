import { useState, useEffect } from 'react'
import { format, addDays, subDays } from 'date-fns'
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

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function isToday(d: Date) {
  return isSameDay(d, new Date())
}

export default function DiaryPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<DiaryEntry | null>(null)

  useEffect(() => {
    return subscribeDiaryEntries((data) => setEntries(data))
  }, [])

  const todayEntry = entries.find((e) => isSameDay(e.date.toDate(), selectedDate))
  const recentEntries = entries
    .filter((e) => !isSameDay(e.date.toDate(), selectedDate))
    .slice(0, 20)

  const handlePrevDay = () => setSelectedDate((d) => subDays(d, 1))
  const handleNextDay = () => setSelectedDate((d) => addDays(d, 1))
  const handleToday = () => setSelectedDate(new Date())

  const handleWrite = () => {
    if (todayEntry) {
      setEditEntry(todayEntry)
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
    }
  }

  const dateStr = format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })

  return (
    <div className="page">
      <Header title="다이어리" right={
        <button className="header-add-btn" onClick={handleWrite}>+</button>
      } />

      {/* 날짜 네비게이션 */}
      <div className="diary-date-nav">
        <button className="diary-nav-btn" onClick={handlePrevDay}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button className="diary-date-label" onClick={handleToday}>
          {dateStr}
          {isToday(selectedDate) && <span className="diary-today-badge">오늘</span>}
        </button>
        <button className="diary-nav-btn" onClick={handleNextDay}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 선택된 날짜의 일기 */}
      {todayEntry ? (
        <GlassCard>
          <div className="diary-entry-card">
            <div className="diary-entry-header">
              {todayEntry.mood && (
                <span className="diary-mood-display">
                  <span className="diary-mood-emoji">{MOOD_EMOJI[todayEntry.mood]}</span>
                  <span className="diary-mood-text">{MOOD_LABEL[todayEntry.mood]}</span>
                </span>
              )}
              <div className="diary-entry-actions">
                <button className="diary-edit-btn" onClick={() => handleEditEntry(todayEntry)}>수정</button>
                <button className="diary-delete-btn" onClick={() => handleDeleteEntry(todayEntry.id)}>삭제</button>
              </div>
            </div>
            <p className="diary-entry-content">{todayEntry.content}</p>
            {todayEntry.tasksSummary.length > 0 && (
              <div className="diary-summary">
                <span className="diary-summary-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12l3 3 5-6" /></svg>
                </span>
                <span className="diary-summary-text">{todayEntry.tasksSummary.join(', ')}</span>
              </div>
            )}
            {todayEntry.eventsSummary.length > 0 && (
              <div className="diary-summary">
                <span className="diary-summary-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="17" rx="3" /><line x1="3" y1="9" x2="21" y2="9" /></svg>
                </span>
                <span className="diary-summary-text">{todayEntry.eventsSummary.join(', ')}</span>
              </div>
            )}
          </div>
        </GlassCard>
      ) : (
        <GlassCard>
          <div className="diary-empty-state">
            <div className="diary-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </div>
            <p className="diary-empty-text">아직 일기가 없어요</p>
            <button className="diary-write-btn" onClick={handleWrite}>일기 쓰기</button>
          </div>
        </GlassCard>
      )}

      {/* 최근 일기 */}
      {recentEntries.length > 0 && (
        <div className="diary-recent">
          <h3 className="diary-recent-title">최근 일기</h3>
          {recentEntries.map((entry) => {
            const entryDate = entry.date.toDate()
            return (
              <div
                key={entry.id}
                className="diary-recent-item"
                onClick={() => handleEditEntry(entry)}
              >
                <div className="diary-recent-date">
                  <span className="diary-recent-day">{format(entryDate, 'd')}</span>
                  <span className="diary-recent-month">{format(entryDate, 'M월', { locale: ko })}</span>
                </div>
                <div className="diary-recent-body">
                  <div className="diary-recent-top">
                    {entry.mood && <span className="diary-recent-mood">{MOOD_EMOJI[entry.mood]}</span>}
                    <span className="diary-recent-weekday">{format(entryDate, 'EEEE', { locale: ko })}</span>
                  </div>
                  <p className="diary-recent-preview">{entry.content.slice(0, 80)}{entry.content.length > 80 ? '...' : ''}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <DiaryForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditEntry(null) }}
        editEntry={editEntry}
        selectedDate={selectedDate}
      />
    </div>
  )
}
