import { create } from 'zustand'
import {
  ActionType, BadgeId, ContributorLevel, EarnedBadge, PointEvent, RewardItem,
  POINT_VALUES, LEVELS, getLevelForPoints, MIN_COMMENT_LENGTH_FOR_POINTS,
  BADGE_CONFIGS,
} from '../types/contributor'
import { safeStorage } from '../utils/storage'

const STORAGE_KEY = 'contributor_v2'

interface ContributorState {
  totalPoints:  number
  currentLevel: ContributorLevel
  pointEvents:  PointEvent[]
  earnedBadges: EarnedBadge[]
  /** Queue of level-up / badge-unlock events waiting to be shown as celebration toasts */
  pendingRewards: RewardItem[]

  // Selectors
  pointsToNextLevel:   () => number
  progressToNextLevel: () => number   // 0–1

  // Mutations
  earnPoints:    (action: ActionType, referenceId?: string, overrideText?: string) => void
  revokePoints:  (referenceId: string) => void
  awardBadge:    (badgeId: BadgeId) => void
  dismissReward: (rewardId: string) => void

  // Persistence
  loadContributor: () => Promise<void>
  saveContributor: () => Promise<void>
}

// ── Anti-spam helpers ─────────────────────────────────────────────────────────

/** Actions that may only fire once per unique referenceId */
const DEDUPED_ACTIONS = new Set<ActionType>([
  'ADD_PLACE', 'ADD_PHOTOS', 'WRITE_COMMENT', 'CREATE_ROUTE',
])

function canAward(events: PointEvent[], action: ActionType, refId?: string): boolean {
  if (!DEDUPED_ACTIONS.has(action) || !refId) return true
  return !events.some((e) => e.actionType === action && e.referenceId === refId)
}

// ── Badge trigger checks ──────────────────────────────────────────────────────

function checkBadges(
  events: PointEvent[],
  badges: EarnedBadge[],
  totalPoints: number,
): BadgeId[] {
  const awarded = new Set(badges.map((b) => b.badgeId))
  const newBadges: BadgeId[] = []
  const grant = (id: BadgeId) => { if (!awarded.has(id)) { newBadges.push(id); awarded.add(id) } }

  const placeCount   = events.filter((e) => e.actionType === 'ADD_PLACE').length
  const photoCount   = events.filter((e) => e.actionType === 'ADD_PHOTOS').length
  const commentCount = events.filter((e) => e.actionType === 'WRITE_COMMENT').length
  const routeCount   = events.filter((e) => e.actionType === 'CREATE_ROUTE').length
  const routeSolds   = events.filter((e) => e.actionType === 'ROUTE_PURCHASED').length
  const verifiedCount = events.filter((e) => e.actionType === 'PLACE_VERIFIED').length

  // Cartography
  if (placeCount >= 1)   grant('FIRST_PLACE')
  if (placeCount >= 10)  grant('TEN_PLACES')
  if (placeCount >= 50)  grant('FIFTY_PLACES')
  // Photography
  if (photoCount >= 1)   grant('FIRST_PHOTO')
  if (photoCount >= 20)  grant('PHOTO_COLLECTION')
  // Community
  if (commentCount >= 1)  grant('FIRST_COMMENT')
  if (commentCount >= 10) grant('ACTIVE_REVIEWER')
  // Navigation
  if (routeCount >= 1)   grant('FIRST_ROUTE')
  if (routeCount >= 5)   grant('ROUTE_MASTER')
  if (routeSolds >= 1)   grant('FIRST_ROUTE_SOLD')
  // Reputation
  if (verifiedCount >= 1)  grant('PLACE_VERIFIED')
  if (totalPoints >= 400)  grant('TOP_CONTRIBUTOR')
  if (totalPoints >= 800)  grant('MASTER_NAVIGATOR')
  // Milestones
  if (totalPoints >= 100)  grant('CENTURY_POINTS')
  if (totalPoints >= 250)  grant('RISING_STAR')

  return newBadges
}

