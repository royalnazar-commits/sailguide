import { create } from 'zustand'
import { safeStorage } from '../utils/storage'

interface UserStats {
  routesCompleted: number
  nauticalMiles: number
  favoriteRegion: string
  memberSince: string
  reviewsWritten: number
  routesSaved: number
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  earned: boolean
  earnedAt?: string
}

interface Activity {
  id: string
  type: 'completed_route' | 'review_written' | 'route_saved' | 'achievement_earned'
  title: string
  subtitle: string
  date: string
  icon: string
  iconColor: string
}

interface UserPreferences {
  pushNotifications: boolean
  emailNotifications: boolean
  locationServices: boolean
  offlineMaps: boolean
  distanceUnit: 'nm' | 'km'
  temperatureUnit: 'C' | 'F'
}

interface ProfileState {
  userStats: UserStats
  achievements: Achievement[]
  recentActivity: Activity[]
  preferences: UserPreferences
  savedRoutes: string[]
  savedPlaces: string[]

  // Actions
  updateStats: (stats: Partial<UserStats>) => void
  earnAchievement: (achievementId: string) => void
  addActivity: (activity: Activity) => void
  updatePreferences: (prefs: Partial<UserPreferences>) => void
  saveRoute: (routeId: string) => void
  unsaveRoute: (routeId: string) => void
  toggleSaveRoute: (routeId: string) => void
  savePlace: (placeId: string) => void
  unsavePlace: (placeId: string) => void
  loadProfile: () => Promise<void>
  saveProfile: () => Promise<void>
}

const initialStats: UserStats = {
  routesCompleted: 2,
  nauticalMiles: 280,
  favoriteRegion: 'Greek Islands',
  memberSince: '2023-05-15',
  reviewsWritten: 2,
  routesSaved: 4,
}

const initialAchievements: Achievement[] = [
  { 
    id: '1', 
    title: 'First Voyage', 
    description: 'Complete your first route', 
    icon: 'boat', 
    earned: true, 
    earnedAt: '2023-06-01' 
  },
  { 
    id: '2', 
    title: 'Island Hopper', 
    description: 'Visit 10+ islands', 
    icon: 'location', 
    earned: true, 
    earnedAt: '2023-08-15' 
  },
  { 
    id: '3', 
    title: 'Marathon Sailor', 
    description: 'Sail 500+ nautical miles', 
    icon: 'trophy', 
    earned: false 
  },
  { 
    id: '4', 
    title: 'Route Reviewer', 
    description: 'Write 5 route reviews', 
    icon: 'star', 
    earned: false 
  },
  { 
    id: '5', 
    title: 'Explorer', 
    description: 'Complete routes in 3 regions', 
    icon: 'compass', 
    earned: false 
  },
  { 
    id: '6', 
    title: 'Captain', 
    description: 'Sail 1000+ nautical miles', 
    icon: 'ribbon', 
    earned: false 
  },
]

const initialActivity: Activity[] = [
  {
    id: '1',
    type: 'completed_route',
    title: 'Completed Saronic Islands Classic',
    subtitle: 'Finished 6-day route in Greece',
    date: '2024-03-10',
    icon: 'checkmark-circle',
    iconColor: '#22C55E',
  },
  {
    id: '2',
    type: 'review_written',
    title: 'Reviewed Dalmatian Islands Explorer',
    subtitle: '5 stars - "Amazing route with beautiful anchorages"',
    date: '2024-03-05',
    icon: 'star',
    iconColor: '#F59E0B',
  },
  {
    id: '3',
    type: 'route_saved',
    title: 'Saved Ionian Islands Adventure',
    subtitle: 'Added to your saved routes',
    date: '2024-02-28',
    icon: 'bookmark',
    iconColor: '#1B6CA8',
  },
]

