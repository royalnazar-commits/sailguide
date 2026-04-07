/**
 * Skipperway contributor store — manages Contribution Score (CS) and
 * Reputation Score (RS) separately, with anti-spam logic throughout.
 */

import { create } from 'zustand'
import {
  ContributionAction, ReputationAction,
  ContributionEvent, ReputationEvent,
  CONTRIBUTION_VALUES, REPUTATION_BASE,
  UNWEIGHTED_REPUTATION_ACTIONS, CONTENT_QUALITY_REQUIRED,
  DAILY_CS_CAP, MIN_COMMENT_LENGTH,
  TIER_WEIGHTS, UserTier,
  ENGAGER_FULL_WEIGHT_UP_TO, ENGAGER_SUBSEQUENT_WEIGHT, ENGAGER_INTERACTION_CAP,
  RS_DECAY_PERIOD_DAYS, RS_DECAY_FLOOR,
  SkipperwayLevel, SKIPPERWAY_LEVELS, getLevelForScores,
  BadgeId, EarnedBadge, BADGE_CONFIGS,
  RewardItem,
} from '../types/contributor'
import { safeStorage } from '../utils/storage'

const STORAGE_KEY = 'contributor_v3'

// ── Store interface ───────────────────────────────────────────────────────────

interface ContributorState {
  /** CS — visible score tracking what the user does */
  contributionScore: number
  /** RS — reputation score, drives level progression */
  reputationScore: number
  currentLevel: SkipperwayLevel

  contributionEvents: ContributionEvent[]
  reputationEvents: ReputationEvent[]
  earnedBadges: EarnedBadge[]
  pendingRewards: RewardItem[]

  // ── Selectors ──
  progressToNextLevel: () => number
  rsToNextLevel: () => number
  csToNextLevel: () => number
  uniqueEngagersCount: () => number
  qualityPiecesCount: () => number
  hasVerifiedContent: () => boolean
  totalContributions: () => number
  conditionsForLevel: (level: SkipperwayLevel) => Array<{
    label: string; met: boolean; current: number; required: number
  }>
  /**
   * Returns the current effective RS for a specific piece of content,
   * accounting for freshness decay. Use this to power ranked content lists
   * (popular routes, featured places, top captains).
   */
  getContentRS: (contentId: string) => number

  // ── Mutations ──
  earnContribution: (action: ContributionAction, referenceId?: string, text?: string) => void
  earnReputation: (action: ReputationAction, opts?: {
    engagerId?: string; engagerLevel?: number; contentId?: string
    /**
     * Pass `true` when the content being engaged with meets the minimum quality
     * bar (e.g. has a description, category, non-empty route stops).
     * Required for PLACE_LIKED, PLACE_SAVED, ROUTE_SAVED — omitting it silently
     * skips the RS grant for those actions.
     */
    qualityVerified?: boolean
  }) => void
  revokeContent: (referenceId: string) => void
  awardBadge: (badgeId: BadgeId) => void
  dismissReward: (rewardId: string) => void

  // ── Persistence ──
  loadContributor: () => Promise<void>
  saveContributor: () => Promise<void>

  spendPoints: (amount: number) => void

