import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, isFirebaseConfigured } from './config/firebase'
import { useAuthStore } from './store/authStore'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './components/home/DashboardPage'
import TasksPage from './components/tasks/TasksPage'
import CalendarPage from './components/calendar/CalendarPage'
import MorePage from './components/more/MorePage'
import BudgetPage from './components/more/BudgetPage'

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

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
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
          <Route path="diary" element={<div className="page" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Diary - 준비 중</div>} />
          <Route path="more" element={<MorePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
