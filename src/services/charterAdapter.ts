/**
 * charterAdapter — bidirectional mapping between Booking Manager API types
 * and the app's internal charter domain types.
 *
 * All screens and components work exclusively with the app's Yacht / BookingDraft
 * types. This file is the only place that knows about BM API specifics.
 */

import {
  BmYacht,
  BmOffer,
  BmReservationRequest,
  BmReservationResponse,
  BmKind,
} from '../types/bookingManager'
import {
  Yacht,
  BoatType,
  BookingDraft,
  SkipperOption,
} from '../types/charter'

// ── Kind → BoatType ───────────────────────────────────────────────────────────

const KIND_TO_TYPE: Record<BmKind, BoatType> = {
  sailboat:         'SAILBOAT',
  catamaran:        'CATAMARAN',
  motor_yacht:      'MOTOR_YACHT',
  motor_catamaran:  'CATAMARAN',
  gulet:            'GULET',
  powerboat:        'MOTOR_YACHT',
  cabin_cruiser:    'MOTOR_YACHT',
  catamaran_power:  'CATAMARAN',
  rigid_inflatable: 'MOTOR_YACHT',
  other:            'SAILBOAT',
}

export function kindToBoatType(kind: BmKind | undefined): BoatType {
  if (!kind) return 'SAILBOAT'
  return KIND_TO_TYPE[kind] ?? 'SAILBOAT'
}

export function boatTypeToKind(type: BoatType): BmKind {
  switch (type) {
    case 'SAILBOAT':    return 'sailboat'
    case 'CATAMARAN':   return 'catamaran'
    case 'MOTOR_YACHT': return 'motor_yacht'
    case 'GULET':       return 'gulet'
  }
}

// ── BmYacht → Yacht ───────────────────────────────────────────────────────────

export function bmYachtToYacht(bm: BmYacht): Yacht {
  const images: string[] = bm.photoUrls?.length
    ? bm.photoUrls
    : bm.mainPhotoUrl
    ? [bm.mainPhotoUrl]
    : []

  return {
    id:               String(bm.id),
    name:             bm.name,
    model:            bm.model ?? bm.name,
    type:             kindToBoatType(bm.kind),
    lengthM:          bm.loa ?? 0,
    cabins:           bm.cabins ?? 0,
    berths:           bm.berths ?? 0,
    guests:           bm.berths ?? 0,
    toilets:          bm.toilets ?? 0,
    yearBuilt:        bm.yearBuilt ?? 0,
    engineHp:         bm.engineHp,
    fuelTankL:        bm.fuelTankL,
    waterTankL:       bm.waterTankL,

    marina:           bm.baseName ?? '',
    city:             bm.city ?? '',
    country:          bm.country ?? '',
    region:           [bm.country, bm.sailingAreaName].filter(Boolean).join(' — '),
    lat:              bm.lat ?? 0,
    lng:              bm.lng ?? 0,

    // BM numeric company ID stored as a string — the backend booking service
    // resolves it to our internal CharterCompany via the bmCompanyId field.
    charterCompanyId: bm.companyId ? String(bm.companyId) : undefined,

    // Prices are unknown from a plain /yachts call; use 0 as placeholder.
    // Filled in by bmOfferToYacht when an offer is available.
    pricePerWeekEur:  0,
    depositEur:       0,
    checkInDay:       'Saturday',
    checkOutDay:      'Saturday',
    skipper:          'optional',
    skipperCostPerDayEur: undefined,

    // Content
    rating:           0,
    reviewCount:      0,
    images,
    description:      bm.description ?? '',
    equipment:        [],
    tags:             [bm.country, bm.sailingAreaName].filter(Boolean) as string[],

    bookedWeeks:      [],
  }
}

// ── BmOffer → Yacht ───────────────────────────────────────────────────────────

/**
 * Builds an app Yacht from an offer search result.
 * Many yacht-level fields (engine, tanks, description, equipment) are not
 * returned by /offers — they are filled with sensible defaults.
 * Call bmYachtsApi.get() if full yacht detail is needed.
 */
export function bmOfferToYacht(offer: BmOffer): Yacht {
  const images: string[] = offer.mainPhotoUrl ? [offer.mainPhotoUrl] : []

  const skipper: SkipperOption = offer.skipperOption ?? 'optional'

  return {
    id:               String(offer.yachtId),
    name:             offer.yachtName ?? `Yacht ${offer.yachtId}`,
    model:            offer.model ?? '',
    type:             kindToBoatType(offer.kind),
    lengthM:          offer.loa ?? 0,
    cabins:           offer.cabins ?? 0,
    berths:           offer.berths ?? 0,
    guests:           offer.berths ?? 0,
    toilets:          0,
    yearBuilt:        offer.yearBuilt ?? 0,

    marina:           offer.baseFromName ?? '',
    city:             '',
    country:          offer.country ?? '',
    region:           offer.country ?? '',
    lat:              0,
    lng:              0,

    pricePerWeekEur:  offer.clientPrice > 0 ? offer.clientPrice : offer.basePrice,
    depositEur:       0,
    checkInDay:       'Saturday',
    checkOutDay:      'Saturday',
    skipper,
    skipperCostPerDayEur: offer.skipperPricePerDay,

    rating:           0,
    reviewCount:      0,
    images,
    description:      '',
    equipment:        [],
    tags:             [offer.country].filter(Boolean) as string[],

    bookedWeeks:      [],
  }
}

/**
 * Merge full yacht detail into a yacht created from an offer,
 * preserving the pricing information from the offer.
 */
export function mergeYachtDetail(fromOffer: Yacht, detail: BmYacht): Yacht {
  const detailYacht = bmYachtToYacht(detail)
  return {
    ...detailYacht,
    // Keep offer-derived pricing, availability
    pricePerWeekEur:     fromOffer.pricePerWeekEur,
    depositEur:          fromOffer.depositEur,
    skipper:             fromOffer.skipper,
    skipperCostPerDayEur: fromOffer.skipperCostPerDayEur,
    bookedWeeks:         fromOffer.bookedWeeks,
  }
}

// ── BookingDraft → BmReservationRequest ───────────────────────────────────────

export function bookingDraftToReservationRequest(
  draft: BookingDraft,
  baseFromId?: number,
): BmReservationRequest {
  return {
    dateFrom:           draft.startDate!,
    dateTo:             draft.endDate!,
    yachtId:            Number(draft.yachtId),
    baseFromId,
    clientName:         [draft.firstName, draft.lastName].filter(Boolean).join(' ') || undefined,
    passengersOnBoard:  draft.guests,
    currency:           'EUR',
  }
}

// ── BmReservationResponse → local booking summary ─────────────────────────────

export interface LocalBookingSummary {
  reservationId:   number
  reservationCode: string
  status:          string
  yachtId:         string
  dateFrom:        string
  dateTo:          string
  currency:        string
  totalPrice:      number
  deposit:         number
  expiresAt?:      string
}

export function bmReservationToLocalSummary(
  res: BmReservationResponse,
): LocalBookingSummary {
  return {
    reservationId:   res.id,
    reservationCode: res.reservationCode,
    status:          res.status,
    yachtId:         String(res.yachtId),
    dateFrom:        res.dateFrom,
    dateTo:          res.dateTo,
    currency:        res.currency,
    totalPrice:      res.clientPrice ?? res.finalPrice,
    deposit:         res.securityDeposit ?? 0,
    expiresAt:       res.expirationDate,
  }
}
