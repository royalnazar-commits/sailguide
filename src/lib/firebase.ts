import { initializeApp, getApps } from 'firebase/app'
import { getFirestore, enableNetwork } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBcmunx5MIcXvGlfgZAc_8gq43emlJ-6Os',
  authDomain: 'sailguide-87c2a.firebaseapp.com',
  projectId: 'sailguide-87c2a',
  storageBucket: 'sailguide-87c2a.firebasestorage.app',
  messagingSenderId: '164880907525',
  appId: '1:164880907525:web:23b7da2f05644934064b6c',
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const db = getFirestore(app)

enableNetwork(db).catch((err) => console.error('[Firebase] enableNetwork failed:', err))