const initialPreferences: UserPreferences = {
  pushNotifications: true,
  emailNotifications: true,
  locationServices: true,
  offlineMaps: false,
  distanceUnit: 'nm',
  temperatureUnit: 'C',
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  userStats: initialStats,
  achievements: initialAchievements,
  recentActivity: initialActivity,
  preferences: initialPreferences,
  savedRoutes: ['saronic-classic', 'dalmatian-explorer'],
  savedPlaces: [],

  updateStats: (stats) => {
    set((state) => ({
      userStats: { ...state.userStats, ...stats }
    }))
    get().saveProfile()
  },

  earnAchievement: (achievementId) => {
    set((state) => ({
      achievements: state.achievements.map(achievement =>
        achievement.id === achievementId
          ? { ...achievement, earned: true, earnedAt: new Date().toISOString() }
          : achievement
      ),
      recentActivity: [
        {
          id: `achievement-${Date.now()}`,
          type: 'achievement_earned',
          title: `Achievement Unlocked!`,
          subtitle: state.achievements.find(a => a.id === achievementId)?.title || '',
          date: new Date().toISOString().split('T')[0],
          icon: 'trophy',
          iconColor: '#F59E0B',
        },
        ...state.recentActivity
      ].slice(0, 10) // Keep only last 10 activities
    }))
    get().saveProfile()
  },

  addActivity: (activity) => {
    set((state) => ({
      recentActivity: [activity, ...state.recentActivity].slice(0, 10)
    }))
    get().saveProfile()
  },

  updatePreferences: (prefs) => {
    set((state) => ({
      preferences: { ...state.preferences, ...prefs }
    }))
    get().saveProfile()
  },

  saveRoute: (routeId) => {
    set((state) => {
      if (!state.savedRoutes.includes(routeId)) {
        const newActivity: Activity = {
          id: `save-${Date.now()}`,
          type: 'route_saved',
          title: 'Route Saved',
          subtitle: 'Added to your saved routes',
          date: new Date().toISOString().split('T')[0],
          icon: 'bookmark',
          iconColor: '#1B6CA8',
        }
        
        return {
          savedRoutes: [...state.savedRoutes, routeId],
          recentActivity: [newActivity, ...state.recentActivity].slice(0, 10),
          userStats: { ...state.userStats, routesSaved: state.userStats.routesSaved + 1 }
        }
      }
      return state
    })
    get().saveProfile()
  },

  unsaveRoute: (routeId) => {
    set((state) => ({
      savedRoutes: state.savedRoutes.filter(id => id !== routeId),
      userStats: { ...state.userStats, routesSaved: Math.max(0, state.userStats.routesSaved - 1) }
    }))
    get().saveProfile()
  },

  toggleSaveRoute: (routeId) => {
    const { savedRoutes, saveRoute, unsaveRoute } = get()
    if (savedRoutes.includes(routeId)) {
      unsaveRoute(routeId)
    } else {
      saveRoute(routeId)
    }
  },

  savePlace: (placeId) => {
    set((state) => {
      if (state.savedPlaces.includes(placeId)) return state
      return { savedPlaces: [...state.savedPlaces, placeId] }
    })
    get().saveProfile()
  },

  unsavePlace: (placeId) => {
    set((state) => ({ savedPlaces: state.savedPlaces.filter(id => id !== placeId) }))
    get().saveProfile()
  },

  loadProfile: async () => {
    try {
      const profileData = await safeStorage.getItem('userProfile')
      if (profileData) {
        const parsed = JSON.parse(profileData)
        set({
          userStats: { ...initialStats, ...parsed.userStats },
          achievements: parsed.achievements || initialAchievements,
          recentActivity: parsed.recentActivity || initialActivity,
          preferences: { ...initialPreferences, ...parsed.preferences },
          savedRoutes: parsed.savedRoutes || [],
          savedPlaces: parsed.savedPlaces || [],
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  },

  saveProfile: async () => {
    try {
      const { userStats, achievements, recentActivity, preferences, savedRoutes, savedPlaces } = get()
      await safeStorage.setItem('userProfile', JSON.stringify({
        userStats,
        achievements,
        recentActivity,
        preferences,
        savedRoutes,
        savedPlaces,
      }))
    } catch (error) {
      console.error('Error saving profile:', error)
    }
  },
}))

// Profile is loaded lazily — call useProfileStore.getState().loadProfile()
// inside a useEffect in your root layout, not at module load time.