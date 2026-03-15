/**
 * Safe AsyncStorage wrapper.
 *
 * @react-native-async-storage/async-storage v3 throws "Native module is null"
 * in Expo Go when accessed via a top-level import. Using a lazy require() inside
 * each call defers the module resolution and lets us catch + swallow the error so
 * the app keeps running with in-memory state only.
 */

function getStorage(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-async-storage/async-storage').default
  } catch {
    return null
  }
}

export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const storage = getStorage()
      if (!storage) return null
      return await storage.getItem(key)
    } catch {
      return null
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const storage = getStorage()
      if (!storage) return
      await storage.setItem(key, value)
    } catch {
      // Storage unavailable — state lives in memory only
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const storage = getStorage()
      if (!storage) return
      await storage.removeItem(key)
    } catch {
      // ignore
    }
  },
}
