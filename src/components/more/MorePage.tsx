import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { logOut } from '../../services/authService'
import Header from '../layout/Header'
import GlassCard from '../common/GlassCard'
import CategoryManager from './CategoryManager'
import './MorePage.css'

export default function MorePage() {
  const user = useAuthStore((s) => s.user)
  const [catOpen, setCatOpen] = useState(false)

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
        <GlassCard className="more-menu-item">
          <span className="more-menu-icon">💰</span>
          <span className="more-menu-label">가계부</span>
          <span className="more-menu-arrow">›</span>
        </GlassCard>
        <GlassCard className="more-menu-item" onClick={() => setCatOpen(true)}>
          <span className="more-menu-icon">🏷️</span>
          <span className="more-menu-label">카테고리 관리</span>
          <span className="more-menu-arrow">›</span>
        </GlassCard>
        <GlassCard className="more-menu-item">
          <span className="more-menu-icon">📤</span>
          <span className="more-menu-label">데이터 내보내기</span>
          <span className="more-menu-arrow">›</span>
        </GlassCard>
        <GlassCard className="more-menu-item">
          <span className="more-menu-icon">🎨</span>
          <span className="more-menu-label">테마 설정</span>
          <span className="more-menu-arrow">›</span>
        </GlassCard>
      </div>

      <button className="logout-btn" onClick={logOut}>
        로그아웃
      </button>

      <CategoryManager isOpen={catOpen} onClose={() => setCatOpen(false)} />
    </div>
  )
}
