import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { logOut } from '../../services/authService'
import {
  getCalendarSettings,
  saveCalendarSettings,
  getCalendarAccessToken,
  syncAllToGcal,
} from '../../services/googleCalendarService'
import { subscribeEvents } from '../../services/eventService'
import { subscribeTasks } from '../../services/taskService'
import Header from '../layout/Header'
import GlassCard from '../common/GlassCard'
import CategoryManager from './CategoryManager'
import toast from 'react-hot-toast'
import './MorePage.css'

export default function MorePage() {
  const user = useAuthStore((s) => s.user)
  const [catOpen, setCatOpen] = useState(false)
  const [gcalEnabled, setGcalEnabled] = useState(false)
  const [gcalLoading, setGcalLoading] = useState(false)

  useEffect(() => {
    getCalendarSettings().then((s) => setGcalEnabled(s.enabled))
  }, [])

  async function handleGcalToggle() {
    if (gcalLoading) return
    setGcalLoading(true)

    try {
      if (!gcalEnabled) {
        const token = await getCalendarAccessToken()
        if (!token) {
          toast.error('Google Calendar 권한이 필요합니다')
          setGcalLoading(false)
          return
        }
        await saveCalendarSettings({ enabled: true, calendarId: 'primary' })
        setGcalEnabled(true)

        toast.promise(
          new Promise<number>((resolve) => {
            let events: import('../../types').CalendarEvent[] = []
            let tasks: import('../../types').Task[] = []
            let loaded = 0
            const check = async () => {
              if (++loaded < 2) return
              unsubE()
              unsubT()
              const count = await syncAllToGcal(events, tasks) || 0
              resolve(count)
            }
            const unsubE = subscribeEvents((e) => { events = e; check() })
            const unsubT = subscribeTasks((t) => { tasks = t; check() })
          }),
          {
            loading: '기존 일정/태스크 동기화 중...',
            success: (count) => `${count}개 항목 동기화 완료`,
            error: '동기화 중 오류 발생',
          }
        )
      } else {
        await saveCalendarSettings({ enabled: false, calendarId: '' })
        setGcalEnabled(false)
        toast.success('Google Calendar 연동 해제됨')
      }
    } catch (error) {
      console.error('GCal 설정 오류:', error)
      toast.error('설정 변경 실패')
    } finally {
      setGcalLoading(false)
    }
  }

  return (
    <div className="page">
      <Header title="MORE" />

      {user && (
        <GlassCard className="profile-card animate-fade-in">
          <div className="profile-info">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="profile-avatar" />
            ) : (
              <div className="profile-avatar-placeholder">
                {user.displayName?.[0] || '?'}
              </div>
            )}
            <div>
              <p className="profile-name">{user.displayName}</p>
              <p className="profile-email">{user.email}</p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="more-menu">
        <GlassCard className="more-menu-item" onClick={() => setCatOpen(true)}>
          <span className="more-menu-icon">🏷️</span>
          <span className="more-menu-label">카테고리 관리</span>
          <span className="more-menu-arrow">›</span>
        </GlassCard>
        <GlassCard className="more-menu-item" onClick={handleGcalToggle}>
          <span className="more-menu-icon">📅</span>
          <span className="more-menu-label">
            Google Calendar 연동
          </span>
          <span className={`more-menu-badge ${gcalEnabled ? 'active' : ''}`}>
            {gcalLoading ? '...' : gcalEnabled ? 'ON' : 'OFF'}
          </span>
        </GlassCard>
      </div>

      <button className="logout-btn" onClick={logOut}>
        로그아웃
      </button>

      <CategoryManager isOpen={catOpen} onClose={() => setCatOpen(false)} />
    </div>
  )
}
