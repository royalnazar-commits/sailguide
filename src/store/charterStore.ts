/**
 * charterStore — Zustand store for yacht charter functionality.
 *
 * Replaces the synchronous mock functions from mockCharters.ts with
 * async state backed by the Booking Manager API. All screens use this
 * store directly; the BM API layer is completely hidden here.
 *
 * Fallback: if the BM API token is not configured (EXPO_PUBLIC_BM_API_TOKEN
 * is empty), the store falls back to the mock data so development works
 * without a live API key.
 */

import { create } from 'zustand'
import {
  Yacht, CharterSearchParams, CharterFilters,
  DEFAULT_FILTERS, BookingDraft, BoatType,
} from '../types/charter'
import {
  BmOffersParams,
} from '../types/bookingManager'
import {
  bmYachtsApi,
  bmOffersApi,
  bmAvailabilityApi,
  bmReservationsApi,
  GetYachtsParams,
} from '../services/bookingManagerApi'
import {
  bmYachtToYacht,
  bmOfferToYacht,
  mergeYachtDetail,
  bookingDraftToReservationRequest,
  bmReservationToLocalSummary,
  LocalBookingSummary,
} from '../services/charterAdapter'
import {
  MOCK_YACHTS, FEATURED_DESTINATIONS, searchYachts as mockSearch,
  type Destination,
} from '../services/mockCharters'

const HAS_BM_TOKEN = !!(process.env.EXPO_PUBLIC_BM_API_TOKEN ?? '').trim()

// ── State shape ───────────────────────────────────────────────────────────────

interface CharterState {
  // Fleet
  yachts:          Yacht[]
  yachtsLoading:   boolean
  yachtsError:     string | null

  // Single yacht detail (keyed by id)
  yachtDetail:     Record<string, Yacht>
  detailLoading:   Record<string, boolean>

  // Availability (keyed by yachtId)
  bookedWeeks:     Record<string, string[]>

  // Search & filter
  searchParams:    Partial<CharterSearchParams>
  filters:         CharterFilters
  activeType:      BoatType | 'ALL'

  // Booking
  currentBooking:  LocalBookingSummary | null
  bookingLoading:  boolean
  bookingError:    string | null

  // Reference
  destinations:    Destination[]

  // Actions
  loadYachts:      (params?: GetYachtsParams) => Promise<void>
  searchOffers:    (params: BmOffersParams) => Promise<void>
  loadYachtDetail: (id: string) => Promise<void>
  loadAvailability:(yachtId: string, year: number) => Promise<void>
  setSearchParams: (params: Partial<CharterSearchParams>) => void
  setFilters:      (filters: Partial<CharterFilters> | CharterFilters) => void
  setActiveType:   (type: BoatType | 'ALL') => void

  createReservation:(draft: BookingDraft) => Promise<LocalBookingSummary>
  cancelReservation:(reservationId: number) => Promise<void>
  clearBooking:     () => void

