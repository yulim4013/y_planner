import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: {
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          fontSize: '14px',
          fontFamily: 'var(--font-family)',
        },
      }}
    />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/y_planner/sw.js')
      // 새 버전 감지 시 자동 업데이트
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // 새 버전이 활성화되면 자동 새로고침
            window.location.reload()
          }
        })
      })
      // 페이지 열 때마다 업데이트 확인
      setInterval(() => reg.update(), 60 * 1000) // 1분마다
    } catch {
      // Service worker registration failed - OK in dev
    }
  })
}
