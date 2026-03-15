/**
 * User-created route — distinct from the commercial Route type.
 *
 * Stage 10: PUBLISHED routes appear in the community catalog.
 * Seed routes are pre-built community examples (createdBy set to author name).
 */

export type UserRouteStatus = 'DRAFT' | 'PUBLISHED'

export interface UserRouteStop {
  id: string
  /** References a Place id (seed or user-created). 'custom-*' for map-tap waypoints. */
  placeId: string
  /** 1-indexed, re-computed whenever stops are reordered */
  sequence: number
  /** Private skipper note for this specific stop */
  notes?: string
  estimatedStayDays?: number
  /** Inline coordinates for custom map-tap waypoints (placeId starts with 'custom-') */
  lat?: number
  lng?: number
  /** Display name for custom waypoints */
  name?: string
  /**
   * Stop type badge — MARINA, ANCHORAGE, BAY, BEACH, CAVE, LAGOON, FUEL, CUSTOM.
   * Defaults to CUSTOM when not set.
   */
  type?: string
}

export interface UserRoute {
  id: string
  title: string
  description?: string
  stops: UserRouteStop[]
  /** Nautical miles — computed in the store, never trusted from API */
  totalNm: number
  estimatedDays?: number
  /** Auto-filled from first stop's region */
  region?: string
  /** Auto-filled from first stop's country */
  country?: string
  tags: string[]
  status: UserRouteStatus
  /** userId or display name for seed routes */
  createdBy?: string
  /** Human-readable creator name for catalog display */
  createdByName?: string
  /** ISO timestamp when first published */
  publishedAt?: string
  createdAt: string
  updatedAt: string

  // ── Captain monetization fields ──────────────────────────────────────────
  /** True when the captain has set this route as a paid item */
  isPremium?: boolean
  /** Price in USD (0 = free). Only meaningful when isPremium is true. */
  priceUsd?: number
  /** userId of the captain who owns this route (for access checks) */
  captainId?: string
}
