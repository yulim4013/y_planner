// 웹 푸시 알림 서비스
// 표준 Web Push API 직접 사용 (iOS 호환)

import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

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
  if (!db || !VAPID_KEY) return null

  try {
    const swReg = await navigator.serviceWorker.getRegistration('/y_planner/')
      || await navigator.serviceWorker.getRegistration('/')
      || await navigator.serviceWorker.ready
    if (!swReg) return null

    // 기존 구독 확인 또는 새로 구독
    let subscription = await swReg.pushManager.getSubscription()

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_KEY)
      subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })
    }

    if (!subscription) return null

    // 구독 정보를 Firestore에 저장 (기기별 고유 ID)
    const endpoint = subscription.endpoint
    const p256dh = arrayBufferToBase64(subscription.getKey('p256dh')!)
    const authKey = arrayBufferToBase64(subscription.getKey('auth')!)

    // endpoint + userAgent 조합으로 기기별 고유 ID 생성 (PC/모바일 구분)
    const uniqueStr = endpoint + '|' + navigator.userAgent
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uniqueStr))
    const subId = arrayBufferToBase64(hashBuffer).slice(0, 20)

    console.log('[Push] endpoint:', endpoint.slice(0, 60) + '...')
    console.log('[Push] platform:', navigator.platform, '| UA:', navigator.userAgent.slice(0, 80))

    const subRef = doc(db, 'users', uid, 'pushSubscriptions', subId)
    await setDoc(subRef, {
      endpoint,
      keys: { p256dh, auth: authKey },
      platform: navigator.platform || 'unknown',
      userAgent: navigator.userAgent.slice(0, 200),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    // 이전 ID 방식(endpoint만 해시)으로 만든 고아 문서 정리
    const oldHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
    const oldSubId = arrayBufferToBase64(oldHashBuffer).slice(0, 20)
    if (oldSubId !== subId) {
      console.log('[Push] Cleaning up old subscription:', oldSubId)
      const oldRef = doc(db, 'users', uid, 'pushSubscriptions', oldSubId)
      deleteDoc(oldRef).catch(() => {})
    }

    console.log('[Push] Subscription saved:', subId)
    return subId
  } catch (err) {
    console.error('[Push] Registration failed:', err)
    return null
  }
}

export async function unregisterFCMTokens(uid: string) {
  if (!db) return
  try {
    const subsRef = collection(db, 'users', uid, 'pushSubscriptions')
    const snapshot = await getDocs(subsRef)
    await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)))
  } catch (err) {
    console.error('[Push] Cleanup failed:', err)
  }
}

export async function setupForegroundListener() {
  // Web Push는 서비스워커에서 처리
}
