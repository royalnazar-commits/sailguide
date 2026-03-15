import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  setAuth: (user: User, token: string) => Promise<void>
  clearAuth: () => Promise<void>
  loadAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync('auth_token', token)
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user))
    set({ user, token })
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('auth_token')
    await SecureStore.deleteItemAsync('auth_user')
    set({ user: null, token: null })
  },

  loadAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token')
      const userStr = await SecureStore.getItemAsync('auth_user')
      if (token && userStr) {
        set({ user: JSON.parse(userStr), token })
      }
    } catch {}
    set({ isLoading: false })
  },
}))