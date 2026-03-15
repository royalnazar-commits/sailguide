import { create } from 'zustand'
import { Comment } from '../types/comment'
import { safeStorage } from '../utils/storage'
import { useContributorStore } from './contributorStore'

const STORAGE_KEY = 'placeComments_v1'

// ── Seed comments ──────────────────────────────────────────────────────────
// Pre-populated so the community map feels alive on first launch.
// In production these would come from an API.

const SEED_COMMENTS: Comment[] = [
  // Hydra Town Harbour
  { id: 'c-1', placeId: 'hydra-marina', authorName: 'Captain Lars', isLocal: false, rating: 5, authorLevel: 4,
    text: 'Arrived late afternoon — the harbour was busy but we found space on the town quay. Helpful harbourmaster. The bakery opens at 06:30, worth setting an early alarm.',
    createdAt: '2026-03-10T09:00:00Z' },
  { id: 'c-2', placeId: 'hydra-marina', authorName: 'Elena K.', isLocal: false, rating: 5, authorLevel: 2,
    text: 'Wonderful stop. No cars makes it feel timeless. Stern-to on the town quay. Very shallow near the wall — take care with draft over 2m.',
    createdAt: '2026-02-28T14:30:00Z' },
  { id: 'c-3', placeId: 'hydra-marina', authorName: 'Sailing Nomad', isLocal: false, rating: 4, authorLevel: 2,
    text: 'Can get rolly in the afternoon when ferries come through. The donkeys carrying your shopping are charming — genuinely.',
    createdAt: '2026-02-14T11:00:00Z' },

  // Santorini Caldera
  { id: 'c-4', placeId: 'santorini-caldera', authorName: 'MariaVela', isLocal: false, rating: 5, authorLevel: 5,
    text: 'One of the most dramatic arrivals I\'ve ever made. The caldera walls rise 300m above you. Anchor in Ammoudi Bay for the sunset view.',
    createdAt: '2026-03-12T18:00:00Z' },
  { id: 'c-5', placeId: 'santorini-caldera', authorName: 'JohnSails', isLocal: false, rating: 4, authorLevel: 3,
    text: 'Holding is patchy — we dragged twice before setting properly. Use lots of scope and dive to check. Absolutely worth it for the views.',
    createdAt: '2026-03-01T10:00:00Z' },
  { id: 'c-6', placeId: 'santorini-caldera', authorName: 'Oia Dreamer', isLocal: false, rating: 5, authorLevel: 2,
    text: 'Tender up to Ammoudi for the famous grilled octopus. The path up the cliff at sunset is steep but the view over the anchorage is extraordinary.',
    createdAt: '2026-01-20T16:00:00Z' },

  // Navagio Shipwreck Beach
  { id: 'c-7', placeId: 'navagio-beach', authorName: 'Adria Skipper', isLocal: false, rating: 5, authorLevel: 4,
    text: 'Arrived at 08:00 — just us and one other boat. By 10:30 the tour boats arrived in force. Get there early, it\'s completely worth it.',
    createdAt: '2026-03-08T08:00:00Z' },
  { id: 'c-8', placeId: 'navagio-beach', authorName: 'Coastal Drifter', isLocal: false, rating: 4, authorLevel: 3,
    text: 'Swell can build fast when the Northerly picks up. Keep a watch and be ready to leave. The beach and wreck are absolutely stunning.',
    createdAt: '2026-02-22T09:30:00Z' },

  // Hvar Town Marina
  { id: 'c-9', placeId: 'hvar-marina', authorName: 'Mirko C.', isLocal: false, rating: 3, authorLevel: 3,
    text: 'Expensive but perfectly placed on the main square. Showers are clean. Nightlife is very close — can be noisy until 3am in peak season!',
    createdAt: '2026-03-11T20:00:00Z' },
  { id: 'c-10', placeId: 'hvar-marina', authorName: 'Adriatic Dream', isLocal: false, rating: 5, authorLevel: 4,
    text: 'Great base for day sails to Vis and Korčula. Book 2+ days ahead in summer. The lavender fields behind town are beautiful in June.',
    createdAt: '2026-03-05T12:00:00Z' },

  // Ölüdeniz Lagoon
  { id: 'c-11', placeId: 'oludeniz-bay', authorName: 'TurkeyVoyager', isLocal: false, rating: 5, authorLevel: 2,
    text: 'The colours are unreal — every shade of turquoise imaginable. The lagoon entrance is shallow so stay in the outer bay. Paragliders landing on the beach all day.',
    createdAt: '2026-03-09T15:00:00Z' },
  { id: 'c-12', placeId: 'oludeniz-bay', authorName: 'Blue Voyage', isLocal: false, rating: 5, authorLevel: 5,
    text: 'Best anchorage on the entire Turquoise Coast. Calm water, 5m sand holding. Walk to the village for excellent fresh fish dinner.',
    createdAt: '2026-02-18T19:00:00Z' },

  // Portofino Harbour
  { id: 'c-13', placeId: 'portofino-marina', authorName: 'Riviera Sailor', isLocal: false, rating: 4, authorLevel: 3,
    text: 'Outrageously expensive — €180/night for a 42ft. But a once in a lifetime experience. The outer anchorage is free and equally scenic.',
    createdAt: '2026-03-07T17:00:00Z' },

  // Göcek Marina
  { id: 'c-14', placeId: 'gocek-marina', authorName: 'Aegean Anna', isLocal: false, rating: 4, authorLevel: 4,
    text: 'Well-stocked chandlery, great provisioning, friendly staff. Excellent jumping-off point for the 12 Islands. Gulet tours everywhere but the anchorages are huge.',
    createdAt: '2026-03-04T11:00:00Z' },

  // Ses Illetes, Formentera
  { id: 'c-15', placeId: 'formentera-anchorage', authorName: 'Balearic Bob', isLocal: false, rating: 5, authorLevel: 3,
    text: 'Most beautiful anchorage in the Balearics. In July it looks like a marina — hundreds of boats. Come in May or September for the real experience.',
    createdAt: '2026-03-06T14:00:00Z' },
]

