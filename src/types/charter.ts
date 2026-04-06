/**
 * Charter / Yacht-rental domain types.
 *
 * Designed to map 1:1 onto Booking Manager API responses so
 * src/services/mockCharters.ts can be swapped for a real API client
 * without touching any screen or component code.
 */

export type BoatType = 'SAILBOAT' | 'CATAMARAN' | 'MOTOR_YACHT' | 'GULET'
export type SkipperOption = 'required' | 'optional' | 'not_available'

// ── Yacht ─────────────────────────────────────────────────────────────────────

export interface Yacht {
  id: string
  name: string
  model: string
  type: BoatType
  /** Length overall in metres */
  lengthM: number
  cabins: number
  berths: number
  guests: number
  toilets: number
  yearBuilt: number
  engineHp?: number
  fuelTankL?: number
  waterTankL?: number

  // ── Location ────────────────────────────────────────────────────────────────
  marina: string
  city: string
  country: string
  region: string
  lat: number
  lng: number

  // ── Charter company (maps to backend CharterCompany.id) ─────────────────────
  charterCompanyId?: string

  // ── Charter info ────────────────────────────────────────────────────────────
  pricePerWeekEur: number
  depositEur: number
  checkInDay: string   // e.g. "Saturday"
  checkOutDay: string
  skipper: SkipperOption
  skipperCostPerDayEur?: number

  // ── Content ─────────────────────────────────────────────────────────────────
  rating: number
  reviewCount: number
  images: string[]
  description: string
  equipment: string[]
  tags: string[]

  // ── Mock availability ────────────────────────────────────────────────────────
  /** ISO date strings (Saturdays) already booked */
  bookedWeeks: string[]
}

// ── Search + filters ──────────────────────────────────────────────────────────

export interface CharterSearchParams {
  destination: string
  startDate: string | null   // ISO date
  endDate: string | null
  guests: number
}

export interface CharterFilters {
  boatType: BoatType | 'ALL'
  minCabins: number
  maxPricePerWeek: number
  minYear: number
  minRating: number
  minLengthM: number
}

export const DEFAULT_FILTERS: CharterFilters = {
  boatType: 'ALL',
  minCabins: 0,
  maxPricePerWeek: 20000,
  minYear: 2010,
  minRating: 0,
  minLengthM: 0,
}

// ── Booking ───────────────────────────────────────────────────────────────────

export type BookingStep = 'dates' | 'extras' | 'details' | 'confirm'

export interface BookingDraft {
  yachtId: string
  startDate: string | null
  endDate: string | null
  guests: number
  skipperRequired: boolean
  linenPackage: boolean
  firstName: string
  lastName: string
  email: string
  phone: string
  notes: string
}

export const EMPTY_BOOKING: BookingDraft = {
  yachtId: '',
  startDate: null,
  endDate: null,
  guests: 2,
  skipperRequired: false,
  linenPackage: false,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  notes: '',
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const BOAT_TYPE_LABELS: Record<BoatType, string> = {
  SAILBOAT:    'Sailboat',
  CATAMARAN:   'Catamaran',
  MOTOR_YACHT: 'Motor Yacht',
  GULET:       'Gulet',
}

export const BOAT_TYPE_ICONS: Record<BoatType, string> = {
  SAILBOAT:    '⛵',
  CATAMARAN:   '🛥️',
  MOTOR_YACHT: '🚤',
  GULET:       '🛳️',
}
