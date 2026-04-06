import {
  collection, doc, setDoc, addDoc, updateDoc,
  query, where, orderBy, onSnapshot,
  serverTimestamp, getDoc, Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string
  participants: string[]
  participantNames: Record<string, string>
  lastMessage: string
  updatedAt: Timestamp | null
}

export interface Message {
  id: string
  senderId: string
  text: string
  createdAt: Timestamp | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic 1-to-1 conversation ID — same result regardless of argument order */
export function conversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_')
}

// ── Operations ───────────────────────────────────────────────────────────────

/**
 * Ensures a conversation document exists between two users.
 * Safe to call multiple times — only creates if missing.
 */
export async function getOrCreateConversation(
  myId: string,
  myName: string,
  theirId: string,
  theirName: string,
): Promise<string> {
  const id = conversationId(myId, theirId)
  try {
    const ref = doc(db, 'conversations', id)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        participants: [myId, theirId],
        participantNames: { [myId]: myName, [theirId]: theirName },
        lastMessage: '',
        updatedAt: serverTimestamp(),
      })
    }
  } catch (err) {
    console.error('[chatService] getOrCreateConversation failed:', err)
    // ID is deterministic — return it anyway so navigation is never blocked
  }
  return id
}

/** Realtime subscription to all conversations the current user is in */
export function subscribeToConversations(
  userId: string,
  onData: (convos: Conversation[]) => void,
): () => void {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    const convos = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation))
    onData(convos)
  })
}

/** Realtime subscription to messages in a conversation */
export function subscribeToMessages(
  convId: string,
  onData: (messages: Message[]) => void,
): () => void {
  const q = query(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('createdAt', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message))
    onData(messages)
  })
}

/** Send a message and update the conversation's lastMessage */
export async function sendMessage(
  convId: string,
  senderId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  try {
    await addDoc(collection(db, 'conversations', convId, 'messages'), {
      senderId,
      text: trimmed,
      createdAt: serverTimestamp(),
    })

    await updateDoc(doc(db, 'conversations', convId), {
      lastMessage: trimmed,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('[chatService] sendMessage failed:', err)
    throw err
  }
}