function makeRewardId() {
  return `rw-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useContributorStore = create<ContributorState>((set, get) => ({
  totalPoints:    0,
  currentLevel:   LEVELS[0],
  pointEvents:    [],
  earnedBadges:   [],
  pendingRewards: [],

  pointsToNextLevel: () => {
    const { totalPoints, currentLevel } = get()
    if (currentLevel.maxPoints === Infinity) return 0
    return currentLevel.maxPoints + 1 - totalPoints
  },

  progressToNextLevel: () => {
    const { totalPoints, currentLevel } = get()
    if (currentLevel.maxPoints === Infinity) return 1
    const range = currentLevel.maxPoints + 1 - currentLevel.minPoints
    const done  = totalPoints - currentLevel.minPoints
    return Math.min(done / range, 1)
  },

  earnPoints: (action, referenceId, overrideText) => {
    const { pointEvents, earnedBadges, currentLevel, pendingRewards } = get()

    // Comment length guard
    if (action === 'WRITE_COMMENT' && overrideText !== undefined) {
      if (overrideText.length < MIN_COMMENT_LENGTH_FOR_POINTS) return
    }

    // Deduplication guard
    if (!canAward(pointEvents, action, referenceId)) return

    const pts = POINT_VALUES[action]
    const event: PointEvent = {
      id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      actionType: action,
      pointsAwarded: pts,
      referenceId,
      createdAt: new Date().toISOString(),
    }

    const newEvents   = [event, ...pointEvents]
    const newTotal    = get().totalPoints + pts
    const newLevel    = getLevelForPoints(newTotal)
    const newBadgeIds = checkBadges(newEvents, earnedBadges, newTotal)
    const newBadges   = [
      ...earnedBadges,
      ...newBadgeIds.map((id) => ({ badgeId: id, earnedAt: new Date().toISOString() })),
    ]

    // Build celebration rewards
    const rewards: RewardItem[] = [...pendingRewards]
    if (newLevel.level > currentLevel.level) {
      rewards.push({ id: makeRewardId(), type: 'LEVEL_UP', level: newLevel, createdAt: new Date().toISOString() })
    }
    for (const badgeId of newBadgeIds) {
      rewards.push({ id: makeRewardId(), type: 'BADGE_UNLOCK', badge: BADGE_CONFIGS[badgeId], createdAt: new Date().toISOString() })
    }

    set({
      totalPoints:    newTotal,
      currentLevel:   newLevel,
      pointEvents:    newEvents,
      earnedBadges:   newBadges,
      pendingRewards: rewards,
    })

    get().saveContributor()
  },

  revokePoints: (referenceId) => {
    const { pointEvents } = get()

    // Find events tied to this content
    const toRevoke = pointEvents.filter((e) => e.referenceId === referenceId)
    if (toRevoke.length === 0) return

    const revokedTotal = toRevoke.reduce((sum, e) => sum + e.pointsAwarded, 0)
    const remaining    = pointEvents.filter((e) => e.referenceId !== referenceId)
    const newTotal     = Math.max(0, get().totalPoints - revokedTotal)
    const newLevel     = getLevelForPoints(newTotal)

    // Badges are permanent once earned — we never remove them
    set({
      totalPoints:  newTotal,
      currentLevel: newLevel,
      pointEvents:  remaining,
      // earnedBadges unchanged
    })

    get().saveContributor()
  },

  awardBadge: (badgeId) => {
    const { earnedBadges, pendingRewards } = get()
    if (earnedBadges.some((b) => b.badgeId === badgeId)) return
    const updated = [...earnedBadges, { badgeId, earnedAt: new Date().toISOString() }]
    const reward: RewardItem = {
      id: makeRewardId(),
      type: 'BADGE_UNLOCK',
      badge: BADGE_CONFIGS[badgeId],
      createdAt: new Date().toISOString(),
    }
    set({ earnedBadges: updated, pendingRewards: [...pendingRewards, reward] })
    get().saveContributor()
  },

  dismissReward: (rewardId) => {
    set((state) => ({
      pendingRewards: state.pendingRewards.filter((r) => r.id !== rewardId),
    }))
  },

  loadContributor: async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        const total = saved.totalPoints ?? 0
        set({
          totalPoints:  total,
          currentLevel: getLevelForPoints(total),
          pointEvents:  saved.pointEvents  ?? [],
          earnedBadges: saved.earnedBadges ?? [],
          // pendingRewards are transient — never restored from storage
        })
      }
    } catch {
      // corrupt — start fresh
    }
  },

  saveContributor: async () => {
    try {
      const { totalPoints, pointEvents, earnedBadges } = get()
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify({ totalPoints, pointEvents, earnedBadges }))
    } catch {
      // in-memory only
    }
  },
}))
