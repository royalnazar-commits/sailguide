import { create } from 'zustand'
import { MapMarker, MapMarkerCategory } from '../types/mapMarker'
import { safeStorage } from '../utils/storage'

const STORAGE_KEY = 'mapMarkers_v1'

interface MapMarkersState {
  markers: MapMarker[]
  addMarker: (
    lat: number,
    lng: number,
    title: string,
    category: MapMarkerCategory,
    note?: string,
  ) => MapMarker
  updateMarker: (
    id: string,
    updates: Partial<Pick<MapMarker, 'title' | 'note' | 'category'>>,
  ) => void
  removeMarker: (id: string) => void
  loadMarkers: () => Promise<void>
  saveMarkers: () => Promise<void>
}

export const useMapMarkersStore = create<MapMarkersState>((set, get) => ({
  markers: [],

  addMarker: (lat, lng, title, category, note) => {
    const marker: MapMarker = {
      id: `marker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      note: note || undefined,
      category,
      latitude: lat,
      longitude: lng,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set((s) => ({ markers: [...s.markers, marker] }))
    get().saveMarkers()
    return marker
  },

  updateMarker: (id, updates) => {
    set((s) => ({
      markers: s.markers.map((m) =>
        m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m,
      ),
    }))
    get().saveMarkers()
  },

  removeMarker: (id) => {
    set((s) => ({ markers: s.markers.filter((m) => m.id !== id) }))
    get().saveMarkers()
  },

  loadMarkers: async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY)
      if (raw) set({ markers: JSON.parse(raw) })
    } catch {
      set({ markers: [] })
    }
  },

  saveMarkers: async () => {
    try {
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify(get().markers))
    } catch {
      // in-memory only
    }
  },
}))
