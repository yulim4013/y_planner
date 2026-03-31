// Service Worker - 자동 업데이트 지원
const CACHE_NAME = 'life-planner-v4'

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
      icon: '/y_planner/icons/icon-192x192.jpg',
      badge: '/y_planner/icons/icon-192x192.jpg',
      tag: event.data.tag || 'default',
      requireInteraction: false,
    })
  }
})

// 웹 푸시 수신 (항상 알림 표시, tag로 중복 방지)
self.addEventListener('push', (event) => {
  if (!event.data) return

  const showNotification = Promise.resolve().then(() => {
    let payload
    try {
      payload = event.data.json()
    } catch {
      return self.registration.showNotification('하루 플래너', { body: event.data.text() })
    }

    const notification = payload.notification || {}
    const data = payload.data || {}
    const title = notification.title || data.title || '하루 플래너'
    const body = notification.body || data.body || ''

    // tag가 같으면 브라우저가 자동으로 이전 알림을 교체 (중복 방지)
    return self.registration.showNotification(title, {
      body,
      icon: '/y_planner/icons/icon-192x192.jpg',
      badge: '/y_planner/icons/icon-192x192.jpg',
      data: data,
      tag: data.tag || 'default',
    })
  })

  event.waitUntil(showNotification)
})

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlPath = event.notification.data?.url || '/y_planner/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of clients) {
        if (client.url.includes('/y_planner/') && 'focus' in client) {
          return client.focus()
        }
      }
      // 없으면 새 탭 열기
      return self.clients.openWindow(urlPath)
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
