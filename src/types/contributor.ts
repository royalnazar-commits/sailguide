/**
 * Skipperway Contribution & Reputation System
 *
 * Two-layer progression:
 *
 *   Contribution Score (CS) — visible, lightweight feedback for actions.
 *     Tracks what the user does. Rises relatively often.
 *     Daily cap prevents spam. NOT used for level gating by itself.
 *
 *   Reputation Score (RS) — slow, quality-based, drives level progression.
 *     Earned almost exclusively from meaningful engagement by OTHER users.
 *     Resistant to spam via tier weighting + diminishing returns.
 *
 * Level progression requires BOTH RS thresholds AND milestone conditions.
 * Levels feel earned, rare, and meaningful — not arcade achievements.
 */

// ── Contribution actions (user's own actions → CS only) ───────────────────────

export type ContributionAction =
  | 'ADD_PLACE'       // User added a new place
  | 'ADD_PHOTOS'      // User added photos to a place
  | 'WRITE_COMMENT'   // User wrote a review / comment (min length enforced)
  | 'CREATE_ROUTE'    // User published a sailing route

export const CONTRIBUTION_VALUES: Record<ContributionAction, number> = {
  ADD_PLACE:     5,
  ADD_PHOTOS:    3,
  WRITE_COMMENT: 2,
  CREATE_ROUTE:  8,
}

/** Max CS a user can earn per calendar day (anti-spam soft cap) */
export const DAILY_CS_CAP = 30

/** Minimum comment length (chars) to qualify for CS */
export const MIN_COMMENT_LENGTH = 20

// ── Reputation actions (from engagement by other users → RS) ──────────────────

export type ReputationAction =
  | 'PLACE_LIKED'           // Another user liked your place
  | 'PLACE_SAVED'           // Another user saved/bookmarked your place
  | 'PLACE_USED_IN_ROUTE'   // Your place was added to another user's route
  | 'PLACE_VERIFIED'        // Your place was approved by moderators
  | 'ROUTE_SAVED'           // Another user saved your published route
  | 'ROUTE_PURCHASED'       // Another user bought your premium route
  | 'ROUTE_CHARTER_CLICK'   // Your route generated a charter inquiry
  | 'COMMENT_RECEIVED'      // Someone left a substantive comment on your content
  | 'QUALITY_FLAG'          // Content flagged as high-quality by the platform

/** Base RS values — multiplied by engager's tier weight before applying */
export const REPUTATION_BASE: Record<ReputationAction, number> = {
  PLACE_LIKED:         0.5,  // weak signal — courtesy tap, not an endorsement
  PLACE_SAVED:         4,    // intent to use — strong signal
  PLACE_USED_IN_ROUTE: 10,   // downstream adoption — highest organic signal
  PLACE_VERIFIED:      20,   // admin-triggered, no weight multiplier
  ROUTE_SAVED:         5,    // route endorsement
  ROUTE_PURCHASED:     25,   // real money transaction — highest signal
  ROUTE_CHARTER_CLICK: 3,
  COMMENT_RECEIVED:    0.5,  // noise-filtered; low weight to prevent spam
  QUALITY_FLAG:        12,   // platform-triggered
}

/**
 * Actions where RS is only awarded if the content meets a minimum quality bar.
 * Callers must pass `qualityVerified: true` to `earnReputation` for these.
 * Without it, no RS is granted — this prevents low-effort content from
 * gaming the system through bulk likes/saves.
 */
export const CONTENT_QUALITY_REQUIRED = new Set<ReputationAction>([
  'PLACE_LIKED',
  'PLACE_SAVED',
  'ROUTE_SAVED',
])

// ── Freshness decay ───────────────────────────────────────────────────────────
//
// Effective RS from any event decays over time. This keeps the system dynamic:
// contributors who stay active maintain high RS; stale content loses weight.
//
// Formula: decay = max(RS_DECAY_FLOOR, 1 − (ageDays / RS_DECAY_PERIOD_DAYS) × (1 − RS_DECAY_FLOOR))
//   Age 0d  → 1.0 (full)
//   Age 180d → ~0.6
//   Age 365d → 0.2 (floor)
//   Age 365d+ → 0.2 (clamped)

/** Days over which RS decays from 1.0 to RS_DECAY_FLOOR */
export const RS_DECAY_PERIOD_DAYS = 365
/** Minimum multiplier — events never fully expire */
export const RS_DECAY_FLOOR = 0.2

