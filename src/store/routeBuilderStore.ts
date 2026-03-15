import { create } from 'zustand'
import { UserRoute, UserRouteStop, UserRouteStatus } from '../types/userRoute'
import { safeStorage } from '../utils/storage'
import { useContributorStore } from './contributorStore'

const STORAGE_KEY = 'userRoutes_v1'

// ── Haversine distance in nautical miles ──────────────────────────────────────
function haversineNm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3440.065 // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface PlaceCoord { lat: number; lng: number; region?: string; country?: string }

function computeTotalNm(stops: UserRouteStop[], getCoords: (placeId: string) => PlaceCoord | null): number {
  let total = 0
  for (let i = 0; i < stops.length - 1; i++) {
    const a = getCoords(stops[i].placeId)
    const b = getCoords(stops[i + 1].placeId)
    if (a && b) total += haversineNm(a.lat, a.lng, b.lat, b.lng)
  }
  return Math.round(total * 10) / 10
}

function computeEstimatedDays(stops: UserRouteStop[]): number {
  return stops.reduce((sum, s) => sum + (s.estimatedStayDays ?? 1), 0)
}

// ── Seed community routes ─────────────────────────────────────────────────────
// Pre-published routes that populate the catalog on first launch.
// Never persisted — always re-created from this constant.

export const SEED_ROUTES: UserRoute[] = [
  {
    id: 'route-seed-1',
    title: 'Saronic Islands Classic',
    description: 'A short but beautiful circuit around the Saronic Gulf. Perfect for a long weekend — Hydra is car-free and utterly charming, Spetses has excellent tavernas and calm anchorages.',
    stops: [
      { id: 'sr1-s1', placeId: 'hydra-marina',       sequence: 1, estimatedStayDays: 2 },
      { id: 'sr1-s2', placeId: 'spetses-anchorage',  sequence: 2, estimatedStayDays: 2 },
    ],
    totalNm: 16,
    estimatedDays: 4,
    region: 'Saronic Gulf',
    country: 'Greece',
    tags: ['weekend', 'beginner-friendly', 'greece'],
    status: 'PUBLISHED',
    createdBy: 'captain-lars',
    createdByName: 'Captain Lars',
    publishedAt: '2026-01-10T10:00:00Z',
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'route-seed-2',
    title: 'Cyclades Discovery',
    description: 'From the cosmopolitan beaches of Mykonos to the dramatic caldera of Santorini, this route captures the essence of the Cyclades. Allow extra time in Santorini — sunset from Oia is unmissable.',
    stops: [
      { id: 'sr2-s1', placeId: 'mykonos-marina',     sequence: 1, estimatedStayDays: 2 },
      { id: 'sr2-s2', placeId: 'santorini-caldera',  sequence: 2, estimatedStayDays: 3 },
      { id: 'sr2-s3', placeId: 'hydra-marina',       sequence: 3, estimatedStayDays: 2 },
    ],
    totalNm: 175,
    estimatedDays: 7,
    region: 'Cyclades',
    country: 'Greece',
    tags: ['islands', 'greece', 'scenic'],
    status: 'PUBLISHED',
    createdBy: 'maria-vela',
    createdByName: 'MariaVela',
    publishedAt: '2026-01-22T14:00:00Z',
    createdAt: '2026-01-22T12:00:00Z',
    updatedAt: '2026-01-22T14:00:00Z',
  },
  {
    id: 'route-seed-3',
    title: 'Dalmatian Coast Explorer',
    description: 'Croatia\'s Dalmatian coast at its finest. From party-central Hvar to the walled city of Dubrovnik, via the remote island of Vis and the medieval streets of Korčula. Book Hvar marina well in advance in summer.',
    stops: [
      { id: 'sr3-s1', placeId: 'hvar-marina',        sequence: 1, estimatedStayDays: 2 },
      { id: 'sr3-s2', placeId: 'vis-stoncica-bay',   sequence: 2, estimatedStayDays: 1 },
      { id: 'sr3-s3', placeId: 'korcula-anchorage',  sequence: 3, estimatedStayDays: 2 },
      { id: 'sr3-s4', placeId: 'dubrovnik-marina',   sequence: 4, estimatedStayDays: 3 },
    ],
    totalNm: 95,
    estimatedDays: 8,
    region: 'Dalmatian Coast',
    country: 'Croatia',
    tags: ['croatia', 'coastal', 'historic'],
    status: 'PUBLISHED',
    createdBy: 'adriatic-dream',
    createdByName: 'Adriatic Dream',
    publishedAt: '2026-02-05T09:00:00Z',
    createdAt: '2026-02-05T08:00:00Z',
    updatedAt: '2026-02-05T09:00:00Z',
  },
  {
    id: 'route-seed-4',
    title: 'Turquoise Coast Loop',
    description: 'The Turkish Riviera rewards sailors with impossibly blue water, pine-forested hillsides, and outstanding fresh seafood. Göcek is a great provisioning base; Ölüdeniz lagoon is worth anchoring outside for the view.',
    stops: [
      { id: 'sr4-s1', placeId: 'gocek-marina',       sequence: 1, estimatedStayDays: 1 },
      { id: 'sr4-s2', placeId: 'oludeniz-bay',       sequence: 2, estimatedStayDays: 3 },
      { id: 'sr4-s3', placeId: 'bozburun-anchorage', sequence: 3, estimatedStayDays: 2 },
    ],
    totalNm: 75,
    estimatedDays: 6,
    region: 'Turkish Riviera',
    country: 'Turkey',
    tags: ['turkey', 'turquoise-coast', 'anchorage'],
    status: 'PUBLISHED',
    createdBy: 'blue-voyage',
    createdByName: 'Blue Voyage',
    publishedAt: '2026-02-15T11:00:00Z',
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: '2026-02-15T11:00:00Z',
  },
  {
    id: 'route-seed-5',
    title: 'Ionian Islands Escape',
    description: 'The Ionian Sea is greener and calmer than the Aegean — perfect for first-season sailors. Navagio (Shipwreck Beach) is on every sailor\'s bucket list; arrive before 09:00 to beat the tour boats. Meganisi is a peaceful antidote.',
    stops: [
      { id: 'sr5-s1', placeId: 'navagio-beach',         sequence: 1, estimatedStayDays: 1 },
      { id: 'sr5-s2', placeId: 'lefkada-meganisi-bay',  sequence: 2, estimatedStayDays: 3 },
    ],
    totalNm: 48,
    estimatedDays: 4,
    region: 'Ionian Sea',
    country: 'Greece',
    tags: ['ionian', 'beginner-friendly', 'anchorage'],
    status: 'PUBLISHED',
    createdBy: 'john-sails',
    createdByName: 'JohnSails',
    publishedAt: '2026-02-20T16:00:00Z',
    createdAt: '2026-02-20T15:00:00Z',
    updatedAt: '2026-02-20T16:00:00Z',
  },
]

