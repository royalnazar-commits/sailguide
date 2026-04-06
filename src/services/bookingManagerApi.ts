/**
 * Booking Manager API v2.2.1 — HTTP client.
 *
 * Handles authentication, request serialisation, error normalisation,
 * and in-memory caching for reference data (sailing areas, countries, bases).
 */

import axios, { AxiosError, AxiosInstance } from 'axios'
import {
  BmYacht,
  BmOffer,
  BmOffersParams,
  BmShortAvailability,
  BmReservationRequest,
  BmReservationResponse,
  BmReservation,
  BmPaymentRequest,
  BmPaymentResponse,
  BmSailingArea,
  BmCountry,
  BmBase,
  BmCompany,
  BmKind,
  BmProduct,
} from '../types/bookingManager'

// ── Configuration ─────────────────────────────────────────────────────────────

const BM_BASE_URL = 'https://www.booking-manager.com/api/v2'
const BM_API_TOKEN = process.env.EXPO_PUBLIC_BM_API_TOKEN ?? ''

// ── Axios instance ────────────────────────────────────────────────────────────

const bmAxios: AxiosInstance = axios.create({
  baseURL: BM_BASE_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
})

bmAxios.interceptors.request.use((config) => {
  if (BM_API_TOKEN) {
    config.headers.Authorization = `Bearer ${BM_API_TOKEN}`
  }
  return config
})

bmAxios.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err.response?.status
    const data   = err.response?.data as { message?: string; code?: string } | undefined
    const msg    = data?.message ?? err.message ?? 'Unknown Booking Manager API error'
    const code   = data?.code    ?? `BM_${status ?? 'NETWORK'}`

    const normalised = Object.assign(new Error(msg), {
      bmCode:   code,
      bmStatus: status,
      isNetworkError: !err.response,
    })
    return Promise.reject(normalised)
  },
)

// ── In-memory reference data cache ────────────────────────────────────────────

let _sailingAreas: BmSailingArea[] | null = null
let _countries:    BmCountry[]    | null = null
let _bases:        BmBase[]        | null = null
let _companies:    BmCompany[]     | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Serialise array params as repeated query keys: kind[]=sailboat&kind[]=catamaran */
function arrayParams(key: string, values: (string | number)[]): Record<string, string> {
  return Object.fromEntries(values.map((v, i) => [`${key}[${i}]`, String(v)]))
}

// ── Yacht endpoints ───────────────────────────────────────────────────────────

export interface GetYachtsParams {
  language?: string
  company?: number
  currency?: string
  inventory?: boolean
  kind?: BmKind[]
  product?: BmProduct
}

export const bmYachtsApi = {
  /**
   * List all yachts in the fleet.
   * BM API: GET /yachts
   */
  list: async (params: GetYachtsParams = {}): Promise<BmYacht[]> => {
    const { kind, ...rest } = params
    const kindParams = kind ? arrayParams('kind', kind) : {}
    const res = await bmAxios.get<BmYacht[]>('/yachts', {
      params: { ...rest, ...kindParams },
    })
    return res.data
  },

  /**
   * Get a single yacht by ID.
   * BM API: GET /yachts/{id}
   */
  get: async (id: number): Promise<BmYacht> => {
    const res = await bmAxios.get<BmYacht>(`/yachts/${id}`)
    return res.data
  },
}

// ── Offers / availability search ──────────────────────────────────────────────

export const bmOffersApi = {
  /**
   * Search available charter offers.
   * BM API: GET /offers
   */
  search: async (params: BmOffersParams): Promise<BmOffer[]> => {
    const {
      companyId, country, baseFromId, baseToId,
      sailingAreaId, yachtId, kind, tripDuration,
      ...rest
    } = params

    const arrayised: Record<string, string> = {
      ...(companyId    ? arrayParams('companyId', companyId)       : {}),
      ...(country      ? arrayParams('country', country)           : {}),
      ...(baseFromId   ? arrayParams('baseFromId', baseFromId)     : {}),
      ...(baseToId     ? arrayParams('baseToId', baseToId)         : {}),
      ...(sailingAreaId? arrayParams('sailingAreaId', sailingAreaId): {}),
      ...(yachtId      ? arrayParams('yachtId', yachtId)           : {}),
      ...(kind         ? arrayParams('kind', kind)                 : {}),
      ...(tripDuration ? arrayParams('tripDuration', tripDuration) : {}),
    }

    const res = await bmAxios.get<BmOffer[]>('/offers', {
      params: { ...rest, ...arrayised },
    })
    return res.data
  },
}