/** Actions where the engager's tier does NOT apply (platform/admin triggers) */
export const UNWEIGHTED_REPUTATION_ACTIONS = new Set<ReputationAction>([
  'PLACE_VERIFIED', 'QUALITY_FLAG', 'ROUTE_PURCHASED', 'ROUTE_CHARTER_CLICK',
])

// ── Engager tier weights ───────────────────────────────────────────────────────
//
// When another user engages with your content, the RS awarded scales with
// their level. A like from a Legend carries more weight than from a Deckhand.

export type UserTier = 1 | 2 | 3 | 4 | 5 | 6

export const TIER_WEIGHTS: Record<UserTier, number> = {
  1: 0.3,   // Deckhand   — new user, low signal
  2: 0.6,   // Skipper    — starting contributor
  3: 1.0,   // Captain    — baseline (calibrated to this level)
  4: 1.5,   // Sea Guide  — valued community member
  5: 2.0,   // Commodore  — pillar of the community
  6: 3.0,   // Legend     — highest possible signal
}

// ── Anti-spam rules ───────────────────────────────────────────────────────────

/** Only the FIRST interaction from engager X on content Y carries full weight */
export const ENGAGER_FULL_WEIGHT_UP_TO = 1
/** Subsequent interactions from same engager on same content: 10% weight */
export const ENGAGER_SUBSEQUENT_WEIGHT = 0.1
/** After this many interactions from same engager on same content, give 0 RS */
export const ENGAGER_INTERACTION_CAP = 5

// ── Level milestone conditions ────────────────────────────────────────────────

export interface LevelConditions {
  /** Distinct users who engaged with any of your content */
  minUniqueEngagers?: number
  /** Combined count of published places + published routes */
  minQualityPieces?: number
  /** At least 1 place must have been verified by moderators */
  requiresVerifiedContent?: boolean
  /** Minimum total contribution actions recorded */
  minContributions?: number
}

// ── Level definitions ─────────────────────────────────────────────────────────

export interface SkipperwayLevel {
  level: number
  name: string
  subtitle: string
  minRS: number
  minCS: number
  conditions: LevelConditions
  icon: string        // Ionicons name
  color: string
  privileges: string[]
}

export const SKIPPERWAY_LEVELS: SkipperwayLevel[] = [
  {
    level: 1,
    name: 'Deckhand',
    subtitle: 'New to the fleet',
    minRS: 0, minCS: 0,
    conditions: {},
    icon: 'boat-outline', color: '#94A3B8',
    privileges: ['Browse routes', 'Explore places', 'Save favourites'],
  },
  {
    level: 2,
    name: 'Skipper',
    subtitle: 'Starting to leave your mark',
    minRS: 25, minCS: 15,
    conditions: { minContributions: 1 },
    icon: 'navigate-outline', color: '#22C55E',
    privileges: ['Publish routes to community', 'Write place reviews', 'Build multi-day itineraries'],
  },
  {
    level: 3,
    name: 'Captain',
    subtitle: 'Trusted by the community',
    minRS: 150, minCS: 80,
    conditions: { minUniqueEngagers: 8 },
    icon: 'ribbon-outline', color: '#1B6CA8',
    privileges: ['Trusted reviewer badge', 'Route visibility boost', 'Full community catalog access'],
  },
  {
    level: 4,
    name: 'Sea Guide',
    subtitle: 'Valued by the fleet',
    minRS: 500, minCS: 200,
    conditions: { minUniqueEngagers: 25, minQualityPieces: 10 },
    icon: 'compass-outline', color: '#8B5CF6',
    privileges: ['Profile highlight in search', 'Partner charter discounts', 'Premium route creation tools'],
  },
  {
    level: 5,
    name: 'Commodore',
    subtitle: 'A pillar of the community',
    minRS: 1500, minCS: 500,
    conditions: { minUniqueEngagers: 60, minQualityPieces: 25, requiresVerifiedContent: true },
    icon: 'shield-outline', color: '#F59E0B',
    privileges: ['Commodore badge on profile', 'Skipperway merchandise', 'Revenue share on routes', 'Beta features access'],
  },
  {
    level: 6,
    name: 'Legend',
    subtitle: 'Exceptionally rare. Recognized by the seas.',
    minRS: 4000, minCS: 1000,
    conditions: { minUniqueEngagers: 150, minQualityPieces: 50, requiresVerifiedContent: true },
    icon: 'trophy-outline', color: '#EF4444',
    privileges: ['Legend status across Skipperway', 'Premium partner benefits', 'Advisory board consideration', 'Lifetime charter credit'],
  },
]

/**
 * Returns the highest level the user currently qualifies for.
 * All threshold AND milestone conditions must be satisfied.
 */
