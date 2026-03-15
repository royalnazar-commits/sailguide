import { create } from 'zustand'
import { RoutePoint } from '../types'

interface UserLocation {
  lat: number
  lng: number
  speed?: number  // knots
  heading?: number
}

interface NavigationState {
  isActive: boolean
  routeId: string | null
  points: RoutePoint[]
  currentPointIndex: number
  userLocation: UserLocation | null
  proximityAlert: RoutePoint | null

  startNavigation: (routeId: string, points: RoutePoint[]) => void
  stopNavigation: () => void
  updateLocation: (location: UserLocation) => void
  advanceToNextPoint: () => void
  dismissAlert: () => void
  setProximityAlert: (point: RoutePoint | null) => void
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  isActive: false,
  routeId: null,
  points: [],
  currentPointIndex: 0,
  userLocation: null,
  proximityAlert: null,

  startNavigation: (routeId, points) =>
    set({ isActive: true, routeId, points, currentPointIndex: 0, proximityAlert: null }),

  stopNavigation: () =>
    set({ isActive: false, routeId: null, points: [], currentPointIndex: 0, proximityAlert: null }),

  updateLocation: (location) => set({ userLocation: location }),

  advanceToNextPoint: () => {
    const { currentPointIndex, points } = get()
    if (currentPointIndex < points.length - 1) {
      set({ currentPointIndex: currentPointIndex + 1, proximityAlert: null })
    }
  },

  dismissAlert: () => set({ proximityAlert: null }),

  setProximityAlert: (point) => set({ proximityAlert: point }),
}))