  // Derived helpers
  getYachtById:     (id: string) => Yacht | undefined
  getFilteredYachts:(searchText?: string) => Yacht[]
  getSuggestedYachts:(country?: string, limit?: number) => Yacht[]
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCharterStore = create<CharterState>((set, get) => ({
  yachts:         [],
  yachtsLoading:  false,
  yachtsError:    null,

  yachtDetail:    {},
  detailLoading:  {},

  bookedWeeks:    {},

  searchParams:   {},
  filters:        DEFAULT_FILTERS,
  activeType:     'ALL',

  currentBooking: null,
  bookingLoading: false,
  bookingError:   null,

  destinations: FEATURED_DESTINATIONS,

  // ── Fleet loading ──────────────────────────────────────────────────────────

  loadYachts: async (params) => {
    set({ yachtsLoading: true, yachtsError: null })

    if (!HAS_BM_TOKEN) {
      // Dev fallback: return mock data immediately
      set({ yachts: MOCK_YACHTS, yachtsLoading: false })
      return
    }

    try {
      const bmYachts = await bmYachtsApi.list(params)
      const yachts   = bmYachts.map(bmYachtToYacht)
      set({ yachts, yachtsLoading: false })
    } catch (err: any) {
      set({
        yachtsError:   err.message ?? 'Failed to load yachts',
        yachtsLoading: false,
        // Keep mock data visible on error so the screen isn't blank
        yachts:        MOCK_YACHTS,
      })
    }
  },

  // ── Offer search (replaces getYachts for availability-aware listing) ────────

  searchOffers: async (params) => {
    set({ yachtsLoading: true, yachtsError: null })

    if (!HAS_BM_TOKEN) {
      set({ yachts: MOCK_YACHTS, yachtsLoading: false })
      return
    }

    try {
      const offers = await bmOffersApi.search(params)
      const yachts = offers.map(bmOfferToYacht)
      set({ yachts, yachtsLoading: false })
    } catch (err: any) {
      set({
        yachtsError:   err.message ?? 'Failed to search offers',
        yachtsLoading: false,
        yachts:        MOCK_YACHTS,
      })
    }
  },

  // ── Single yacht detail ────────────────────────────────────────────────────

  loadYachtDetail: async (id) => {
    // Already cached
    if (get().yachtDetail[id]) return

    set((s) => ({ detailLoading: { ...s.detailLoading, [id]: true } }))

    if (!HAS_BM_TOKEN) {
      const mock = MOCK_YACHTS.find((y) => y.id === id)
      if (mock) {
        set((s) => ({
          yachtDetail:  { ...s.yachtDetail, [id]: mock },
          detailLoading: { ...s.detailLoading, [id]: false },
        }))
      }
      return
    }

    try {
      const bmDetail = await bmYachtsApi.get(Number(id))
      // Merge with any existing fleet entry so pricing is preserved
      const existing = get().yachts.find((y) => y.id === id)
      const yacht    = existing
        ? mergeYachtDetail(existing, bmDetail)
        : bmYachtToYacht(bmDetail)

      set((s) => ({
        yachtDetail:  { ...s.yachtDetail, [id]: yacht },
        detailLoading: { ...s.detailLoading, [id]: false },
      }))
    } catch {
      // Fallback: use whatever is already in the fleet list
      const fallback = get().yachts.find((y) => y.id === id)
      if (fallback) {
        set((s) => ({
          yachtDetail:  { ...s.yachtDetail, [id]: fallback },
          detailLoading: { ...s.detailLoading, [id]: false },
        }))
      } else {
        set((s) => ({ detailLoading: { ...s.detailLoading, [id]: false } }))
      }
    }
  },

  // ── Availability ───────────────────────────────────────────────────────────

  loadAvailability: async (yachtId, year) => {
    if (!HAS_BM_TOKEN) {
      // Mock: already embedded in MOCK_YACHTS.bookedWeeks
      const mock = MOCK_YACHTS.find((y) => y.id === yachtId)
      if (mock) {
        set((s) => ({
          bookedWeeks: { ...s.bookedWeeks, [yachtId]: mock.bookedWeeks },
        }))
      }
      return
    }

    try {
      const weeks = await bmAvailabilityApi.getBookedWeeks(Number(yachtId), year)
      set((s) => ({
        bookedWeeks: { ...s.bookedWeeks, [yachtId]: weeks },
      }))
    } catch {
      // Non-fatal — calendar just shows all dates as available
    }
  },

  // ── Booking ────────────────────────────────────────────────────────────────

  createReservation: async (draft) => {
    set({ bookingLoading: true, bookingError: null })

    if (!HAS_BM_TOKEN) {
      // Simulate a successful booking in mock mode
      const fakeSummary: LocalBookingSummary = {
        reservationId:   Math.floor(Math.random() * 1_000_000),
        reservationCode: `SG-MOCK-${Date.now()}`,
        status:          'option',
        yachtId:         draft.yachtId,
        dateFrom:        draft.startDate!,
        dateTo:          draft.endDate!,
        currency:        'EUR',
        totalPrice:      0,
        deposit:         0,
        expiresAt:       new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      }
      set({ currentBooking: fakeSummary, bookingLoading: false })
      return fakeSummary
    }

    try {
      const body   = bookingDraftToReservationRequest(draft)
      const result = await bmReservationsApi.create(body)
      const summary = bmReservationToLocalSummary(result)
      set({ currentBooking: summary, bookingLoading: false })
      return summary
    } catch (err: any) {
      const msg = err.message ?? 'Booking failed. Please try again.'
      set({ bookingError: msg, bookingLoading: false })
      throw err
    }
  },

  cancelReservation: async (reservationId) => {
    if (!HAS_BM_TOKEN) return
    try {
      await bmReservationsApi.cancel(reservationId)
      set((s) => {
        if (s.currentBooking?.reservationId === reservationId) {
          return { currentBooking: null }
        }
        return {}
      })
    } catch {
      // Swallow — UI can retry or ignore
    }
  },

  clearBooking: () => set({ currentBooking: null, bookingError: null }),

  // ── Search & filter state ──────────────────────────────────────────────────

  setSearchParams: (params) =>
    set((s) => ({ searchParams: { ...s.searchParams, ...params } })),

  setFilters: (updates) =>
    set((s) => ({ filters: { ...s.filters, ...updates } })),

  setActiveType: (type) => set({ activeType: type }),

  // ── Derived helpers ────────────────────────────────────────────────────────

  getYachtById: (id) => {
    return get().yachtDetail[id] ?? get().yachts.find((y) => y.id === id)
  },

  getFilteredYachts: (searchText = '') => {
    const { yachts, activeType, filters } = get()

    if (!HAS_BM_TOKEN) {
      // Use the mock search function which has the same filtering logic
      return mockSearch(
        { destination: searchText },
        { boatType: activeType, minCabins: filters.minCabins, maxPrice: filters.maxPricePerWeek },
      ).filter(
        (y) =>
          (filters.minYear <= 0     || y.yearBuilt  >= filters.minYear) &&
          (filters.minRating <= 0   || y.rating     >= filters.minRating) &&
          (filters.minLengthM <= 0  || y.lengthM    >= filters.minLengthM),
      )
    }

    let results = [...yachts]

    if (searchText) {
      const q = searchText.toLowerCase()
      results = results.filter(
        (y) =>
          y.country.toLowerCase().includes(q) ||
          y.region.toLowerCase().includes(q) ||
          y.city.toLowerCase().includes(q) ||
          y.marina.toLowerCase().includes(q) ||
          y.name.toLowerCase().includes(q),
      )
    }
    if (activeType !== 'ALL') {
      results = results.filter((y) => y.type === activeType)
    }
    if (filters.minCabins > 0) {
      results = results.filter((y) => y.cabins >= filters.minCabins)
    }
    if (filters.maxPricePerWeek < 20000) {
      results = results.filter((y) => y.pricePerWeekEur <= filters.maxPricePerWeek)
    }
    if (filters.minYear > 2010) {
      results = results.filter((y) => y.yearBuilt >= filters.minYear)
    }
    if (filters.minRating > 0) {
      results = results.filter((y) => y.rating >= filters.minRating)
    }
    if (filters.minLengthM > 0) {
      results = results.filter((y) => y.lengthM >= filters.minLengthM)
    }

    return results
  },

  getSuggestedYachts: (country, limit = 4) => {
    const yachts = get().yachts.length > 0 ? get().yachts : MOCK_YACHTS
    if (country) {
      const matches = yachts
        .filter((y) => y.country.toLowerCase() === country.toLowerCase())
        .sort((a, b) => b.rating - a.rating)
      if (matches.length > 0) return matches.slice(0, limit)
    }
    return [...yachts].sort((a, b) => b.rating - a.rating).slice(0, limit)
  },
}))

// Export the Destination type so consumers don't need to import from mockCharters
export type { Destination }
