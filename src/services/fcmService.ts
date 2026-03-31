// Firebase Cloud Messaging (FCM) 서비스
// 잠금화면 푸시 알림을 위한 토큰 관리 및 메시지 처리

import { getToken, onMessage, type MessagePayload } from 'firebase/messaging'
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { messaging, db } from '../config/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

// FCM 토큰 발급 및 Firestore 저장
export async function registerFCMToken(uid: string): Promise<string | null> {
  if (!messaging || !db || !VAPID_KEY) {
    console.warn('[FCM] messaging/db/VAPID_KEY not available', {
      messaging: !!messaging,
      db: !!db,
      vapidKey: !!VAPID_KEY,
    })
    return null
  }

  try {
    // 기존 서비스 워커 등록 사용
    const swReg = await navigator.serviceWorker.getRegistration('/y_planner/')
    if (!swReg) {
      console.warn('[FCM] No service worker registration found')
      return null
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    if (!token) {
      console.warn('[FCM] No token received')
      return null
    }

    console.log('[FCM] Token received:', token.slice(0, 20) + '...')

    // Firestore에 토큰 저장
    const tokenRef = doc(db, 'users', uid, 'fcmTokens', token)
    await setDoc(tokenRef, {
      token,
      platform: navigator.platform || 'unknown',
      userAgent: navigator.userAgent.slice(0, 200),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    return token
  } catch (err) {
    console.error('[FCM] Token registration failed:', err)
    return null
  }
}

// FCM 토큰 삭제 (로그아웃 시)
export async function unregisterFCMTokens(uid: string) {
  if (!db) return
  try {
    const tokensRef = collection(db, 'users', uid, 'fcmTokens')
    const snapshot = await getDocs(tokensRef)
    const deletes = snapshot.docs.map((d) => deleteDoc(d.ref))
    await Promise.all(deletes)
    console.log('[FCM] All tokens removed')
  } catch (err) {
    console.error('[FCM] Token cleanup failed:', err)
  }
}

// 포그라운드 메시지 리스너 설정 (앱이 열려있을 때 푸시 수신)
export function setupForegroundListener() {
  if (!messaging) return

  onMessage(messaging, (payload: MessagePayload) => {
    console.log('[FCM] Foreground message:', payload)

    const { title, body } = payload.notification || {}
    if (!title) return

    // 앱이 열려있을 때는 브라우저 Notification으로 표시
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body || '',
          icon: '/y_planner/icons/icon-192x192.jpg',
          badge: '/y_planner/icons/icon-192x192.jpg',
        })
      } catch {
        // Safari 등에서 Notification 생성자 미지원 시 SW 경유
        navigator.serviceWorker.controller?.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body: body || '',
        })
      }
    }
  })
}