// ── Short availability ────────────────────────────────────────────────────────

export const bmAvailabilityApi = {
  /**
   * Returns a bitmap of weekly availability slots for the given year.
   * Each key is a Saturday (ISO date), value is a status char.
   * '0' = Available, '1' = Reservation, '2' = Option, etc.
   *
   * BM API: GET /shortAvailability/{year}
   */
  forYear: async (year: number, yachtId?: number): Promise<BmShortAvailability> => {
    const res = await bmAxios.get<BmShortAvailability>(`/shortAvailability/${year}`, {
      params: yachtId ? { yachtId } : undefined,
    })
    return res.data
  },

  /**
   * Convenience: return all booked Saturday dates for a specific yacht in a year.
   * A slot is "booked" when status !== '0'.
   */
  getBookedWeeks: async (yachtId: number, year: number): Promise<string[]> => {
    const bitmap = await bmAvailabilityApi.forYear(year, yachtId)
    return Object.entries(bitmap)
      .filter(([, status]) => status !== '0')
      .map(([date]) => date)
  },
}

// ── Reservations ──────────────────────────────────────────────────────────────

export const bmReservationsApi = {
  /**
   * Create a reservation option.
   * The option is held temporarily (see expirationDate in response).
   * BM API: POST /reservation
   */
  create: async (body: BmReservationRequest): Promise<BmReservationResponse> => {
    const res = await bmAxios.post<BmReservationResponse>('/reservation', body)
    return res.data
  },

  /**
   * Get a single reservation by ID.
   * BM API: GET /reservation/{id}
   */
  get: async (id: number): Promise<BmReservation> => {
    const res = await bmAxios.get<BmReservation>(`/reservation/${id}`)
    return res.data
  },

  /**
   * Confirm (finalise) a reservation.
   * BM API: PUT /reservation/{id}
   */
  confirm: async (id: number, updates?: Partial<BmReservationRequest>): Promise<BmReservation> => {
    const res = await bmAxios.put<BmReservation>(`/reservation/${id}`, updates ?? {})
    return res.data
  },

  /**
   * Cancel a reservation.
   * BM API: DELETE /reservation/{id}
   */
  cancel: async (id: number): Promise<void> => {
    await bmAxios.delete(`/reservation/${id}`)
  },

  /**
   * List all reservations for a given year.
   * BM API: GET /reservations/{year}
   */
  listByYear: async (
    year: number,
    opts?: { status?: string; month?: number },
  ): Promise<BmReservation[]> => {
    const res = await bmAxios.get<BmReservation[]>(`/reservations/${year}`, {
      params: opts,
    })
    return res.data
  },

  /**
   * Create a payment for a reservation.
   * BM API: POST /reservation/{reservationId}/payments
   */
  createPayment: async (
    reservationId: number,
    body: BmPaymentRequest,
  ): Promise<BmPaymentResponse> => {
    const res = await bmAxios.post<BmPaymentResponse>(
      `/reservation/${reservationId}/payments`,
      body,
    )
    return res.data
  },
}

// ── Reference data ────────────────────────────────────────────────────────────

export const bmReferenceApi = {
  sailingAreas: async (): Promise<BmSailingArea[]> => {
    if (_sailingAreas) return _sailingAreas
    const res = await bmAxios.get<BmSailingArea[]>('/sailingAreas')
    _sailingAreas = res.data
    return _sailingAreas
  },

  countries: async (): Promise<BmCountry[]> => {
    if (_countries) return _countries
    const res = await bmAxios.get<BmCountry[]>('/countries')
    _countries = res.data
    return _countries
  },

  bases: async (): Promise<BmBase[]> => {
    if (_bases) return _bases
    const res = await bmAxios.get<BmBase[]>('/bases')
    _bases = res.data
    return _bases
  },

  companies: async (): Promise<BmCompany[]> => {
    if (_companies) return _companies
    const res = await bmAxios.get<BmCompany[]>('/companies')
    _companies = res.data
    return _companies
  },

  /** Invalidate all cached reference data (e.g. after settings change). */
  clearCache: () => {
    _sailingAreas = null
    _countries    = null
    _bases        = null
    _companies    = null
  },
}
