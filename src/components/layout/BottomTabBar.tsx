import type { ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './BottomTabBar.css'

const tabs = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/tasks', icon: 'tasks', label: 'Tasks' },
  { path: '/calendar', icon: 'calendar', label: 'Cal' },
  { path: '/budget', icon: 'budget', label: 'Budget' },
  { path: '/diary', icon: 'diary', label: 'Diary' },
  { path: '/more', icon: 'more', label: 'More' },
]

const tabIcons: Record<string, (active: boolean) => ReactElement> = {
  home: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-text)' : 'var(--color-text-tertiary)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
      <path d="M9 21V14h6v7" />
    </svg>
  ),
  tasks: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-text)' : 'var(--color-text-tertiary)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  ),
  calendar: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-text)' : 'var(--color-text-tertiary)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <line x1="16" y1="2" x2="16" y2="5" />
    </svg>
  ),
  budget: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-text)' : 'var(--color-text-tertiary)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="15" rx="3" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <circle cx="17" cy="15" r="2" />
    </svg>
  ),
  diary: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-text)' : 'var(--color-text-tertiary)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  more: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--color-text)' : 'var(--color-text-tertiary)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" fill={active ? 'var(--color-text)' : 'var(--color-text-tertiary)'} />
      <circle cx="12" cy="5" r="1" fill={active ? 'var(--color-text)' : 'var(--color-text-tertiary)'} />
      <circle cx="12" cy="19" r="1" fill={active ? 'var(--color-text)' : 'var(--color-text-tertiary)'} />
    </svg>
  ),
}

export default function BottomTabBar() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="bottom-tab-bar">
      {tabs.map((tab) => {
        const active = isActive(tab.path)
        return (
          <button
            key={tab.path}
            className={`tab-item ${active ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
          >
            <span className="tab-icon">
              {tabIcons[tab.icon](active)}
            </span>
            <span className="tab-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
