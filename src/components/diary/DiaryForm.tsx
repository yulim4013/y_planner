import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import BottomSheet from '../common/BottomSheet'
import { addDiaryEntry, updateDiaryEntry, uploadDiaryPhoto, deleteDiaryPhoto } from '../../services/diaryService'
import type { DiaryEntry, DiaryPhoto, Mood } from '../../types'
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
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const [content, setContent] = useState('')
  const [photos, setPhotos] = useState<DiaryPhoto[]>([])
  const [links, setLinks] = useState<string[]>([])
  const [linkInput, setLinkInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTitle(editEntry?.title ?? '')
      setMood(editEntry?.mood ?? null)
      setContent(editEntry?.content ?? '')
      setPhotos(editEntry?.photos ?? [])
      setLinks(editEntry?.links ?? [])
      setLinkInput('')
      setUploadError('')
    }
  }, [isOpen, editEntry])

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadError('')
    try {
      const newPhotos: DiaryPhoto[] = []
      for (let i = 0; i < files.length; i++) {
        try {
          const photo = await uploadDiaryPhoto(files[i])
          if (photo) newPhotos.push(photo)
        } catch (err) {
          console.error(`Photo ${i + 1} upload failed:`, err)
          setUploadError(`사진 업로드 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
        }
      }
      if (newPhotos.length > 0) {
        setPhotos((prev) => [...prev, ...newPhotos])
      }
    } catch (err) {
      console.error('Photo upload error:', err)
      setUploadError('사진 업로드에 실패했습니다')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemovePhoto = async (index: number) => {
    const photo = photos[index]
    if (photo.storagePath) {
      await deleteDiaryPhoto(photo.storagePath)
    }
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddLink = () => {
    const url = linkInput.trim()
    if (!url) return
    // Auto-add https if missing
    const finalUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
    setLinks((prev) => [...prev, finalUrl])
    setLinkInput('')
  }

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!title.trim() && !content.trim() && !mood && photos.length === 0) return
    setSaving(true)
    try {
      if (editEntry) {
        await updateDiaryEntry(editEntry.id, {
          title: title.trim(),
          mood,
          content: content.trim(),
          photos,
          links,
        })
      } else {
        await addDiaryEntry({
          date: selectedDate,
          title: title.trim(),
          mood,
          content: content.trim(),
          photos,
          links,
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
    <BottomSheet isOpen={isOpen} onClose={uploading || saving ? () => {} : onClose} title={editEntry ? '일기 수정' : '일기 쓰기'} fullScreen>
      <div className="diary-form">
        {/* 날짜 표시 */}
        <div className="diary-form-date">{dateStr}</div>

        {/* 제목 */}
        <input
          className="diary-form-title-input"
          placeholder="제목 (선택)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

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
            rows={8}
          />
        </div>

        {/* 사진 추가 */}
        <div className="diary-form-section">
          <label className="diary-form-label">사진</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelect}
            style={{ display: 'none' }}
          />
          <div className="diary-photos-grid">
            {photos.map((photo, i) => (
              <div key={i} className="diary-photo-thumb">
                <img src={photo.url} alt="" />
                <button className="diary-photo-remove" onClick={() => handleRemovePhoto(i)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              className="diary-photo-add-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <div className="diary-upload-spinner" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              )}
              <span>{uploading ? '업로드 중...' : '사진 추가'}</span>
            </button>
          </div>
          {uploadError && <p className="diary-upload-error">{uploadError}</p>}
        </div>

        {/* 링크 추가 */}
        <div className="diary-form-section">
          <label className="diary-form-label">링크</label>
          <div className="diary-link-input-row">
            <input
              className="diary-link-input"
              type="url"
              placeholder="URL을 입력하세요"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink() } }}
            />
            <button className="diary-link-add-btn" onClick={handleAddLink} disabled={!linkInput.trim()}>추가</button>
          </div>
          {links.length > 0 && (
            <div className="diary-links-list">
              {links.map((link, i) => (
                <div key={i} className="diary-link-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="diary-link-url">{link.replace(/^https?:\/\//, '').slice(0, 40)}{link.replace(/^https?:\/\//, '').length > 40 ? '...' : ''}</a>
                  <button className="diary-link-remove" onClick={() => handleRemoveLink(i)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 저장 버튼 */}
        <div className="diary-form-actions">
          <button
            className="diary-form-save"
            onClick={handleSave}
            disabled={saving || uploading || (!title.trim() && !content.trim() && !mood && photos.length === 0)}
          >
            {saving ? '저장 중...' : editEntry ? '수정하기' : '저장하기'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
