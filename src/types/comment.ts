/**
 * A comment on a Place.
 *
 * Architecture for future stages:
 *  - authorId / authorRole  → verified captain comments, moderation
 *  - rating                 → per-comment star rating → feeds into place avgRating
 *  - likes                  → community voting
 *  - isLocal                → false = synced from server, true = written on device
 *  - parentId               → threaded replies
 *  - status                 → moderation (PENDING / APPROVED / REJECTED)
 */
export interface Comment {
  id: string
  placeId: string
  authorName: string
  /** Future: ties comment to a registered user */
  authorId?: string
  text: string
  createdAt: string
  /** Future: 1–5 star rating attached to comment */
  rating?: number
  /** Contributor level (1–5) of the author at time of posting */
  authorLevel?: number
  /** true = stored locally only, not yet synced */
  isLocal?: boolean
}
