import { signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../config/firebase'

export async function signInWithGoogle() {
  if (!auth || !googleProvider) {
    console.warn('Firebase not configured')
    return null
  }
  return signInWithPopup(auth, googleProvider)
}

export async function logOut() {
  if (!auth) return
  return signOut(auth)
}
