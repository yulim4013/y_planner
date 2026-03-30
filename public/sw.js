// Service Worker - 자동 업데이트 지원
// CACHE_VERSION은 빌드마다 변경되어야 하므로 빌드 시간 기반
const CACHE_NAME = 'life-planner-v2'

// 설치 시 즉시 활성화 (대기하지 않음)
self.addEventListener('install', () => {
  self.skipWaiting()
})

// 활성화 시 이전 캐시 삭제 + 즉시 클라이언트 제어
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// Network-first 전략: 항상 최신 버전 우선
self.addEventListener('fetch', (event) => {
  const { request } = event

  // POST 등은 캐시하지 않음
  if (request.method !== 'GET') return

  // 외부 도메인 요청은 캐시하지 않음
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  // Firebase/API 요청은 캐시하지 않음
  if (request.url.includes('firestore') || request.url.includes('googleapis') || request.url.includes('cloudfunctions')) return

  // HTML (네비게이션) → 항상 네트워크 우선
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // JS/CSS/이미지 등 정적 자원: 네트워크 우선, 오프라인 시 캐시 폴백
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
