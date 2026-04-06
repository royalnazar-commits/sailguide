/**
 * Booking Manager API v2.2.1 — TypeScript types.
 *
 * Base URL: https://www.booking-manager.com/api/v2
 * Auth:     Authorization: Bearer <token>
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

/** Product type filter (BM API `product` param) */
export type BmProduct = 'charter' | 'racing' | 'cruise'

/** Vessel kind codes (BM API `kind[]` param) */
export type BmKind =
  | 'sailboat'
  | 'catamaran'
  | 'motor_yacht'
  | 'motor_catamaran'
  | 'gulet'
  | 'powerboat'
  | 'cabin_cruiser'
  | 'catamaran_power'
  | 'rigid_inflatable'
  | 'other'

/**
 * Availability search date flexibility.
 * 1 = exact dates, 2 = ±3 days, 3 = ±7 days, 4 = within month,
 * 5 = within 2 months, 6 = within 3 months, 7 = within year.
 */
export type BmFlexibility = 1 | 2 | 3 | 4 | 5 | 6 | 7

/**
 * Short-availability status codes (one char per week slot).
 * '0' = Available, '1' = Reservation, '2' = Option,
 * '3' = Option expiring, '4' = Service, 'B' = Sleepboard.
 */
export type BmAvailabilityStatus = '0' | '1' | '2' | '3' | '4' | 'B'

// ── Reference data ────────────────────────────────────────────────────────────

export interface BmSailingArea {
  id: number
  name: string
  country?: string
}

export interface BmCountry {
  id: number
  name: string
  code: string
}

export interface BmBase {
  id: number
  name: string
  city?: string
  country?: string
  lat?: number
  lng?: number
  sailingAreaId?: number
}

export interface BmCompany {
  id: number
  name: string
  country?: string
}

// ── Yacht ─────────────────────────────────────────────────────────────────────

export interface BmYacht {
  id: number
  name: string
  /** Human-readable model / class name */
  model?: string
  kind: BmKind
  /** Length overall in metres */
  loa?: number
  beam?: number
  draft?: number
  cabins?: number
  berths?: number
  toilets?: number
  yearBuilt?: number
  engineHp?: number
  fuelTankL?: number
  waterTankL?: number

  baseId?: number
  baseName?: string
  city?: string
  country?: string
  sailingAreaId?: number
  sailingAreaName?: string
  lat?: number
  lng?: number

  /** Primary photo URL */
  mainPhotoUrl?: string
  photoUrls?: string[]
  description?: string

  companyId?: number
  companyName?: string

  /** Whether boat is premium-only listing */
  isPremium?: boolean
}

// ── Offers / Availability search ──────────────────────────────────────────────

export interface BmOffer {
  yachtId: number
  yachtName?: string
  kind?: BmKind
  model?: string
  loa?: number
  cabins?: number
  berths?: number
  yearBuilt?: number

  baseFromId?: number
  baseFromName?: string
  baseToId?: number
  baseToName?: string
  country?: string

  dateFrom: string   // ISO date
  dateTo: string     // ISO date
  duration: number   // days

  currency: string
  basePrice: number
  clientPrice: number
  discountPct?: number

  mainPhotoUrl?: string

  /** Skipper required, optional, or not available */
  skipperOption?: 'required' | 'optional' | 'not_available'
  skipperPricePerDay?: number
}

export interface BmOffersParams {
  dateFrom: string        // required, ISO date
  dateTo: string          // required, ISO date
  flexibility?: BmFlexibility
  companyId?: number[]
  country?: string[]
  product?: BmProduct
  baseFromId?: number[]
  baseToId?: number[]
  sailingAreaId?: number[]
  yachtId?: number[]
  currency?: string
  tripDuration?: number[]
  minCabins?: number
  maxCabins?: number
  minBerths?: number
  maxBerths?: number
  minLength?: number
  maxLength?: number
  passengersOnBoard?: number
  kind?: BmKind[]
  minYearOfBuild?: number
  maxYearOfBuild?: number
  adults?: number
  children?: number
}

// ── Short availability ─────────────────────────────────────────────────────────

/**
 * Map of ISO date strings (Saturdays) → availability status char.
 * '0' = free, anything else = blocked.
 */
export type BmShortAvailability = Record<string, BmAvailabilityStatus>

// ── Reservations ──────────────────────────────────────────────────────────────

export interface BmReservationRequest {
  dateFrom: string
  dateTo: string
  yachtId: number
  baseFromId?: number
  baseToId?: number
  /** Full name of the main guest */
  clientName?: string
  passengersOnBoard?: number
  currency?: string
  promoCode?: string
}

export interface BmPaymentPlanItem {
  dueDate: string
  amount: number
  isPaid: boolean
  description?: string
}

export interface BmReservationResponse {
  id: number
  reservationCode: string
  status: BmReservationStatus
  expirationDate?: string   // ISO datetime — when option expires
  yachtId: number
  yachtName?: string
  dateFrom: string
  dateTo: string
  currency: string
  basePrice: number
  finalPrice: number
  /** Price visible to client (after markup if any) */
  clientPrice: number
  securityDeposit?: number
  paymentPlan?: BmPaymentPlanItem[]
  termsOfPayment?: string
}

export type BmReservationStatus = 'option' | 'confirmed' | 'cancelled' | 'expired'

export interface BmReservation extends BmReservationResponse {
  baseFromId?: number
  baseFromName?: string
  baseToId?: number
  baseToName?: string
  clientName?: string
  passengersOnBoard?: number
  notes?: string
  extras?: BmReservationExtra[]
}

export interface BmReservationExtra {
  id: number
  name: string
  pricePerWeek?: number
  mandatory?: boolean
  selected?: boolean
}

// ── Payments ──────────────────────────────────────────────────────────────────

export interface BmPaymentRequest {
  amount: number
  currency: string
  description?: string
}

export interface BmPaymentResponse {
  id: number
  reservationId: number
  amount: number
  currency: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}

// ── API response wrappers ──────────────────────────────────────────────────────

export interface BmPaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface BmError {
  code: string
  message: string
  details?: unknown
}
