import {
  collection, doc, addDoc, deleteDoc,
  query, where, onSnapshot,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// ── Types ────────────────────────────────────────────────────────────────────

export type SignalCategory = 'MeetUp' | 'NeedHelp' | 'Crew' | 'Tip' | 'Other'

export interface Signal {
  id: string
  userId: string
  userName: string
  text: string
  category: SignalCategory
  lat: number
  lng: number
  createdAt: Timestamp | null
  expiresAt: Timestamp | null
}

// ── Config ───────────────────────────────────────────────────────────────────

export const SIGNAL_CATEGORIES: { key: SignalCategory; emoji: string; color: string }[] = [
  { key: 'MeetUp',   emoji: '👋', color: '#22C55E' },
  { key: 'NeedHelp', emoji: '🆘', color: '#EF4444' },
  { key: 'Crew',     emoji: '⛵', color: '#3B82F6' },
  { key: 'Tip',      emoji: '💡', color: '#F59E0B' },
  { key: 'Other',    emoji: '📡', color: '#94A3B8' },
]

export function getCategoryMeta(key: SignalCategory) {
  return SIGNAL_CATEGORIES.find((c) => c.key === key) ?? SIGNAL_CATEGORIES[4]
}

// ── Operations ───────────────────────────────────────────────────────────────

/** Realtime subscription to all non-expired signals */
export function subscribeToActiveSignals(
  onData: (signals: Signal[]) => void,
): () => void {
  const now = Timestamp.now()
  const q = query(
    collection(db, 'signals'),
    where('expiresAt', '>', now),
  )
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Signal)))
  })
}

/**
 * Post a new signal. Enforces max 1 active per user client-side.
 * Returns the new signal's document ID.
 */
export async function postSignal(
  userId: string,
  userName: string,
  text: string,
  category: SignalCategory,
  lat: number,
  lng: number,
): Promise<string> {
  const now = Date.now()
  const expiresAt = Timestamp.fromMillis(now + 24 * 60 * 60 * 1000)
  try {
    const ref = await addDoc(collection(db, 'signals'), {
      userId,
      userName,
      text: text.trim(),
      category,
      lat,
      lng,
      createdAt: serverTimestamp(),
      expiresAt,
    })
    return ref.id
  } catch (err) {
    console.error('[signalService] postSignal failed:', err)
    throw err
  }
}

/** Delete a signal (user must own it — enforce in Firestore rules) */
export async function deleteSignal(signalId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'signals', signalId))
  } catch (err) {
    console.error('[signalService] deleteSignal failed:', err)
    throw err
  }
}

/** Returns the first active signal belonging to userId from a local list */
export function findUserSignal(signals: Signal[], userId: string): Signal | undefined {
  return signals.find((s) => s.userId === userId)
}
