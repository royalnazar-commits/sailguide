/**
 * Contributor Level System
 *
 * Users earn points for meaningful platform contributions.
 * Points accumulate into levels visible across the app,
 * building community trust and motivating quality content.
 *
 * Points are reversible — deleting contributed content removes
 * the associated points. Earned badges, however, are permanent
 * (losing them after the fact would feel punishing rather than motivating).
 */

// ── Action types & point values ───────────────────────────────────────────────

export type ActionType =
  | 'ADD_PLACE'         // +10 — new place added to the map
  | 'ADD_PHOTOS'        // +5  — photos added to a place (per batch)
  | 'WRITE_COMMENT'     // +3  — comment/review posted (≥ 20 chars)
  | 'CREATE_ROUTE'      // +20 — sailing route saved
  | 'ROUTE_SAVED'       // +5  — another user saves your route
  | 'ROUTE_PURCHASED'   // +20 — another user purchases your route
  | 'PLACE_VERIFIED'    // +15 — moderation approves your place
  | 'PLACE_LIKED'       // +2  — your place receives a like

export const POINT_VALUES: Record<ActionType, number> = {
  ADD_PLACE:        10,
  ADD_PHOTOS:        5,
  WRITE_COMMENT:     3,
  CREATE_ROUTE:     20,
  ROUTE_SAVED:       5,
  ROUTE_PURCHASED:  20,
  PLACE_VERIFIED:   15,
  PLACE_LIKED:       2,
}

/** Minimum comment length to qualify for points (anti-spam) */
export const MIN_COMMENT_LENGTH_FOR_POINTS = 20

// ── Badges ────────────────────────────────────────────────────────────────────

export type BadgeId =
  // Cartography — places contributed
  | 'FIRST_PLACE'        // Added first place
  | 'TEN_PLACES'         // Added 10 places
  | 'FIFTY_PLACES'       // Added 50 places
  // Photography
  | 'FIRST_PHOTO'        // Added first photo batch
  | 'PHOTO_COLLECTION'   // Added photos to 20 different places
  // Community — comments & reviews
  | 'FIRST_COMMENT'      // Wrote first comment
  | 'ACTIVE_REVIEWER'    // Wrote 10 quality comments
  // Navigation — routes
  | 'FIRST_ROUTE'        // Created first route
  | 'ROUTE_MASTER'       // Created 5 routes
  | 'FIRST_ROUTE_SOLD'   // First route purchased by another user
  // Reputation
  | 'PLACE_VERIFIED'     // Had a place approved by admin
  | 'TOP_CONTRIBUTOR'    // Reached level 4 — Sea Guide
  | 'MASTER_NAVIGATOR'   // Reached level 5 — Master Navigator
  // Milestones — total points
  | 'CENTURY_POINTS'     // Earned 100 points total
  | 'RISING_STAR'        // Earned 250 points total

export type BadgeCategory = 'CARTOGRAPHY' | 'PHOTOGRAPHY' | 'COMMUNITY' | 'NAVIGATION' | 'REPUTATION' | 'MILESTONES'

export interface BadgeConfig {
  id: BadgeId
  category: BadgeCategory
  title: string
  description: string
  icon: string          // Ionicons name
  color: string
}

