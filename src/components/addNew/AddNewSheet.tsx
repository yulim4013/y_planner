import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import BottomSheet from '../common/BottomSheet'
import TaskForm from '../tasks/TaskForm'
import EventForm from '../calendar/EventForm'
import './AddNewSheet.css'

const addOptions: { icon: (ReactElement); label: string; action: string }[] = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 12l3 3 5-6" />
      </svg>
    ),
    label: '할 일 추가',
    action: 'task',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="2" x2="8" y2="5" />
        <line x1="16" y1="2" x2="16" y2="5" />
      </svg>
    ),
    label: '일정 추가',
    action: 'event',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    ),
    label: '일기 쓰기',
    action: 'diary',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="15" rx="3" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <circle cx="17" cy="15" r="2" />
      </svg>
    ),
    label: '지출 기록',
    action: 'expense',
  },
]

export default function AddNewSheet() {
  const isOpen = useUIStore((s) => s.addSheetOpen)
  const close = useUIStore((s) => s.closeAddSheet)
  const navigate = useNavigate()
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [eventFormOpen, setEventFormOpen] = useState(false)

  const handleSelect = (action: string) => {
    close()
    if (action === 'task') {
      setTaskFormOpen(true)
    } else if (action === 'event') {
      setEventFormOpen(true)
    } else if (action === 'diary') {
      navigate('/calendar')
    } else if (action === 'expense') {
      navigate('/budget')
    }
  }

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={close} title="새로 만들기">
        <div className="add-options-list">
          {addOptions.map((opt) => (
            <button
              key={opt.action}
              className="add-option-row"
              onClick={() => handleSelect(opt.action)}
            >
              <span className="add-option-icon-wrap">{opt.icon}</span>
              <span className="add-option-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      <TaskForm
        isOpen={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
      />

      <EventForm
        isOpen={eventFormOpen}
        onClose={() => setEventFormOpen(false)}
      />
    </>
  )
}