export function getLevelForScores(
  rs: number,
  cs: number,
  conditions: {
    uniqueEngagers: number
    qualityPieces: number
    hasVerifiedContent: boolean
    totalContributions: number
  },
): SkipperwayLevel {
  const qualified = [...SKIPPERWAY_LEVELS].reverse().find((lvl) => {
    if (rs < lvl.minRS) return false
    if (cs < lvl.minCS) return false
    const c = lvl.conditions
    if (c.minUniqueEngagers !== undefined && conditions.uniqueEngagers < c.minUniqueEngagers) return false
    if (c.minQualityPieces !== undefined && conditions.qualityPieces < c.minQualityPieces) return false
    if (c.requiresVerifiedContent && !conditions.hasVerifiedContent) return false
    if (c.minContributions !== undefined && conditions.totalContributions < c.minContributions) return false
    return true
  })
  return qualified ?? SKIPPERWAY_LEVELS[0]
}

/** Approximate level from CS alone — used for other-user profile display */
export function getLevelForCS(cs: number): SkipperwayLevel {
  return getLevelForScores(cs * 0.25, cs, {
    uniqueEngagers: 0, qualityPieces: 0,
    hasVerifiedContent: false, totalContributions: cs > 0 ? 1 : 0,
  })
}

// ── Badges ────────────────────────────────────────────────────────────────────

export type BadgeId =
  | 'FIRST_PLACE' | 'TEN_PLACES' | 'FIFTY_PLACES'
  | 'FIRST_PHOTO' | 'PHOTO_COLLECTION'
  | 'FIRST_COMMENT' | 'ACTIVE_REVIEWER'
  | 'FIRST_ROUTE' | 'ROUTE_MASTER' | 'FIRST_ROUTE_SOLD'
  | 'FIRST_ENGAGER' | 'TEN_ENGAGERS' | 'VERIFIED_SCOUT'
  | 'REACHED_CAPTAIN' | 'REACHED_SEA_GUIDE' | 'REACHED_COMMODORE' | 'REACHED_LEGEND'
  | 'CS_FIFTY' | 'CS_TWO_HUNDRED'

export type BadgeCategory =
  | 'REPUTATION' | 'NAVIGATION' | 'CARTOGRAPHY' | 'PHOTOGRAPHY' | 'COMMUNITY' | 'MILESTONES'

export interface BadgeConfig {
  id: BadgeId
  category: BadgeCategory
  title: string
  description: string
  icon: string
  color: string
}

