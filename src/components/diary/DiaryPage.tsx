import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday as isDateToday,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../layout/Header'
import GlassCard from '../common/GlassCard'
import DiaryForm from './DiaryForm'
import { subscribeDiaryEntries, deleteDiaryEntry, addDiaryEntry, uploadDiaryPhoto, deleteDiaryPhoto } from '../../services/diaryService'
import type { DiaryEntry, DiaryPhoto, Mood } from '../../types'
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

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'great', emoji: '\u{1F606}', label: '최고' },
  { value: 'good', emoji: '\u{1F60A}', label: '좋음' },
  { value: 'okay', emoji: '\u{1F610}', label: '보통' },
  { value: 'bad', emoji: '\u{1F615}', label: '별로' },
  { value: 'terrible', emoji: '\u{1F622}', label: '나쁨' },
]

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
  const [viewMode, setViewMode] = useState<'calendar' | 'feed'>('calendar')

  // 인라인 작성 상태
  const [inlineTitle, setInlineTitle] = useState('')
  const [inlineMood, setInlineMood] = useState<Mood | null>(null)
  const [inlineContent, setInlineContent] = useState('')
  const [inlinePhotos, setInlinePhotos] = useState<DiaryPhoto[]>([])
  const [inlineLinks, setInlineLinks] = useState<string[]>([])
  const [inlineLinkInput, setInlineLinkInput] = useState('')
  const [inlineUploading, setInlineUploading] = useState(false)
  const [inlineUploadError, setInlineUploadError] = useState('')
  const [inlineSaving, setInlineSaving] = useState(false)
  const inlineFileRef = useRef<HTMLInputElement>(null)

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

  // 피드용: 최신순 정렬
  const feedEntries = useMemo(() =>
    [...entries].sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime()),
    [entries]
  )

  const handlePrevMonth = useCallback(() => setCurrentMonth((d) => subMonths(d, 1)), [])
  const handleNextMonth = useCallback(() => setCurrentMonth((d) => addMonths(d, 1)), [])
  const handleGoToday = useCallback(() => {
    setCurrentMonth(new Date())
    setSelectedDate(null)
  }, [])

  // 인라인 폼 리셋
  const resetInlineForm = () => {
    setInlineTitle('')
    setInlineMood(null)
    setInlineContent('')
    setInlinePhotos([])
    setInlineLinks([])
    setInlineLinkInput('')
    setInlineUploadError('')
  }

  const handleDayClick = (day: Date) => {
    // 같은 날짜 다시 클릭 시 선택 해제
    if (selectedDate && isSameDay(day, selectedDate)) {
      setSelectedDate(null)
      resetInlineForm()
      return
    }
    setSelectedDate(day)
    resetInlineForm()
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

  // 인라인 사진 업로드
  const handleInlinePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setInlineUploading(true)
    setInlineUploadError('')
    try {
      const newPhotos: DiaryPhoto[] = []
      for (let i = 0; i < files.length; i++) {
        try {
          const photo = await uploadDiaryPhoto(files[i])
          if (photo) newPhotos.push(photo)
        } catch (err) {
          console.error(`Photo ${i + 1} upload failed:`, err)
          setInlineUploadError(`사진 업로드 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
        }
      }
      if (newPhotos.length > 0) setInlinePhotos((prev) => [...prev, ...newPhotos])
    } finally {
      setInlineUploading(false)
      if (inlineFileRef.current) inlineFileRef.current.value = ''
    }
  }

  const handleInlineRemovePhoto = async (index: number) => {
    const photo = inlinePhotos[index]
    if (photo.storagePath) await deleteDiaryPhoto(photo.storagePath)
    setInlinePhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleInlineAddLink = () => {
    const url = inlineLinkInput.trim()
    if (!url) return
    const finalUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
    setInlineLinks((prev) => [...prev, finalUrl])
    setInlineLinkInput('')
  }

  // 인라인 저장
  const handleInlineSave = async () => {
    if (!selectedDate) return
    if (!inlineTitle.trim() && !inlineContent.trim() && !inlineMood && inlinePhotos.length === 0) return
    setInlineSaving(true)
    try {
      await addDiaryEntry({
        date: selectedDate,
        title: inlineTitle.trim(),
        mood: inlineMood,
        content: inlineContent.trim(),
        photos: inlinePhotos,
        links: inlineLinks,
      })
      resetInlineForm()
      // 저장 후 해당 날짜의 일기를 보여줌 (selectedDate 유지)
    } catch (err) {
      console.error('Diary save error:', err)
    } finally {
      setInlineSaving(false)
    }
  }

  return (
    <div className="page">
      <Header title="DIARY" right={
        <div className="diary-header-right">
          <button
            className={`diary-view-toggle ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
          <button
            className={`diary-view-toggle ${viewMode === 'feed' ? 'active' : ''}`}
            onClick={() => setViewMode('feed')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button className="header-add-btn" onClick={handleWrite}>+</button>
        </div>
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

      {viewMode === 'calendar' ? (
      <>
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
                  <span className="diary-cal-mood">{entry.mood ? MOOD_EMOJI[entry.mood] : '\u{1F4DD}'}</span>
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

      {/* 선택된 날짜에 일기 없음 → 인라인 작성 폼 */}
      {selectedDate && !selectedEntry && (
        <GlassCard>
          <div className="diary-inline-form">
            <div className="diary-inline-header">
              <span className="diary-entry-date-label">
                {format(selectedDate, 'M월 d일 EEEE', { locale: ko })}
              </span>
            </div>

            {/* 기분 선택 */}
            <div className="diary-inline-mood-row">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  className={`diary-inline-mood-btn ${inlineMood === m.value ? 'active' : ''}`}
                  onClick={() => setInlineMood(inlineMood === m.value ? null : m.value)}
                >
                  <span>{m.emoji}</span>
                  <span className="diary-inline-mood-label">{m.label}</span>
                </button>
              ))}
            </div>

            {/* 제목 */}
            <input
              className="diary-inline-title"
              placeholder="제목 (선택)"
              value={inlineTitle}
              onChange={(e) => setInlineTitle(e.target.value)}
            />

            {/* 내용 */}
            <textarea
              className="diary-inline-textarea"
              placeholder="오늘 하루는 어땠나요?"
              value={inlineContent}
              onChange={(e) => setInlineContent(e.target.value)}
              rows={5}
            />

            {/* 사진 */}
            <input
              ref={inlineFileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleInlinePhotoSelect}
              style={{ display: 'none' }}
            />
            <div className="diary-inline-photos">
              {inlinePhotos.map((photo, i) => (
                <div key={i} className="diary-inline-photo-thumb">
                  <img src={photo.url} alt="" />
                  <button className="diary-inline-photo-remove" onClick={() => handleInlineRemovePhoto(i)}>×</button>
                </div>
              ))}
            </div>
            {inlineUploadError && <p className="diary-inline-error">{inlineUploadError}</p>}

            {/* 링크 */}
            {inlineLinks.length > 0 && (
              <div className="diary-inline-links">
                {inlineLinks.map((link, i) => (
                  <div key={i} className="diary-inline-link-item">
                    <span>{link.replace(/^https?:\/\//, '').slice(0, 35)}</span>
                    <button onClick={() => setInlineLinks((prev) => prev.filter((_, idx) => idx !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* 하단 도구 + 저장 */}
            <div className="diary-inline-actions">
              <div className="diary-inline-tools">
                <button
                  className="diary-inline-tool-btn"
                  onClick={() => inlineFileRef.current?.click()}
                  disabled={inlineUploading}
                >
                  {inlineUploading ? (
                    <div className="diary-upload-spinner-sm" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  )}
                </button>
                <div className="diary-inline-link-input-row">
                  <input
                    className="diary-inline-link-input"
                    placeholder="URL 추가"
                    value={inlineLinkInput}
                    onChange={(e) => setInlineLinkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInlineAddLink() } }}
                  />
                  {inlineLinkInput.trim() && (
                    <button className="diary-inline-link-add" onClick={handleInlineAddLink}>+</button>
                  )}
                </div>
              </div>
              <button
                className="diary-inline-save-btn"
                onClick={handleInlineSave}
                disabled={inlineSaving || inlineUploading || (!inlineTitle.trim() && !inlineContent.trim() && !inlineMood && inlinePhotos.length === 0)}
              >
                {inlineSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      </>
      ) : (
      /* 피드 뷰 */
      <div className="diary-feed-grid">
        {feedEntries.length === 0 ? (
          <p className="diary-feed-empty">작성된 일기가 없습니다</p>
        ) : (
          feedEntries.map((entry) => {
            const d = entry.date.toDate()
            const dateLabel = `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS[d.getDay()]}`
            const hasPhoto = entry.photos && entry.photos.length > 0
            return (
              <div
                key={entry.id}
                className="diary-feed-card"
                onClick={() => {
                  setViewMode('calendar')
                  setCurrentMonth(d)
                  setSelectedDate(d)
                }}
              >
                <div className="diary-feed-thumb">
                  {hasPhoto ? (
                    <img src={entry.photos[0].url} alt="" />
                  ) : entry.mood ? (
                    <span className="diary-feed-mood">{MOOD_EMOJI[entry.mood]}</span>
                  ) : (
                    <span className="diary-feed-text">{entry.content?.slice(0, 30) || entry.title || '-'}</span>
                  )}
                </div>
                <div className="diary-feed-date">{dateLabel}</div>
              </div>
            )
          })
        )}
      </div>
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
