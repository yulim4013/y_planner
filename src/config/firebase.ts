import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import type { Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null
let googleProvider: GoogleAuthProvider | null = null
let _messaging: Messaging | null = null
let _messagingChecked = false

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  googleProvider = new GoogleAuthProvider()
  db = getFirestore(app)
  storage = getStorage(app)

  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence: multiple tabs open')
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence: browser not supported')
    }
  })
}

// Firebase Messaging - 비동기 lazy 초기화 (지원 여부 확인 후)
export async function getMessagingInstance(): Promise<Messaging | null> {
  if (_messagingChecked) return _messaging
  _messagingChecked = true

  if (!app) return null

  try {
    const { isSupported, getMessaging } = await import('firebase/messaging')
    const supported = await isSupported()
    if (!supported) {
      console.warn('[FCM] This browser does not support Firebase Messaging')
      return null
    }
    _messaging = getMessaging(app)
    console.log('[FCM] Messaging initialized successfully')
    return _messaging
  } catch (err) {
    console.warn('[FCM] Messaging init failed:', err)
    return null
  }
}

export { app, auth, googleProvider, db, storage }
