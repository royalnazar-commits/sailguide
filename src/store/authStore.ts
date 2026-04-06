import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { User } from '../types'

/**
 * Auth store — single source of truth for the current session.
 *
 * Two-layer storage contract:
 *   • Zustand store  — in-memory, always current. All app code (including
 *                      the axios interceptor in api.ts) reads from here.
 *   • SecureStore    — encrypted on-disk persistence. Only read once on
 *                      app start (loadAuth), then kept in sync by setAuth /
 *                      clearAuth. Never read per-request.
 *
 * Outside React components, access state via:
 *   useAuthStore.getState().token
 *   useAuthStore.getState().clearAuth()
 */

// SecureStore keys — keep in one place to avoid typos across the codebase.
const SECURE_KEY_TOKEN = 'auth_token'
const SECURE_KEY_USER  = 'auth_user'

interface AuthState {
  user: User | null
  token: string | null
  /** True while loadAuth() is reading from SecureStore on first launch. */
  isLoading: boolean

  /**
   * Persist a new session. Writes to both the in-memory store and SecureStore.
   * Call after a successful login or register response.
   */
  setAuth: (user: User, token: string) => Promise<void>

  /**
   * Destroy the current session. Clears both in-memory store and SecureStore.
   * Called by the 401 response interceptor (token expired/invalid) and by
   * explicit logout actions.
   */
  clearAuth: () => Promise<void>

  /**
   * Rehydrate the in-memory store from SecureStore. Call once on app start.
   * Sets isLoading = false when complete regardless of outcome.
   */
  loadAuth: () => Promise<void>

  /** Update mutable user fields in both layers. Does not touch the token. */
  updateUser: (updates: Partial<User>) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: async (user, token) => {
    // Persist first — if SecureStore fails, we don't want in-memory state to
    // diverge from what will survive an app restart.
    await SecureStore.setItemAsync(SECURE_KEY_TOKEN, token)
    await SecureStore.setItemAsync(SECURE_KEY_USER, JSON.stringify(user))
    set({ user, token })
  },

  clearAuth: async () => {
    // Update in-memory state first so any subscriber (e.g. auth guard) reacts
    // immediately, then clean up SecureStore in the background.
    set({ user: null, token: null })
    await SecureStore.deleteItemAsync(SECURE_KEY_TOKEN)
    await SecureStore.deleteItemAsync(SECURE_KEY_USER)
  },

  loadAuth: async () => {
    try {
      const token   = await SecureStore.getItemAsync(SECURE_KEY_TOKEN)
      const userStr = await SecureStore.getItemAsync(SECURE_KEY_USER)
      if (token && userStr) {
        set({ user: JSON.parse(userStr), token })
      }
    } catch (err) {
      if (__DEV__) console.warn('[authStore] loadAuth failed to read SecureStore:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  updateUser: async (updates) => {
    const { user } = get()
    if (!user) return
    const updated = { ...user, ...updates }
    try {
      await SecureStore.setItemAsync(SECURE_KEY_USER, JSON.stringify(updated))
    } catch (err) {
      if (__DEV__) console.warn('[authStore] updateUser failed to persist to SecureStore:', err)
    }
    set({ user: updated })
  },
}))