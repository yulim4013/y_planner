// 웹 푸시 알림 서비스
// Firebase Messaging SDK 대신 표준 Web Push API 직접 사용 (iOS 호환성)

import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '../config/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

/**
 * base64url 문자열을 Uint8Array로 변환
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * ArrayBuffer를 base64url 문자열로 변환
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Web Push 구독 등록 및 Firestore 저장
 */
export async function registerFCMToken(uid: string): Promise<string | null> {
  if (!db) {
    toast.error('❌ DB 연결 없음')
    return null
  }
  if (!VAPID_KEY) {
    toast.error('❌ VAPID 키 없음')
    return null
  }

  try {
    // Step 1: 서비스워커 확인
    const swReg = await navigator.serviceWorker.getRegistration('/y_planner/')
      || await navigator.serviceWorker.getRegistration('/')
      || await navigator.serviceWorker.ready
    if (!swReg) {
      toast.error('❌ 서비스워커 없음')
      return null
    }
    toast(`✅ SW OK`, { duration: 2000 })

    // Step 2: 기존 구독 확인 또는 새로 구독
    let subscription = await swReg.pushManager.getSubscription()

    if (!subscription) {
      toast('🔍 푸시 구독 중..', { duration: 2000 })
      const applicationServerKey = urlBase64ToUint8Array(VAPID_KEY)

      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })
    }

    if (!subscription) {
      toast.error('❌ 푸시 구독 실패')
      return null
    }

    toast.success('✅ 푸시 구독 완료!', { duration: 2000 })

    // Step 3: 구독 정보를 Firestore에 저장
    const endpoint = subscription.endpoint
    const p256dh = arrayBufferToBase64(subscription.getKey('p256dh')!)
    const auth = arrayBufferToBase64(subscription.getKey('auth')!)

    // 고유 ID로 endpoint의 hash 사용
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
    const subId = arrayBufferToBase64(hashBuffer).slice(0, 20)

    const subRef = doc(db, 'users', uid, 'pushSubscriptions', subId)
    await setDoc(subRef, {
      endpoint,
      keys: { p256dh, auth },
      platform: navigator.platform || 'unknown',
      userAgent: navigator.userAgent.slice(0, 200),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    toast.success('✅ 저장 완료! 잠금화면 푸시 활성화', { duration: 3000 })
    return subId
  } catch (err: any) {
    toast.error(`❌ 에러: ${err?.message?.slice(0, 100) || err}`, { duration: 10000 })
    return null
  }
}

// 구독 삭제 (로그아웃 시)
export async function unregisterFCMTokens(uid: string) {
  if (!db) return
  try {
    const subsRef = collection(db, 'users', uid, 'pushSubscriptions')
    const snapshot = await getDocs(subsRef)
    const deletes = snapshot.docs.map((d) => deleteDoc(d.ref))
    await Promise.all(deletes)
  } catch (err) {
    console.error('[Push] Cleanup failed:', err)
  }
}

// 포그라운드에서는 클라이언트 알림 사용하므로 별도 리스너 불필요
export async function setupForegroundListener() {
  // Web Push는 서비스워커에서 처리되므로 별도 설정 불필요
}