// ── Store ──────────────────────────────────────────────────────────────────

interface CommentsState {
  /** All comments: seed + user-written */
  comments: Comment[]

  // Reads
  getCommentsForPlace: (placeId: string) => Comment[]
  getAvgRatingForPlace: (placeId: string) => { avg: number; count: number } | null

  // Writes
  addComment: (placeId: string, authorName: string, text: string, authorId?: string, rating?: number) => Comment
  deleteComment: (commentId: string) => void

  // Persistence (user-written comments only; seed comments are always in-memory)
  loadComments: () => Promise<void>
  saveComments: () => Promise<void>
}

export const useCommentsStore = create<CommentsState>((set, get) => ({
  comments: SEED_COMMENTS,

  getCommentsForPlace: (placeId) =>
    get().comments
      .filter((c) => c.placeId === placeId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  getAvgRatingForPlace: (placeId) => {
    const rated = get().comments.filter((c) => c.placeId === placeId && c.rating != null)
    if (rated.length === 0) return null
    const avg = rated.reduce((sum, c) => sum + c.rating!, 0) / rated.length
    return { avg: Math.round(avg * 10) / 10, count: rated.length }
  },

  addComment: (placeId, authorName, text, authorId, rating) => {
    const { currentLevel } = useContributorStore.getState()
    const comment: Comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      placeId,
      authorName: authorName.trim(),
      authorId,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      isLocal: true,
      rating,
      authorLevel: currentLevel.level,
    }
    set((state) => ({ comments: [comment, ...state.comments] }))
    get().saveComments()
    useContributorStore.getState().earnPoints('WRITE_COMMENT', comment.id, text.trim())
    return comment
  },

  deleteComment: (commentId) => {
    set((state) => ({ comments: state.comments.filter((c) => c.id !== commentId) }))
    get().saveComments()
    // Reverse contributor points tied to this comment
    useContributorStore.getState().revokePoints(commentId)
  },

  loadComments: async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY)
      if (raw) {
        const localComments: Comment[] = JSON.parse(raw)
        // Merge: seed comments always present, local comments on top
        const localIds = new Set(localComments.map((c) => c.id))
        const merged = [
          ...localComments,
          ...SEED_COMMENTS.filter((c) => !localIds.has(c.id)),
        ]
        set({ comments: merged })
      }
    } catch {
      // corrupt — keep seeds
    }
  },

  saveComments: async () => {
    try {
      // Persist only user-written (local) comments to avoid bloating storage
      const local = get().comments.filter((c) => c.isLocal !== false)
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify(local))
    } catch {
      // in-memory only
    }
  },
}))
