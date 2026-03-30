import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import BottomSheet from '../common/BottomSheet'
import { addDiaryEntry, updateDiaryEntry } from '../../services/diaryService'
import type { DiaryEntry, Mood } from '../../types'
import './DiaryForm.css'

interface DiaryFormProps {
  isOpen: boolean
  onClose: () => void
  editEntry: DiaryEntry | null
  selectedDate: Date
}

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'great', emoji: '\u{1F606}', label: '최고' },
  { value: 'good', emoji: '\u{1F60A}', label: '좋음' },
  { value: 'okay', emoji: '\u{1F610}', label: '보통' },
  { value: 'bad', emoji: '\u{1F615}', label: '별로' },
  { value: 'terrible', emoji: '\u{1F622}', label: '나쁨' },
]

export default function DiaryForm({ isOpen, onClose, editEntry, selectedDate }: DiaryFormProps) {
  const [mood, setMood] = useState<Mood | null>(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMood(editEntry?.mood ?? null)
      setContent(editEntry?.content ?? '')
    }
  }, [isOpen, editEntry])

  const handleSave = async () => {
    if (!content.trim() && !mood) return
    setSaving(true)
    try {
      if (editEntry) {
        await updateDiaryEntry(editEntry.id, { mood, content: content.trim() })
      } else {
        await addDiaryEntry({
          date: selectedDate,
          mood,
          content: content.trim(),
        })
      }
      onClose()
    } catch (err) {
      console.error('Diary save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const dateStr = format(selectedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={editEntry ? '일기 수정' : '일기 쓰기'} fullScreen>
      <div className="diary-form">
        {/* 날짜 표시 */}
        <div className="diary-form-date">{dateStr}</div>

        {/* 기분 선택 */}
        <div className="diary-form-section">
          <label className="diary-form-label">오늘의 기분</label>
          <div className="diary-mood-picker">
            {MOODS.map((m) => (
              <button
                key={m.value}
                className={`diary-mood-btn ${mood === m.value ? 'active' : ''}`}
                onClick={() => setMood(mood === m.value ? null : m.value)}
              >
                <span className="diary-mood-btn-emoji">{m.emoji}</span>
                <span className="diary-mood-btn-label">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 내용 입력 */}
        <div className="diary-form-section diary-form-content-section">
          <label className="diary-form-label">오늘 하루</label>
          <textarea
            className="diary-form-textarea"
            placeholder="오늘 하루는 어땠나요?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
          />
        </div>

        {/* 저장 버튼 */}
        <div className="diary-form-actions">
          <button
            className="diary-form-save"
            onClick={handleSave}
            disabled={saving || (!content.trim() && !mood)}
          >
            {saving ? '저장 중...' : editEntry ? '수정하기' : '저장하기'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