// ── Store interface ───────────────────────────────────────────────────────────

interface RouteBuilderState {
  /** Active draft being built; null when no draft in progress */
  draftRoute: UserRoute | null
  /** All saved routes (persisted) */
  savedRoutes: UserRoute[]

  // Draft management
  startNewRoute: () => void
  discardDraft: () => void
  updateDraftTitle: (title: string) => void
  updateDraftDescription: (description: string) => void

  // Stop management (getCoords injected so store stays decoupled from placesStore)
  addStop: (placeId: string, getCoords: (id: string) => PlaceCoord | null) => void
  removeStop: (stopId: string, getCoords: (id: string) => PlaceCoord | null) => void
  moveStop: (fromIndex: number, toIndex: number, getCoords: (id: string) => PlaceCoord | null) => void
  updateStopNotes: (stopId: string, notes: string) => void
  updateStopStayDays: (stopId: string, days: number) => void

  // Saving
  saveDraft: (getCoords: (id: string) => PlaceCoord | null, status?: UserRouteStatus) => UserRoute | null
  deleteRoute: (routeId: string) => void

  // Publishing
  /** Returns route from savedRoutes OR SEED_ROUTES — for detail screens */
  getRoute: (id: string) => UserRoute | undefined
  /** All published routes: seeds + user's published routes */
  getAllPublishedRoutes: () => UserRoute[]
  publishRoute: (routeId: string, createdByName?: string) => void
  unpublishRoute: (routeId: string) => void
  /** Set or clear premium pricing on a saved route */
  setRoutePremium: (routeId: string, isPremium: boolean, priceUsd: number) => void

