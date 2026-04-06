import { create } from 'zustand'
import { safeStorage } from '../utils/storage'

// ── Public profile data ───────────────────────────────────────────────────────

export interface PublicProfile {
  id: string
  name: string
  username?: string
  bio?: string
  avatarUrl?: string
  isVerifiedCaptain: boolean
  role: 'BUYER' | 'CAPTAIN' | 'ADMIN'
  nauticalMiles: number
  routesCreated: number
  placesAdded: number
  contributorPoints: number
  memberSince: string
  /** IDs of profiles this person follows (static for demo users) */
  followingIds?: string[]
}

// ── Demo profiles ─────────────────────────────────────────────────────────────

export const DEMO_PROFILES: PublicProfile[] = [
  {
    id: 'captain-sofia',
    name: 'Captain Sofia',
    username: 'captainsofia',
    bio: 'Sailing the Adriatic for 12 years. Passionate about finding hidden anchorages along the Croatian and Montenegrin coasts. RYA Yachtmaster offshore.',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    isVerifiedCaptain: true,
    role: 'CAPTAIN',
    nauticalMiles: 4200,
    routesCreated: 2,
    placesAdded: 8,
    contributorPoints: 1850,
    memberSince: '2022-03-10',
    followingIds: ['captain-luca'],
  },
  {
    id: 'captain-luca',
    name: 'Captain Luca',
    username: 'captainluca',
    bio: 'Racing sailor from Trieste. Italian coast specialist, offshore racing crew. Adriatic conditions expert with 20+ transits of the Strait of Otranto.',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400',
    isVerifiedCaptain: true,
    role: 'CAPTAIN',
    nauticalMiles: 3100,
    routesCreated: 1,
    placesAdded: 5,
    contributorPoints: 1100,
    memberSince: '2022-08-15',
    followingIds: ['captain-sofia'],
  },
  {
    id: 'captain-ana',
    name: 'Captain Ana',
    username: 'captainana',
    bio: 'Sailing instructor and blue water sailor. 15 years on the Dalmatian coast. Specialist in coastal anchorages and family-friendly routes.',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    isVerifiedCaptain: true,
    role: 'CAPTAIN',
    nauticalMiles: 5600,
    routesCreated: 3,
    placesAdded: 12,
    contributorPoints: 2400,
    memberSince: '2021-05-20',
    followingIds: ['captain-sofia', 'captain-luca'],
  },
]

// Demo user already follows captain-sofia so social features are testable on first launch
const DEFAULT_FOLLOWING = ['captain-sofia']

const STORAGE_KEY = 'social_v1'

// ── Store ─────────────────────────────────────────────────────────────────────

interface SocialState {
  profiles: PublicProfile[]
  following: string[]

  followUser: (userId: string) => void
  unfollowUser: (userId: string) => void
  isFollowing: (userId: string) => boolean
  getProfile: (userId: string) => PublicProfile | undefined

  /** Profiles that follow the given user (based on followingIds of demo profiles) */
  getFollowerProfiles: (userId: string) => PublicProfile[]

  /**
   * Profiles that the given user follows.
   * For demo profiles: uses their followingIds.
   * For any other id (i.e. the logged-in user): uses the store's following array.
   */
  getFollowingProfiles: (userId: string) => PublicProfile[]

  /** Captains not in excludeIds, for discovery / suggestions */
  getSuggestedProfiles: (excludeIds: string[]) => PublicProfile[]

  load: () => Promise<void>
  save: () => Promise<void>
}

export const useSocialStore = create<SocialState>((set, get) => ({
  profiles: DEMO_PROFILES,
  following: DEFAULT_FOLLOWING,

  followUser: (userId) => {
    set((s) => ({
      following: s.following.includes(userId) ? s.following : [...s.following, userId],
    }))
    get().save()
  },

  unfollowUser: (userId) => {
    set((s) => ({ following: s.following.filter((id) => id !== userId) }))
    get().save()
  },

  isFollowing: (userId) => get().following.includes(userId),

  getProfile: (userId) => get().profiles.find((p) => p.id === userId),

  getFollowerProfiles: (userId) =>
    get().profiles.filter((p) => p.followingIds?.includes(userId)),

  getFollowingProfiles: (userId) => {
    const profile = get().profiles.find((p) => p.id === userId)
    if (profile) {
      return (profile.followingIds ?? [])
        .map((id) => get().profiles.find((p) => p.id === id))
        .filter((p): p is PublicProfile => p !== undefined)
    }
    // Not a known demo profile — treat as the current logged-in user
    return get().following
      .map((id) => get().profiles.find((p) => p.id === id))
      .filter((p): p is PublicProfile => p !== undefined)
  },

  getSuggestedProfiles: (excludeIds) =>
    get().profiles.filter((p) => !excludeIds.includes(p.id) && p.isVerifiedCaptain),

  load: async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        set({ following: saved.following ?? DEFAULT_FOLLOWING })
      }
    } catch {}
  },

  save: async () => {
    try {
      const { following } = get()
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify({ following }))
    } catch {}
  },
}))
