import { CanonicalPlaceType } from '../constants/placeTypes'

/**
 * PlaceType is derived from the central place type registry.
 * Add new types in src/constants/placeTypes.ts — not here.
 */
export type PlaceType = CanonicalPlaceType

/**
 * Lifecycle status for a place.
 * DRAFT        – saved locally, not yet submitted
 * PUBLISHED    – visible to all users
 * UNDER_REVIEW – submitted for staff review
 * REJECTED     – failed moderation
 *
 * Seed / staff places have no status field (treated as PUBLISHED).
 */
export type PlaceStatus = 'DRAFT' | 'PUBLISHED' | 'UNDER_REVIEW' | 'REJECTED'

/**
 * One entry in a place's edit history.
 * Written on every edit or reposition — enables admin audit trail.
 */
export interface PlaceEditRecord {
  changedAt: string
  /** userId of whoever made the change */
  changedBy: string
  /** Top-level Place fields that were modified */
  fields: string[]
}

/**
 * A discoverable sailing place shown on the Explore map.
 *
 * Moderation / admin fields are present on all user-contributed places from
 * the moment they are created, so the future admin panel can surface them
 * without any schema migration.
 */
export interface Place {
  id: string
  name: string
  type: PlaceType
  lat: number
  lng: number
  /** Short description shown in popup and detail screen */
  description: string
  country: string
  region: string
  photos: string[]
  tips?: string[]
  tags?: string[]
  /** True = staff-verified. User-created places start as false. */
  isVerified: boolean
  rating?: number

  // ── User-contribution fields ─────────────────────────────────────────────
  /** True for any marker created by an app user (not seed data) */
  isUserCreated?: boolean
  /** userId of the creator — authority for permission checks */
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  /** Private notes — visible only to the creator */
  notes?: string

  // ── Captain monetization fields ──────────────────────────────────────────
  /** True when the creator (captain) has set this place as paid */
  isPremium?: boolean
  /** Price in USD. Only meaningful when isPremium is true. */
  priceUsd?: number

  // ── Structured POI info fields ───────────────────────────────────────────
  contact?: {
    phone?: string
    vhf?: number
  }
  mooring?: {
    /** e.g. 'stern-to', 'bow-to', 'alongside' */
    type?: string
    depth?: string
    holding?: string
  }
  facilities?: {
    fuel?: string
    water?: string
    electricity?: string
    toilets?: string
    showers?: string
    laundry?: string
  }
  town?: {
    restaurants?: string
    bars?: string
    supermarket?: string
    bakery?: string
    atm?: string
  }
  anchorageInfo?: {
    depth?: string
    bottom?: string
    holding?: string
    shelter?: string
  }
  highlights?: string[]
  bestFor?: string[]
  /** Public notes — visible to all users (distinct from private `notes`) */
  publicNotes?: string
  headsUp?: string

  // ── Moderation / admin fields ────────────────────────────────────────────
  /** Publish/moderation status — undefined treated as published (seed data) */
  status?: PlaceStatus
  /**
   * Admin who approved or rejected this submission.
   * Set when status transitions away from UNDER_REVIEW.
   */
  reviewedByAdminId?: string
  reviewedAt?: string
  /**
   * Chronological log of all edits and repositions.
   * Used by the admin audit trail.
   */
  editHistory?: PlaceEditRecord[]
}