export const BADGE_CONFIGS: Record<BadgeId, BadgeConfig> = {
  // Cartography
  FIRST_PLACE:      { id: 'FIRST_PLACE',      category: 'CARTOGRAPHY',  title: 'Cartographer',      description: 'Added your first place to the map',              icon: 'location',          color: '#22C55E' },
  TEN_PLACES:       { id: 'TEN_PLACES',        category: 'CARTOGRAPHY',  title: 'Harbour Master',    description: 'Added 10 places to the map',                     icon: 'anchor',            color: '#1B6CA8' },
  FIFTY_PLACES:     { id: 'FIFTY_PLACES',      category: 'CARTOGRAPHY',  title: 'Chart Maker',       description: 'Added 50 places to the map',                     icon: 'map',               color: '#8B5CF6' },
  // Photography
  FIRST_PHOTO:      { id: 'FIRST_PHOTO',       category: 'PHOTOGRAPHY',  title: 'Eye of the Sea',    description: 'Added your first photo to a place',              icon: 'camera',            color: '#EC4899' },
  PHOTO_COLLECTION: { id: 'PHOTO_COLLECTION',  category: 'PHOTOGRAPHY',  title: 'Visual Journalist', description: 'Added photos to 20 different places',            icon: 'images',            color: '#F97316' },
  // Community
  FIRST_COMMENT:    { id: 'FIRST_COMMENT',     category: 'COMMUNITY',    title: 'Voice of the Sea',  description: 'Wrote your first place review',                  icon: 'chatbubble',        color: '#06B6D4' },
  ACTIVE_REVIEWER:  { id: 'ACTIVE_REVIEWER',   category: 'COMMUNITY',    title: 'Trusted Reviewer',  description: 'Wrote 10 quality reviews',                       icon: 'star',              color: '#F59E0B' },
  // Navigation
  FIRST_ROUTE:      { id: 'FIRST_ROUTE',       category: 'NAVIGATION',   title: 'Route Planner',     description: 'Created your first sailing route',               icon: 'git-branch',        color: '#10B981' },
  ROUTE_MASTER:     { id: 'ROUTE_MASTER',      category: 'NAVIGATION',   title: 'Route Master',      description: 'Created 5 sailing routes',                       icon: 'navigate',          color: '#1B6CA8' },
  FIRST_ROUTE_SOLD: { id: 'FIRST_ROUTE_SOLD',  category: 'NAVIGATION',   title: 'Sea Merchant',      description: 'Your route was purchased by another sailor',     icon: 'cash',              color: '#059669' },
  // Reputation
  PLACE_VERIFIED:   { id: 'PLACE_VERIFIED',    category: 'REPUTATION',   title: 'Trusted Scout',     description: 'A place you added was verified by the community', icon: 'shield-checkmark', color: '#6366F1' },
  TOP_CONTRIBUTOR:  { id: 'TOP_CONTRIBUTOR',   category: 'REPUTATION',   title: 'Sea Guide',         description: 'Reached Sea Guide level (400+ points)',          icon: 'shield',            color: '#8B5CF6' },
  MASTER_NAVIGATOR: { id: 'MASTER_NAVIGATOR',  category: 'REPUTATION',   title: 'Master Navigator',  description: 'Reached the highest contributor level',          icon: 'trophy',            color: '#F59E0B' },
  // Milestones
  CENTURY_POINTS:   { id: 'CENTURY_POINTS',    category: 'MILESTONES',   title: 'Century Sailor',    description: 'Earned your first 100 contribution points',      icon: 'medal',             color: '#84CC16' },
  RISING_STAR:      { id: 'RISING_STAR',       category: 'MILESTONES',   title: 'Rising Star',       description: 'Accumulated 250 contribution points',            icon: 'star-half',         color: '#EAB308' },
}

/** All badge IDs grouped by category — drives the UI grid ordering */
export const BADGE_CATEGORY_ORDER: BadgeCategory[] = [
  'CARTOGRAPHY', 'PHOTOGRAPHY', 'COMMUNITY', 'NAVIGATION', 'REPUTATION', 'MILESTONES',
]

// ── Levels ────────────────────────────────────────────────────────────────────

export interface ContributorLevel {
  level: number
  name: string
  minPoints: number
  maxPoints: number
  icon: string        // Ionicons name
  color: string
}

export const LEVELS: ContributorLevel[] = [
  { level: 1, name: 'Explorer',         minPoints: 0,   maxPoints: 49,       icon: 'compass-outline',  color: '#94A3B8' },
  { level: 2, name: 'Navigator',        minPoints: 50,  maxPoints: 149,      icon: 'navigate-outline', color: '#22C55E' },
  { level: 3, name: 'Captain',          minPoints: 150, maxPoints: 399,      icon: 'ribbon-outline',   color: '#1B6CA8' },
  { level: 4, name: 'Sea Guide',        minPoints: 400, maxPoints: 799,      icon: 'shield-outline',   color: '#8B5CF6' },
  { level: 5, name: 'Master Navigator', minPoints: 800, maxPoints: Infinity, icon: 'trophy-outline',   color: '#F59E0B' },
]

export function getLevelForPoints(points: number): ContributorLevel {
  return [...LEVELS].reverse().find((l) => points >= l.minPoints) ?? LEVELS[0]
}

// ── Point events ──────────────────────────────────────────────────────────────

export interface PointEvent {
  id: string
  actionType: ActionType
  pointsAwarded: number
  /** ID of the place/comment/route this award is tied to — used for deduplication and revocation */
  referenceId?: string
  createdAt: string
}

export interface EarnedBadge {
  badgeId: BadgeId
  earnedAt: string
}

// ── Reward celebrations ───────────────────────────────────────────────────────

export type RewardType = 'LEVEL_UP' | 'BADGE_UNLOCK'

export interface RewardItem {
  id: string
  type: RewardType
  /** Populated when type === 'LEVEL_UP' */
  level?: ContributorLevel
  /** Populated when type === 'BADGE_UNLOCK' */
  badge?: BadgeConfig
  createdAt: string
}
