/**
 * A time-limited community conditions report for a Place.
 *
 * Reports expire automatically (default 48 h) so the feed stays current.
 * Architecture for future stages:
 *  - authorId / verified captain badge  → trusted reports surfaced first
 *  - likes / confirmations              → crowd-sourced signal strength
 *  - photos                             → attach images (e.g. wave height)
 *  - push notification trigger          → alert sailors nearby on WARNING
 */

export type ConditionCategory =
  | 'WIND'
  | 'SWELL'
  | 'CROWDING'
  | 'HAZARD'
  | 'VISIBILITY'
  | 'GENERAL'

export type ConditionSeverity = 'INFO' | 'CAUTION' | 'WARNING'

export interface ConditionReport {
  id: string
  placeId: string
  authorName: string
  authorId?: string
  category: ConditionCategory
  severity: ConditionSeverity
  text: string
  createdAt: string
  /** ISO string — report is hidden after this point */
  expiresAt: string
  isLocal?: boolean
}
