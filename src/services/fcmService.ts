// Firebase Cloud Messaging (FCM) 서비스
// 잠금화면 푸시 알림을 위한 토큰 관리 및 메시지 처리

import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { getMessagingInstance, db } from '../config/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

// FCM 토큰 발급 및 Firestore 저장
export async function registerFCMToken(uid: string): Promise<string | null> {
  // Step 1: 기본 설정 확인
  if (!db) {
    toast.error('❌ Step1: DB 없음')
    return null
  }
  if (!VAPID_KEY) {
    toast.error('❌ Step1: VAPID 키 없음')
    return null
  }

  try {
    // Step 2: Messaging 지원 확인
    toast('🔍 Step2: Messaging 확인 중..', { duration: 2000 })
    const messaging = await getMessagingInstance()
    if (!messaging) {
      toast.error('❌ Step2: Messaging 미지원', { duration: 8000 })
      return null
    }
    toast.success('✅ Step2: Messaging OK', { duration: 2000 })

    // Step 3: 서비스워커 확인
    const swReg = await navigator.serviceWorker.getRegistration('/y_planner/')
      || await navigator.serviceWorker.getRegistration('/')
      || await navigator.serviceWorker.ready
    if (!swReg) {
      toast.error('❌ Step3: SW 없음', { duration: 8000 })
      return null
    }
    toast.success(`✅ Step3: SW scope=${swReg.scope.slice(-20)}`, { duration: 2000 })

    // Step 4: 토큰 발급
    toast('🔍 Step4: 토큰 요청 중..', { duration: 2000 })
    const { getToken } = await import('firebase/messaging')
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    if (!token) {
      toast.error('❌ Step4: 토큰 비어있음', { duration: 8000 })
      return null
    }
    toast.success(`✅ Step4: 토큰 발급! ${token.slice(0, 15)}..`, { duration: 3000 })

    // Step 5: Firestore 저장
    const tokenRef = doc(db, 'users', uid, 'fcmTokens', token)
    await setDoc(tokenRef, {
      token,
      platform: navigator.platform || 'unknown',
      userAgent: navigator.userAgent.slice(0, 200),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    toast.success('✅ Step5: Firestore 저장 완료!', { duration: 3000 })

    return token
  } catch (err: any) {
    toast.error(`❌ FCM 에러: ${err?.message?.slice(0, 80) || err}`, { duration: 10000 })
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
  } catch (err) {
    console.error('[FCM] Token cleanup failed:', err)
  }
}

// 포그라운드 메시지 리스너 설정 (앱이 열려있을 때 푸시 수신)
export async function setupForegroundListener() {
  try {
    const messaging = await getMessagingInstance()
    if (!messaging) return

    const { onMessage } = await import('firebase/messaging')
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {}
      if (!title) return

      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body: body || '',
            icon: '/y_planner/icons/icon-192x192.jpg',
            badge: '/y_planner/icons/icon-192x192.jpg',
          })
        } catch {
          navigator.serviceWorker.controller?.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body: body || '',
          })
        }
      }
    })
  } catch (err) {
    console.warn('[FCM] Foreground listener setup failed:', err)
  }
}