export const BADGE_CONFIGS: Record<BadgeId, BadgeConfig> = {
  FIRST_PLACE:       { id: 'FIRST_PLACE',       category: 'CARTOGRAPHY', title: 'Cartographer',     description: 'Added your first place to the map',                  icon: 'location',         color: '#22C55E' },
  TEN_PLACES:        { id: 'TEN_PLACES',         category: 'CARTOGRAPHY', title: 'Harbour Master',   description: 'Added 10 places to the map',                        icon: 'anchor',           color: '#1B6CA8' },
  FIFTY_PLACES:      { id: 'FIFTY_PLACES',       category: 'CARTOGRAPHY', title: 'Chart Maker',      description: 'Added 50 places to the map',                        icon: 'map',              color: '#8B5CF6' },
  FIRST_PHOTO:       { id: 'FIRST_PHOTO',        category: 'PHOTOGRAPHY', title: 'Eye of the Sea',   description: 'Added your first photo to a place',                  icon: 'camera',           color: '#EC4899' },
  PHOTO_COLLECTION:  { id: 'PHOTO_COLLECTION',   category: 'PHOTOGRAPHY', title: 'Visual Reporter',  description: 'Added photos to 20 different places',               icon: 'images',           color: '#F97316' },
  FIRST_COMMENT:     { id: 'FIRST_COMMENT',      category: 'COMMUNITY',   title: 'Voice of the Sea', description: 'Wrote your first quality review',                    icon: 'chatbubble',       color: '#06B6D4' },
  ACTIVE_REVIEWER:   { id: 'ACTIVE_REVIEWER',    category: 'COMMUNITY',   title: 'Trusted Reviewer', description: 'Wrote 10 quality reviews',                          icon: 'star',             color: '#F59E0B' },
  FIRST_ROUTE:       { id: 'FIRST_ROUTE',        category: 'NAVIGATION',  title: 'Route Planner',    description: 'Published your first sailing route',                 icon: 'git-branch',       color: '#10B981' },
  ROUTE_MASTER:      { id: 'ROUTE_MASTER',       category: 'NAVIGATION',  title: 'Route Master',     description: 'Published 5 sailing routes',                        icon: 'navigate',         color: '#1B6CA8' },
  FIRST_ROUTE_SOLD:  { id: 'FIRST_ROUTE_SOLD',   category: 'NAVIGATION',  title: 'Sea Merchant',     description: 'Your route was purchased by another sailor',         icon: 'cash',             color: '#059669' },
  FIRST_ENGAGER:     { id: 'FIRST_ENGAGER',      category: 'REPUTATION',  title: 'Noticed',          description: 'Another sailor engaged with your content',           icon: 'heart',            color: '#EC4899' },
  TEN_ENGAGERS:      { id: 'TEN_ENGAGERS',       category: 'REPUTATION',  title: 'Trusted Source',   description: '10 unique sailors engaged with your content',        icon: 'people',           color: '#1B6CA8' },
  VERIFIED_SCOUT:    { id: 'VERIFIED_SCOUT',     category: 'REPUTATION',  title: 'Verified Scout',   description: 'A place you added was verified by the community',    icon: 'shield-checkmark', color: '#6366F1' },
  REACHED_CAPTAIN:   { id: 'REACHED_CAPTAIN',    category: 'REPUTATION',  title: 'Captain',          description: 'Earned Captain level — trusted by the community',    icon: 'ribbon',           color: '#1B6CA8' },
  REACHED_SEA_GUIDE: { id: 'REACHED_SEA_GUIDE',  category: 'REPUTATION',  title: 'Sea Guide',        description: 'Earned Sea Guide level — valued by the fleet',       icon: 'compass',          color: '#8B5CF6' },
  REACHED_COMMODORE: { id: 'REACHED_COMMODORE',  category: 'REPUTATION',  title: 'Commodore',        description: 'Earned Commodore level — a pillar of the community',  icon: 'shield',           color: '#F59E0B' },
  REACHED_LEGEND:    { id: 'REACHED_LEGEND',     category: 'REPUTATION',  title: 'Legend',           description: 'Earned Legend level — exceptionally rare',           icon: 'trophy',           color: '#EF4444' },
  CS_FIFTY:          { id: 'CS_FIFTY',           category: 'MILESTONES',  title: 'Active Sailor',    description: 'Reached 50 contribution points',                     icon: 'medal',            color: '#84CC16' },
  CS_TWO_HUNDRED:    { id: 'CS_TWO_HUNDRED',     category: 'MILESTONES',  title: 'Seasoned Hand',    description: 'Reached 200 contribution points',                   icon: 'star-half',        color: '#EAB308' },
}

export const BADGE_CATEGORY_ORDER: BadgeCategory[] = [
  'REPUTATION', 'NAVIGATION', 'CARTOGRAPHY', 'PHOTOGRAPHY', 'COMMUNITY', 'MILESTONES',
]

// ── Event types ───────────────────────────────────────────────────────────────

export interface ContributionEvent {
  id: string
  action: ContributionAction
  csAwarded: number
  referenceId?: string
  /** ISO date (YYYY-MM-DD) — used for daily cap bucketing */
  date: string
  createdAt: string
}

export interface ReputationEvent {
  id: string
  action: ReputationAction
  rsAwarded: number
  engagerId?: string
  contentId?: string
  createdAt: string
}

export interface EarnedBadge {
  badgeId: BadgeId
  earnedAt: string
}

export type RewardType = 'LEVEL_UP' | 'BADGE_UNLOCK'

export interface RewardItem {
  id: string
  type: RewardType
  level?: SkipperwayLevel
  badge?: BadgeConfig
  createdAt: string
}

// ── Legacy re-exports (backward compat with existing callers) ─────────────────

/** @deprecated Use SKIPPERWAY_LEVELS */
export const LEVELS = SKIPPERWAY_LEVELS

/** @deprecated Use getLevelForCS or getLevelForScores */
export function getLevelForPoints(points: number): SkipperwayLevel {
  return getLevelForCS(points)
}

/** @deprecated */
export type ActionType = ContributionAction | ReputationAction

/** @deprecated */
export const POINT_VALUES: Partial<Record<string, number>> = {
  ADD_PLACE: 5, ADD_PHOTOS: 3, WRITE_COMMENT: 2, CREATE_ROUTE: 8,
}

/** @deprecated */
export const MIN_COMMENT_LENGTH_FOR_POINTS = MIN_COMMENT_LENGTH

/** @deprecated */
export type ContributorLevel = SkipperwayLevel
