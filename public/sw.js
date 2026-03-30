// Service Worker - 자동 업데이트 지원
const CACHE_NAME = 'life-planner-v3'

// 설치 시 즉시 활성화 (대기하지 않음)
self.addEventListener('install', () => {
  self.skipWaiting()
})

// 활성화 시 이전 캐시 전부 삭제 + 즉시 클라이언트 제어
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  )
})

// 푸시 알림 메시지 수신 (클라이언트에서 postMessage로 전달)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      requireInteraction: false,
    })
  }
})

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus()
      } else {
        self.clients.openWindow('/')
      }
    })
  )
})

// Network-only 전략: 캐시를 아예 안 쓰고, 오프라인 시에만 폴백
self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  // 항상 네트워크에서 가져옴 (오프라인일 때만 캐시 폴백)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 성공하면 캐시에 저장 (오프라인 대비)
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})
