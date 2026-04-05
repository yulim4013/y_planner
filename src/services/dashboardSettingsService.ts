import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuthStore } from '../store/authStore'

export interface DashboardSettings {
  homeCategoryIds: (string | null)[]
}

const DEFAULT_SETTINGS: DashboardSettings = {
  homeCategoryIds: [null, null, null],
}

function getSettingsRef() {
  const uid = useAuthStore.getState().user?.uid
  if (!uid || !db) return null
  return doc(db, 'users', uid, 'settings', 'dashboard')
}

export async function getDashboardSettings(): Promise<DashboardSettings> {
  const ref = getSettingsRef()
  if (!ref) return DEFAULT_SETTINGS
  const snap = await getDoc(ref)
  if (!snap.exists()) return DEFAULT_SETTINGS
  const data = snap.data()
  return {
    homeCategoryIds: data.homeCategoryIds ?? DEFAULT_SETTINGS.homeCategoryIds,
  }
}

export function subscribeDashboardSettings(callback: (s: DashboardSettings) => void) {
  const ref = getSettingsRef()
  if (!ref) {
    callback(DEFAULT_SETTINGS)
    return () => {}
  }
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback(DEFAULT_SETTINGS)
      return
    }
    const data = snap.data()
    callback({
      homeCategoryIds: data.homeCategoryIds ?? DEFAULT_SETTINGS.homeCategoryIds,
    })
  })
}

export async function saveDashboardSettings(settings: Partial<DashboardSettings>) {
  const ref = getSettingsRef()
  if (!ref) return
  await setDoc(ref, settings, { merge: true })
}
