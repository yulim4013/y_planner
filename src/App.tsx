import { useEffect, useRef } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, isFirebaseConfigured } from './config/firebase'
import { useAuthStore } from './store/authStore'
import { registerFCMToken, setupForegroundListener } from './services/fcmService'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './components/home/DashboardPage'
import TasksPage from './components/tasks/TasksPage'
import CalendarPage from './components/calendar/CalendarPage'
import MorePage from './components/more/MorePage'
import BudgetPage from './components/more/BudgetPage'
import DiaryPage from './components/diary/DiaryPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (!isFirebaseConfigured) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid var(--color-divider)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  const setUser = useAuthStore((s) => s.setUser)
  const fcmInitialized = useRef(false)

  // 푸시 구독 등록 함수
  const tryRegisterPush = async () => {
    const user = useAuthStore.getState().user
    if (!user || fcmInitialized.current) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    if (!('serviceWorker' in navigator)) return

    try {
      await navigator.serviceWorker.ready
      const result = await registerFCMToken(user.uid)
      if (result) {
        fcmInitialized.current = true
        console.log('[Push] Registration complete:', result)
      }
    } catch (err) {
      console.warn('[Push] Registration error:', err)
    }
  }

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      // 푸시 구독 등록 (로그인 & 알림 허용 상태일 때)
      if (user && !fcmInitialized.current) {
        await tryRegisterPush()
        setupForegroundListener()
      }
    })

    // 앱 복귀 시 푸시 등록 재시도 (PC 등에서 SW 준비 타이밍 이슈 대응)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        tryRegisterPush()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [setUser])

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="calendar/*" element={<CalendarPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="diary" element={<DiaryPage />} />
          <Route path="more" element={<MorePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
