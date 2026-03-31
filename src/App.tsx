import { useEffect, useRef } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import toast from 'react-hot-toast'
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

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      // FCM 토큰 등록 (로그인 & 알림 허용 상태일 때)
      if (user && !fcmInitialized.current) {
        fcmInitialized.current = true
        try {
          const perm = Notification.permission
          toast(`🔔 알림 권한: ${perm}`, { duration: 3000 })

          if (perm === 'granted') {
            const token = await registerFCMToken(user.uid)
            if (token) {
              toast.success(`✅ 푸시 등록 완료`, { duration: 3000 })
            } else {
              toast.error(`❌ 푸시 토큰 실패`, { duration: 5000 })
            }
          } else {
            toast(`알림 허용 필요 (현재: ${perm})`, { duration: 5000 })
          }
          setupForegroundListener()
        } catch (err: any) {
          toast.error(`❌ FCM 에러: ${err?.message || err}`, { duration: 8000 })
        }
      }
    })
    return unsubscribe
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
