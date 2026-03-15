import { create } from 'zustand'
import { CaptainSettings, PurchasedItem, PurchaseItemType } from '../types/captain'
import { safeStorage } from '../utils/storage'

const STORAGE_KEY = 'captain_v1'

const DEFAULT_SETTINGS: CaptainSettings = {
  subscriptionEnabled: false,
  subscriptionPriceUsd: 9.99,
}

interface CaptainState {
  /** Settings for the current user when they are a captain */
  captainSettings: CaptainSettings
  /** Items and subscriptions the current user has purchased */
  purchasedItems: PurchasedItem[]

  // ── Captain settings (only relevant for CAPTAIN role) ─────────────────────
  updateCaptainSettings: (updates: Partial<CaptainSettings>) => void

  // ── Purchase actions ──────────────────────────────────────────────────────
  purchaseItem: (item: Omit<PurchasedItem, 'id' | 'purchasedAt'>) => void

  // ── Access checks ─────────────────────────────────────────────────────────
  /**
   * Returns true if the current user can access this route.
   * Pass viewerUserId so we can short-circuit when the captain views their own content.
   */
  hasAccessToRoute: (routeId: string, captainId: string, viewerUserId?: string) => boolean
  hasAccessToPlace: (placeId: string, captainId: string, viewerUserId?: string) => boolean
  isSubscribedTo: (captainId: string) => boolean

  // ── Persistence ───────────────────────────────────────────────────────────
  loadCaptainData: () => Promise<void>
  saveCaptainData: () => Promise<void>
}

export const useCaptainStore = create<CaptainState>((set, get) => ({
  captainSettings: DEFAULT_SETTINGS,
  purchasedItems: [],

  updateCaptainSettings: (updates) => {
    set((s) => ({ captainSettings: { ...s.captainSettings, ...updates } }))
    get().saveCaptainData()
  },

  purchaseItem: (item) => {
    const newItem: PurchasedItem = {
      ...item,
      id: `pi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      purchasedAt: new Date().toISOString(),
    }
    set((s) => ({ purchasedItems: [...s.purchasedItems, newItem] }))
    get().saveCaptainData()
  },

  isSubscribedTo: (captainId) => {
    return get().purchasedItems.some(
      (p) => p.type === 'SUBSCRIPTION' && p.captainId === captainId,
    )
  },

  hasAccessToRoute: (routeId, captainId, viewerUserId) => {
    // Captain always has access to their own content
    if (viewerUserId && viewerUserId === captainId) return true
    const { purchasedItems } = get()
    // Subscribed to this captain
    if (purchasedItems.some((p) => p.type === 'SUBSCRIPTION' && p.captainId === captainId)) return true
    // Individually purchased
    if (purchasedItems.some((p) => p.type === 'ROUTE' && p.itemId === routeId)) return true
    return false
  },

  hasAccessToPlace: (placeId, captainId, viewerUserId) => {
    if (viewerUserId && viewerUserId === captainId) return true
    const { purchasedItems } = get()
    if (purchasedItems.some((p) => p.type === 'SUBSCRIPTION' && p.captainId === captainId)) return true
    if (purchasedItems.some((p) => p.type === 'PLACE' && p.itemId === placeId)) return true
    return false
  },

  loadCaptainData: async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        set({
          captainSettings: { ...DEFAULT_SETTINGS, ...(saved.captainSettings ?? {}) },
          purchasedItems: saved.purchasedItems ?? [],
        })
      }
    } catch {
      // corrupt — start fresh
    }
  },

  saveCaptainData: async () => {
    try {
      const { captainSettings, purchasedItems } = get()
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify({ captainSettings, purchasedItems }))
    } catch {
      // in-memory only
    }
  },
}))
