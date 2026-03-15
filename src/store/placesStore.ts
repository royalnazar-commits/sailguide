import { create } from 'zustand'
import { Place, PlaceType, PlaceEditRecord } from '../types/place'
import { UserRole } from '../types'
import { safeStorage } from '../utils/storage'
import { useContributorStore } from './contributorStore'
import { canEditPlace, canRepositionPlace, canDeletePlace } from '../utils/placePermissions'

const PLACES_KEY   = 'userPlaces_v2'
const LOCAL_UID_KEY = 'sailguide_local_user_id'

/** Fields the user fills in when creating a place */
export interface CreatePlaceInput {
  name: string
  type: PlaceType
  lat: number
  lng: number
  description: string
  country: string
  region: string
  notes?: string
  tags?: string[]
  /**
   * Photo URIs selected from device or camera.
   * Stored as local file:// URIs now; swap for remote URLs once backend exists.
   */
  photos?: string[]
}

interface PlacesState {
  userPlaces: Place[]
  /**
   * Stable device-local user ID used when no real auth session exists.
   * Generated once per install and persisted so the same device always
   * "owns" its previously-created markers.
   */
  localUserId: string

  // Lifecycle
  initLocalUser: () => Promise<void>
  loadPlaces: () => Promise<void>
  savePlaces: () => Promise<void>

  // CRUD — return true on success, false on permission denied
  addPlace: (input: CreatePlaceInput, userId?: string, userRole?: UserRole) => Place
  updatePlace: (
    placeId: string,
    updates: Partial<CreatePlaceInput>,
    userId?: string,
    userRole?: UserRole,
  ) => boolean
  repositionPlace: (
    placeId: string,
    lat: number,
    lng: number,
    userId?: string,
    userRole?: UserRole,
  ) => boolean
  deletePlace: (placeId: string, userId?: string, userRole?: UserRole) => boolean
  /** Set or clear premium pricing on a user-created place */
  setPlacePremium: (placeId: string, isPremium: boolean, priceUsd: number) => void
}

function makeLocalUserId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const usePlacesStore = create<PlacesState>((set, get) => ({
  userPlaces: [],
  localUserId: makeLocalUserId(), // overwritten by initLocalUser

  // ── Init ──────────────────────────────────────────────────────────────────

  initLocalUser: async () => {
    try {
      const stored = await safeStorage.getItem(LOCAL_UID_KEY)
      if (stored) {
        set({ localUserId: stored })
      } else {
        const newId = makeLocalUserId()
        await safeStorage.setItem(LOCAL_UID_KEY, newId)
        set({ localUserId: newId })
      }
    } catch {
      // storage unavailable — the in-memory fallback ID already set in initial state
    }
  },

  // ── Persistence ───────────────────────────────────────────────────────────

  loadPlaces: async () => {
    try {
      const raw = await safeStorage.getItem(PLACES_KEY)
      if (raw) {
        const parsed: Place[] = JSON.parse(raw)
        set({ userPlaces: parsed })
      }
    } catch {
      set({ userPlaces: [] })
    }
  },

  savePlaces: async () => {
    try {
      await safeStorage.setItem(PLACES_KEY, JSON.stringify(get().userPlaces))
    } catch {
      // storage unavailable — in-memory only
    }
  },

  // ── CRUD ──────────────────────────────────────────────────────────────────

  addPlace: (input, userId, _userRole) => {
    const now = new Date().toISOString()
    const newPlace: Place = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name:        input.name.trim(),
      type:        input.type,
      lat:         input.lat,
      lng:         input.lng,
      description: input.description,
      country:     input.country,
      region:      input.region,
      photos:      input.photos ?? [],
      tips:        [],
      tags:        input.tags ?? [],
      notes:       input.notes,
      isVerified:      false,
      isUserCreated:   true,
      createdBy:       userId,
      createdAt:       now,
      updatedAt:       now,
      status:          'DRAFT',
      editHistory:     [],
    }

    set((state) => ({ userPlaces: [newPlace, ...state.userPlaces] }))
    get().savePlaces()
    useContributorStore.getState().earnPoints('ADD_PLACE', newPlace.id)
    if ((input.photos ?? []).length > 0) {
      useContributorStore.getState().earnPoints('ADD_PHOTOS', newPlace.id)
    }
    return newPlace
  },

  updatePlace: (placeId, updates, userId, userRole) => {
    const place = get().userPlaces.find((p) => p.id === placeId)
    if (!place || !canEditPlace(place, userId, userRole)) return false

    const record: PlaceEditRecord = {
      changedAt: new Date().toISOString(),
      changedBy: userId ?? 'unknown',
      fields: Object.keys(updates),
    }

    set((state) => ({
      userPlaces: state.userPlaces.map((p) => {
        if (p.id !== placeId) return p
        return {
          ...p,
          ...updates,
          // preserve the photos array reference when not explicitly overridden
          photos:      updates.photos   !== undefined ? updates.photos   : p.photos,
          updatedAt:   new Date().toISOString(),
          editHistory: [...(p.editHistory ?? []), record],
        }
      }),
    }))
    get().savePlaces()
    return true
  },

  repositionPlace: (placeId, lat, lng, userId, userRole) => {
    const place = get().userPlaces.find((p) => p.id === placeId)
    if (!place || !canRepositionPlace(place, userId, userRole)) return false

    const record: PlaceEditRecord = {
      changedAt: new Date().toISOString(),
      changedBy: userId ?? 'unknown',
      fields:    ['lat', 'lng'],
    }

    set((state) => ({
      userPlaces: state.userPlaces.map((p) => {
        if (p.id !== placeId) return p
        return {
          ...p,
          lat,
          lng,
          updatedAt:   new Date().toISOString(),
          editHistory: [...(p.editHistory ?? []), record],
        }
      }),
    }))
    get().savePlaces()
    return true
  },

  deletePlace: (placeId, userId, userRole) => {
    const place = get().userPlaces.find((p) => p.id === placeId)
    if (!place || !canDeletePlace(place, userId, userRole)) return false

    set((state) => ({ userPlaces: state.userPlaces.filter((p) => p.id !== placeId) }))
    get().savePlaces()
    // Reverse contributor points tied to this place
    useContributorStore.getState().revokePoints(placeId)
    return true
  },

  setPlacePremium: (placeId, isPremium, priceUsd) => {
    set((s) => ({
      userPlaces: s.userPlaces.map((p) =>
        p.id === placeId
          ? { ...p, isPremium, priceUsd: isPremium ? priceUsd : 0 }
          : p,
      ),
    }))
    get().savePlaces()
  },
}))
