import {
  doc, setDoc, getDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { User } from '../types'

export interface FirestoreUserProfile {
  id: string
  name: string
  bio?: string
  avatarUrl?: string
  isVerifiedCaptain: boolean
  role: string
  contributorPoints: number
  routesCreated: number
  updatedAt?: any
}

/**
 * Writes the current user's public profile to Firestore so other users can view it.
 * Safe to call on login and after profile edits.
 */
export async function saveUserProfile(
  user: User,
  contributorPoints: number,
  routesCreated: number,
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', user.id),
      {
        id: user.id,
        name: user.name,
        bio: user.bio ?? null,
        avatarUrl: user.avatarUrl ?? null,
        isVerifiedCaptain: user.isVerifiedCaptain ?? false,
        role: user.role ?? 'BUYER',
        contributorPoints,
        routesCreated,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (err) {
    console.error('[userService] saveUserProfile failed:', err)
  }
}

/**
 * Fetches a user's public profile from Firestore.
 * Returns null if the document doesn't exist or the fetch fails.
 */
export async function fetchUserProfile(
  userId: string,
): Promise<FirestoreUserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    if (!snap.exists()) return null
    return snap.data() as FirestoreUserProfile
  } catch (err) {
    console.error('[userService] fetchUserProfile failed:', err)
    return null
  }
}