  // Persistence
  loadRoutes: () => Promise<void>
  saveRoutes: () => Promise<void>
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useRouteBuilderStore = create<RouteBuilderState>((set, get) => ({
  draftRoute: null,
  savedRoutes: [],

  startNewRoute: () => {
    const now = new Date().toISOString()
    set({
      draftRoute: {
        id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: '',
        description: '',
        stops: [],
        totalNm: 0,
        estimatedDays: 0,
        tags: [],
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
      },
    })
  },

  discardDraft: () => set({ draftRoute: null }),

  updateDraftTitle: (title) => {
    set((s) => s.draftRoute ? { draftRoute: { ...s.draftRoute, title, updatedAt: new Date().toISOString() } } : {})
  },

  updateDraftDescription: (description) => {
    set((s) => s.draftRoute ? { draftRoute: { ...s.draftRoute, description, updatedAt: new Date().toISOString() } } : {})
  },

  addStop: (placeId, getCoords) => {
    set((s) => {
      if (!s.draftRoute) return {}
      const existing = s.draftRoute.stops.find((st) => st.placeId === placeId)
      if (existing) return {} // already added
      const newStop: UserRouteStop = {
        id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        placeId,
        sequence: s.draftRoute.stops.length + 1,
        estimatedStayDays: 1,
      }
      const stops = [...s.draftRoute.stops, newStop]
      const coords = getCoords(placeId)
      const firstCoords = stops.length === 1 && coords ? coords : getCoords(stops[0].placeId)
      return {
        draftRoute: {
          ...s.draftRoute,
          stops,
          totalNm: computeTotalNm(stops, getCoords),
          estimatedDays: computeEstimatedDays(stops),
          region: s.draftRoute.region ?? firstCoords?.region,
          country: s.draftRoute.country ?? firstCoords?.country,
          updatedAt: new Date().toISOString(),
        },
      }
    })
  },

  removeStop: (stopId, getCoords) => {
    set((s) => {
      if (!s.draftRoute) return {}
      const stops = s.draftRoute.stops
        .filter((st) => st.id !== stopId)
        .map((st, i) => ({ ...st, sequence: i + 1 }))
      return {
        draftRoute: {
          ...s.draftRoute,
          stops,
          totalNm: computeTotalNm(stops, getCoords),
          estimatedDays: computeEstimatedDays(stops),
          updatedAt: new Date().toISOString(),
        },
      }
    })
  },

  moveStop: (fromIndex, toIndex, getCoords) => {
    set((s) => {
      if (!s.draftRoute) return {}
      const arr = [...s.draftRoute.stops]
      const [moved] = arr.splice(fromIndex, 1)
      arr.splice(toIndex, 0, moved)
      const stops = arr.map((st, i) => ({ ...st, sequence: i + 1 }))
      return {
        draftRoute: {
          ...s.draftRoute,
          stops,
          totalNm: computeTotalNm(stops, getCoords),
          updatedAt: new Date().toISOString(),
        },
      }
    })
  },

  updateStopNotes: (stopId, notes) => {
    set((s) => {
      if (!s.draftRoute) return {}
      return {
        draftRoute: {
          ...s.draftRoute,
          stops: s.draftRoute.stops.map((st) => st.id === stopId ? { ...st, notes } : st),
          updatedAt: new Date().toISOString(),
        },
      }
    })
  },

  updateStopStayDays: (stopId, days) => {
    set((s) => {
      if (!s.draftRoute) return {}
      const stops = s.draftRoute.stops.map((st) => st.id === stopId ? { ...st, estimatedStayDays: days } : st)
      return {
        draftRoute: {
          ...s.draftRoute,
          stops,
          estimatedDays: computeEstimatedDays(stops),
          updatedAt: new Date().toISOString(),
        },
      }
    })
  },

  saveDraft: (getCoords, status = 'DRAFT') => {
    const { draftRoute, savedRoutes } = get()
    if (!draftRoute || !draftRoute.title.trim()) return null

    const route: UserRoute = {
      ...draftRoute,
      status,
      totalNm: computeTotalNm(draftRoute.stops, getCoords),
      estimatedDays: computeEstimatedDays(draftRoute.stops),
      updatedAt: new Date().toISOString(),
    }

    const existing = savedRoutes.findIndex((r) => r.id === route.id)
    const isNew = existing < 0
    const updated = isNew
      ? [route, ...savedRoutes]
      : savedRoutes.map((r, i) => (i === existing ? route : r))

    set({ savedRoutes: updated, draftRoute: null })
    get().saveRoutes()
    // Only award points the first time a route is saved (not on subsequent edits)
    if (isNew) useContributorStore.getState().earnPoints('CREATE_ROUTE', route.id)
    return route
  },

  deleteRoute: (routeId) => {
    set((s) => ({ savedRoutes: s.savedRoutes.filter((r) => r.id !== routeId) }))
    get().saveRoutes()
    useContributorStore.getState().revokePoints(routeId)
  },

  getRoute: (id) => {
    return get().savedRoutes.find((r) => r.id === id) ?? SEED_ROUTES.find((r) => r.id === id)
  },

  getAllPublishedRoutes: () => {
    const userPublished = get().savedRoutes.filter((r) => r.status === 'PUBLISHED')
    // Deduplicate: user-published routes override seed routes with same id (shouldn't happen, but safe)
    const userIds = new Set(userPublished.map((r) => r.id))
    return [...userPublished, ...SEED_ROUTES.filter((r) => !userIds.has(r.id))]
  },

  publishRoute: (routeId, createdByName) => {
    const now = new Date().toISOString()
    set((s) => ({
      savedRoutes: s.savedRoutes.map((r) =>
        r.id === routeId
          ? { ...r, status: 'PUBLISHED', publishedAt: r.publishedAt ?? now, createdByName, updatedAt: now }
          : r,
      ),
    }))
    get().saveRoutes()
  },

  unpublishRoute: (routeId) => {
    const now = new Date().toISOString()
    set((s) => ({
      savedRoutes: s.savedRoutes.map((r) =>
        r.id === routeId ? { ...r, status: 'DRAFT', updatedAt: now } : r,
      ),
    }))
    get().saveRoutes()
  },

  setRoutePremium: (routeId, isPremium, priceUsd) => {
    set((s) => ({
      savedRoutes: s.savedRoutes.map((r) =>
        r.id === routeId
          ? { ...r, isPremium, priceUsd: isPremium ? priceUsd : 0, updatedAt: new Date().toISOString() }
          : r,
      ),
    }))
    get().saveRoutes()
  },

  loadRoutes: async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY)
      if (raw) set({ savedRoutes: JSON.parse(raw) })
    } catch {
      set({ savedRoutes: [] })
    }
  },

  saveRoutes: async () => {
    try {
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify(get().savedRoutes))
    } catch {
      // in-memory only
    }
  },
}))
