/**
 * routeInteractionStore — ratings, saves, and comments for published UserRoutes.
 *
 * Fully local/persisted. All mutations go through store actions — the view
 * screen never mutates route data directly.
 */

import { create } from 'zustand'
import { safeStorage } from '../utils/storage'

const STORAGE_KEY = 'routeInteractions_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RouteComment {
  id: string
  userId: string
  userName: string
  text: string
  createdAt: string
}

interface RouteData {
  /** userId → star rating (1–5). Missing key = not rated. */
  ratings: Record<string, number>
  saveCount: number
  savedBy: string[]
  comments: RouteComment[]
}

const DEFAULT_ROUTE_DATA = (): RouteData => ({
  ratings: {}, saveCount: 0, savedBy: [], comments: [],
})

// ── Store interface ───────────────────────────────────────────────────────────

interface RouteInteractionState {
  routes: Record<string, RouteData>

  addRating:     (routeId: string, userId: string, rating: number) => void
  toggleSave:    (routeId: string, userId: string) => void
  addComment:    (routeId: string, userId: string, userName: string, text: string) => void
  deleteComment: (routeId: string, commentId: string, userId: string) => void

  getMyRating:  (routeId: string, userId: string) => number
  getAvgRating: (routeId: string) => { avg: number; count: number } | null
  isSaved:      (routeId: string, userId: string) => boolean
  getSaveCount: (routeId: string) => number
  getComments:  (routeId: string) => RouteComment[]

  load: () => Promise<void>
  save: () => Promise<void>
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useRouteInteractionStore = create<RouteInteractionState>((set, get) => ({
  routes: {},

  addRating: (routeId, userId, rating) => {
    set((s) => {
      const cur = s.routes[routeId] ?? DEFAULT_ROUTE_DATA()
      const newRatings = { ...cur.ratings }
      if (rating === 0) {
        delete newRatings[userId]
      } else {
        newRatings[userId] = Math.max(1, Math.min(5, rating))
      }
      return { routes: { ...s.routes, [routeId]: { ...cur, ratings: newRatings } } }
    })
    get().save()
  },

  toggleSave: (routeId, userId) => {
    set((s) => {
      const cur = s.routes[routeId] ?? DEFAULT_ROUTE_DATA()
      const already = cur.savedBy.includes(userId)
      return {
        routes: {
          ...s.routes,
          [routeId]: {
            ...cur,
            savedBy: already ? cur.savedBy.filter((id) => id !== userId) : [...cur.savedBy, userId],
            saveCount: already ? Math.max(0, cur.saveCount - 1) : cur.saveCount + 1,
          },
        },
      }
    })
    get().save()
  },

  addComment: (routeId, userId, userName, text) => {
    const comment: RouteComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      userName,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    }
    set((s) => {
      const cur = s.routes[routeId] ?? DEFAULT_ROUTE_DATA()
      return {
        routes: {
          ...s.routes,
          [routeId]: { ...cur, comments: [...cur.comments, comment] },
        },
      }
    })
    get().save()
  },

  deleteComment: (routeId, commentId, userId) => {
    set((s) => {
      const cur = s.routes[routeId]
      if (!cur) return {}
      return {
        routes: {
          ...s.routes,
          [routeId]: {
            ...cur,
            comments: cur.comments.filter((c) => !(c.id === commentId && c.userId === userId)),
          },
        },
      }
    })
    get().save()
  },

  getMyRating: (routeId, userId) => get().routes[routeId]?.ratings[userId] ?? 0,
  getAvgRating: (routeId) => {
    const ratings = get().routes[routeId]?.ratings
    if (!ratings) return null
    const values = Object.values(ratings)
    if (values.length === 0) return null
    const avg = values.reduce((s, v) => s + v, 0) / values.length
    return { avg: Math.round(avg * 10) / 10, count: values.length }
  },
  isSaved:      (routeId, userId) => get().routes[routeId]?.savedBy.includes(userId) ?? false,
  getSaveCount: (routeId) => get().routes[routeId]?.saveCount ?? 0,
  getComments:  (routeId) => get().routes[routeId]?.comments ?? [],

  load: async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Normalize: handle v1 data that had likeCount/likedBy instead of ratings
        const routes: Record<string, RouteData> = {}
        for (const [id, data] of Object.entries(parsed.routes ?? {})) {
          const d = data as any
          routes[id] = {
            ratings:   d.ratings   ?? {},
            saveCount: d.saveCount ?? 0,
            savedBy:   d.savedBy   ?? [],
            comments:  d.comments  ?? [],
          }
        }
        set({ routes })
      }
    } catch {}
  },

  save: async () => {
    try {
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify({ routes: get().routes }))
    } catch {}
  },
}))
