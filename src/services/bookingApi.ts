/**
 * bookingApi — HTTP client for the SailGuide charter booking endpoints.
 *
 * Uses the shared `api` axios instance from api.ts which:
 *   - Reads EXPO_PUBLIC_API_URL (set your local machine IP in .env)
 *   - Attaches the auth token automatically via request interceptor
 *   - Logs all requests and errors in development
 *   - Surfaces readable error messages instead of raw "Network Error"
 *
 * All amounts are in cents (integer) — never floats.
 */

import { api } from './api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateBookingRequest {
  yachtId: string
  yachtName: string
  charterCompanyId: string
  dateFrom: string        // ISO 8601
  dateTo: string          // ISO 8601
  guests: number
  currency: string        // e.g. "eur"
  totalCents: number
  expiresAt: string       // ISO 8601
  bmReservationId?: string
  bmReservationCode?: string
}

export interface CreateBookingResponse {
  bookingId: string
  bookingReference: string
  clientSecret: string    // pass to stripe.confirmPayment()
  totalCents: number
  platformFeeCents: number
  payoutCents: number
  currency: string
  expiresAt: string
}

export interface Booking {
  id: string
  bookingReference: string
  yachtId: string
  yachtName: string
  charterCompanyId: string
  charterCompany: { id: string; name: string }
  dateFrom: string
  dateTo: string
  guests: number
  currency: string
  totalCents: number
  platformFeeCents: number
  payoutCents: number
  status: 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'DISPUTED'
  paymentIntentId: string | null
  bmReservationCode: string | null
  expiresAt: string
  cancelledAt: string | null
  createdAt: string
}

// ── Booking endpoints ─────────────────────────────────────────────────────────

export const bookingApi = {
  /**
   * Create a booking and get the Stripe client_secret.
   * Call this BEFORE showing the payment sheet.
   * Auth token is attached automatically by the api interceptor.
   */
  async create(data: CreateBookingRequest): Promise<CreateBookingResponse> {
    const { data: res } = await api.post<CreateBookingResponse>('/bookings', data)
    return res
  },

  /** List all bookings for the authenticated user. */
  async list(): Promise<Booking[]> {
    const { data } = await api.get<Booking[]>('/bookings')
    return data
  },

  /** Get a single booking by ID. */
  async get(bookingId: string): Promise<Booking> {
    const { data } = await api.get<Booking>(`/bookings/${bookingId}`)
    return data
  },

  /** Cancel a booking (issues refund if already PAID). */
  async cancel(bookingId: string, reason?: string): Promise<void> {
    await api.post(`/bookings/${bookingId}/cancel`, { reason })
  },
}