  // ── Legacy shims (called by placesStore / routeBuilderStore / commentsStore) ──
  earnPoints: (action: string, referenceId?: string, text?: string) => void
  revokePoints: (referenceId: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function csTodayTotal(events: ContributionEvent[]): number {
  const today = todayStr()
  return events.filter((e) => e.date === today).reduce((s, e) => s + e.csAwarded, 0)
}

const DEDUPED: Set<ContributionAction> = new Set(['ADD_PLACE', 'ADD_PHOTOS', 'WRITE_COMMENT', 'CREATE_ROUTE'])

function alreadyEarned(events: ContributionEvent[], action: ContributionAction, refId?: string): boolean {
  if (!DEDUPED.has(action) || !refId) return false
  return events.some((e) => e.action === action && e.referenceId === refId)
}

function priorInteractionsFrom(events: ReputationEvent[], engagerId: string, contentId: string): number {
  return events.filter((e) => e.engagerId === engagerId && e.contentId === contentId).length
}

function calcRS(action: ReputationAction, engagerLevel: number, priorCount: number): number {
  const base = REPUTATION_BASE[action]
  const unweighted = UNWEIGHTED_REPUTATION_ACTIONS.has(action)
  const tierWeight = unweighted
    ? 1.0
    : TIER_WEIGHTS[(Math.min(Math.max(engagerLevel, 1), 6)) as UserTier]
  let diminish = 1.0
  if (priorCount >= ENGAGER_INTERACTION_CAP) return 0
  if (priorCount >= ENGAGER_FULL_WEIGHT_UP_TO) diminish = ENGAGER_SUBSEQUENT_WEIGHT
  return Math.round(base * tierWeight * diminish * 10) / 10
}

// ── Freshness decay ───────────────────────────────────────────────────────────

function ageDecay(createdAt: string): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  return Math.max(RS_DECAY_FLOOR, 1 - (ageDays / RS_DECAY_PERIOD_DAYS) * (1 - RS_DECAY_FLOOR))
}

/**
 * Compute total effective RS from all reputation events, with freshness decay.
 * This is always recomputed from events — it naturally changes as events age.
 */
function computeEffectiveRS(events: ReputationEvent[]): number {
  return Math.round(events.reduce((sum, e) => sum + e.rsAwarded * ageDecay(e.createdAt), 0) * 10) / 10
}

/**
 * Compute effective RS for a single piece of content (by contentId).
 * Used to power ranked content lists: popular routes, featured places, etc.
 */
function computeContentRS(events: ReputationEvent[], contentId: string): number {
  return Math.round(
    events
      .filter((e) => e.contentId === contentId)
      .reduce((sum, e) => sum + e.rsAwarded * ageDecay(e.createdAt), 0) * 10
  ) / 10
}

function deriveConditions(ce: ContributionEvent[], re: ReputationEvent[]) {
  return {
    uniqueEngagers: new Set(re.map((e) => e.engagerId).filter(Boolean)).size,
    qualityPieces: ce.filter((e) => e.action === 'ADD_PLACE' || e.action === 'CREATE_ROUTE').length,
    hasVerifiedContent: re.some((e) => e.action === 'PLACE_VERIFIED'),
    totalContributions: ce.length,
  }
}

function checkBadges(
  ce: ContributionEvent[], re: ReputationEvent[],
  earned: EarnedBadge[], cs: number, levelNum: number,
): BadgeId[] {
  const have = new Set(earned.map((b) => b.badgeId))
  const ids: BadgeId[] = []
  const grant = (id: BadgeId) => { if (!have.has(id)) { ids.push(id); have.add(id) } }

  const places   = ce.filter((e) => e.action === 'ADD_PLACE').length
  const photos   = ce.filter((e) => e.action === 'ADD_PHOTOS').length
  const comments = ce.filter((e) => e.action === 'WRITE_COMMENT').length
  const routes   = ce.filter((e) => e.action === 'CREATE_ROUTE').length
  const sold     = re.filter((e) => e.action === 'ROUTE_PURCHASED').length
  const verified = re.some((e) => e.action === 'PLACE_VERIFIED')
  const engagers = new Set(re.map((e) => e.engagerId).filter(Boolean)).size

  if (places >= 1)   grant('FIRST_PLACE')
  if (places >= 10)  grant('TEN_PLACES')
  if (places >= 50)  grant('FIFTY_PLACES')
  if (photos >= 1)   grant('FIRST_PHOTO')
  if (photos >= 20)  grant('PHOTO_COLLECTION')
  if (comments >= 1) grant('FIRST_COMMENT')
  if (comments >= 10)grant('ACTIVE_REVIEWER')
  if (routes >= 1)   grant('FIRST_ROUTE')
  if (routes >= 5)   grant('ROUTE_MASTER')
  if (sold >= 1)     grant('FIRST_ROUTE_SOLD')
  if (engagers >= 1) grant('FIRST_ENGAGER')
  if (engagers >= 10)grant('TEN_ENGAGERS')
  if (verified)      grant('VERIFIED_SCOUT')
  if (levelNum >= 3) grant('REACHED_CAPTAIN')
  if (levelNum >= 4) grant('REACHED_SEA_GUIDE')
  if (levelNum >= 5) grant('REACHED_COMMODORE')
  if (levelNum >= 6) grant('REACHED_LEGEND')
  if (cs >= 50)      grant('CS_FIFTY')
  if (cs >= 200)     grant('CS_TWO_HUNDRED')

  return ids
}

function buildRewards(pending: RewardItem[], prevLevel: number, newLevel: SkipperwayLevel, newBadgeIds: BadgeId[]): RewardItem[] {
  const rewards = [...pending]
  if (newLevel.level > prevLevel) {
    rewards.push({ id: makeId('rw'), type: 'LEVEL_UP', level: newLevel, createdAt: new Date().toISOString() })
  }
  for (const badgeId of newBadgeIds) {
    rewards.push({ id: makeId('rw'), type: 'BADGE_UNLOCK', badge: BADGE_CONFIGS[badgeId], createdAt: new Date().toISOString() })
  }
  return rewards
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useContributorStore = create<ContributorState>((set, get) => ({
  contributionScore: 0,
  reputationScore: 0,
  currentLevel: SKIPPERWAY_LEVELS[0],
  contributionEvents: [],
  reputationEvents: [],
  earnedBadges: [],
  pendingRewards: [],

  progressToNextLevel: () => {
    const { reputationScore, currentLevel } = get()
    const nextIdx = currentLevel.level
    if (nextIdx >= SKIPPERWAY_LEVELS.length) return 1
    const next = SKIPPERWAY_LEVELS[nextIdx]
    const range = next.minRS - currentLevel.minRS
    return range > 0 ? Math.min((reputationScore - currentLevel.minRS) / range, 1) : 1
  },

  rsToNextLevel: () => {
    const { reputationScore, currentLevel } = get()
    const nextIdx = currentLevel.level
    if (nextIdx >= SKIPPERWAY_LEVELS.length) return 0
    return Math.max(0, SKIPPERWAY_LEVELS[nextIdx].minRS - reputationScore)
  },

  csToNextLevel: () => {
    const { contributionScore, currentLevel } = get()
    const nextIdx = currentLevel.level
    if (nextIdx >= SKIPPERWAY_LEVELS.length) return 0
    return Math.max(0, SKIPPERWAY_LEVELS[nextIdx].minCS - contributionScore)
  },

  getContentRS: (contentId) => computeContentRS(get().reputationEvents, contentId),

  uniqueEngagersCount: () =>
    new Set(get().reputationEvents.map((e) => e.engagerId).filter(Boolean)).size,

  qualityPiecesCount: () =>
    get().contributionEvents.filter((e) => e.action === 'ADD_PLACE' || e.action === 'CREATE_ROUTE').length,

  hasVerifiedContent: () =>
    get().reputationEvents.some((e) => e.action === 'PLACE_VERIFIED'),

  totalContributions: () =>
    get().contributionEvents.length,

  conditionsForLevel: (level) => {
    const { uniqueEngagersCount, qualityPiecesCount, hasVerifiedContent, totalContributions } = get()
    const c = level.conditions
    const rows: Array<{ label: string; met: boolean; current: number; required: number }> = []
    if (c.minUniqueEngagers !== undefined) {
      const cur = uniqueEngagersCount()
      rows.push({ label: 'Sailors who engaged with your content', met: cur >= c.minUniqueEngagers, current: cur, required: c.minUniqueEngagers })
    }
    if (c.minQualityPieces !== undefined) {
      const cur = qualityPiecesCount()
      rows.push({ label: 'Places or routes contributed', met: cur >= c.minQualityPieces, current: cur, required: c.minQualityPieces })
    }
    if (c.requiresVerifiedContent) {
      const cur = hasVerifiedContent() ? 1 : 0
      rows.push({ label: 'Verified place or route', met: cur >= 1, current: cur, required: 1 })
    }
    if (c.minContributions !== undefined) {
      const cur = totalContributions()
      rows.push({ label: 'Contributions made', met: cur >= c.minContributions, current: cur, required: c.minContributions })
    }
    return rows
  },

  earnContribution: (action, referenceId, text) => {
    const { contributionEvents, reputationEvents, earnedBadges, pendingRewards, currentLevel } = get()
    if (action === 'WRITE_COMMENT' && text !== undefined && text.length < MIN_COMMENT_LENGTH) return
    if (alreadyEarned(contributionEvents, action, referenceId)) return
    const rawCS = CONTRIBUTION_VALUES[action]
    const remaining = Math.max(0, DAILY_CS_CAP - csTodayTotal(contributionEvents))
    const csAwarded = Math.min(rawCS, remaining)
    if (csAwarded <= 0) return

    const event: ContributionEvent = {
      id: makeId('ce'), action, csAwarded, referenceId,
      date: todayStr(), createdAt: new Date().toISOString(),
    }
    const newCE = [event, ...contributionEvents]
    const newCS = get().contributionScore + csAwarded
    const cond = deriveConditions(newCE, reputationEvents)
    const newLevel = getLevelForScores(get().reputationScore, newCS, cond)
    const newBadgeIds = checkBadges(newCE, reputationEvents, earnedBadges, newCS, newLevel.level)
    const newBadges = [...earnedBadges, ...newBadgeIds.map((id) => ({ badgeId: id, earnedAt: new Date().toISOString() }))]

    set({
      contributionScore: newCS, currentLevel: newLevel,
      contributionEvents: newCE, earnedBadges: newBadges,
      pendingRewards: buildRewards(pendingRewards, currentLevel.level, newLevel, newBadgeIds),
    })
    get().saveContributor()
  },

  earnReputation: (action, opts = {}) => {
    const { reputationEvents, contributionEvents, earnedBadges, pendingRewards, currentLevel } = get()
    const { engagerId, engagerLevel = 1, contentId, qualityVerified = false } = opts

    // Quality gate: low-signal user actions require verified quality content
    if (CONTENT_QUALITY_REQUIRED.has(action) && !qualityVerified) return

    const prior = (engagerId && contentId) ? priorInteractionsFrom(reputationEvents, engagerId, contentId) : 0
    const rsAwarded = calcRS(action, engagerLevel, prior)
    if (rsAwarded <= 0) return

    const event: ReputationEvent = {
      id: makeId('re'), action, rsAwarded, engagerId, contentId,
      createdAt: new Date().toISOString(),
    }
    const newRE = [event, ...reputationEvents]
    // RS is always recomputed from events with freshness decay applied
    const newRS = computeEffectiveRS(newRE)
    const cond = deriveConditions(contributionEvents, newRE)
    const newLevel = getLevelForScores(newRS, get().contributionScore, cond)
    const newBadgeIds = checkBadges(contributionEvents, newRE, earnedBadges, get().contributionScore, newLevel.level)
    const newBadges = [...earnedBadges, ...newBadgeIds.map((id) => ({ badgeId: id, earnedAt: new Date().toISOString() }))]

    set({
      reputationScore: newRS, currentLevel: newLevel,
      reputationEvents: newRE, earnedBadges: newBadges,
      pendingRewards: buildRewards(pendingRewards, currentLevel.level, newLevel, newBadgeIds),
    })
    get().saveContributor()
  },

  revokeContent: (referenceId) => {
    const { contributionEvents, reputationEvents } = get()
    const revokedCS = contributionEvents.filter((e) => e.referenceId === referenceId).reduce((s, e) => s + e.csAwarded, 0)
    const remainingCE = contributionEvents.filter((e) => e.referenceId !== referenceId)
    const revokedRS = reputationEvents.filter((e) => e.contentId === referenceId).reduce((s, e) => s + e.rsAwarded, 0)
    const remainingRE = reputationEvents.filter((e) => e.contentId !== referenceId)
    const newCS = Math.max(0, get().contributionScore - revokedCS)
    const newRS = Math.max(0, get().reputationScore - revokedRS)
    const cond = deriveConditions(remainingCE, remainingRE)
    set({
      contributionScore: newCS, reputationScore: newRS,
      currentLevel: getLevelForScores(newRS, newCS, cond),
      contributionEvents: remainingCE, reputationEvents: remainingRE,
    })
    get().saveContributor()
  },

  awardBadge: (badgeId) => {
    const { earnedBadges, pendingRewards } = get()
    if (earnedBadges.some((b) => b.badgeId === badgeId)) return
    set({
      earnedBadges: [...earnedBadges, { badgeId, earnedAt: new Date().toISOString() }],
      pendingRewards: [...pendingRewards, { id: makeId('rw'), type: 'BADGE_UNLOCK', badge: BADGE_CONFIGS[badgeId], createdAt: new Date().toISOString() }],
    })
    get().saveContributor()
  },

  dismissReward: (rewardId) => {
    set((s) => ({ pendingRewards: s.pendingRewards.filter((r) => r.id !== rewardId) }))
  },

  loadContributor: async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        const cs = saved.contributionScore ?? 0
        const ce: ContributionEvent[] = saved.contributionEvents ?? []
        const re: ReputationEvent[] = saved.reputationEvents ?? []
        // Always recompute RS from events so freshness decay is applied on load
        const rs = computeEffectiveRS(re)
        set({
          contributionScore: cs, reputationScore: rs,
          currentLevel: getLevelForScores(rs, cs, deriveConditions(ce, re)),
          contributionEvents: ce, reputationEvents: re,
          earnedBadges: saved.earnedBadges ?? [],
        })
      }
    } catch {
      // corrupt — start fresh
    }
  },

  saveContributor: async () => {
    try {
      const { contributionScore, reputationScore, contributionEvents, reputationEvents, earnedBadges } = get()
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify({
        contributionScore, reputationScore, contributionEvents, reputationEvents, earnedBadges,
      }))
    } catch {
      // in-memory only
    }
  },

  spendPoints: (amount) => {
    set((s) => ({ contributionScore: Math.max(0, s.contributionScore - amount) }))
    get().saveContributor()
  },

  // ── Legacy shims ──────────────────────────────────────────────────────────

  earnPoints: (action, referenceId, text) => {
    const contributionSet = new Set<string>(['ADD_PLACE', 'ADD_PHOTOS', 'WRITE_COMMENT', 'CREATE_ROUTE'])
    if (contributionSet.has(action)) {
      get().earnContribution(action as ContributionAction, referenceId, text)
    }
  },

  revokePoints: (referenceId) => {
    get().revokeContent(referenceId)
  },
}))
