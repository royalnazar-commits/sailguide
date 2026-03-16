export type UserRole = 'BUYER' | 'CAPTAIN' | 'ADMIN'
export type Difficulty = 'EASY' | 'MODERATE' | 'ADVANCED'
export type PointType = 'MARINA' | 'ANCHORAGE' | 'WAYPOINT' | 'POI' | 'DANGER' | 'FUEL'
export type PurchaseStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
export type StopType = 'SWIM' | 'LUNCH' | 'SNORKEL' | 'SCENIC' | 'VILLAGE' | 'ANCHORAGE' | 'CAVE' | 'VIEWPOINT' | 'BEACH' | 'ISLAND_WALK' | 'SUNSET'

export interface IntermediateStop {
  id: string
  name: string
  type: StopType
  description: string
  lat: number
  lng: number
  durationMins?: number
  isRecommended?: boolean
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  bio?: string
  avatarUrl?: string
  isVerifiedCaptain: boolean
  createdAt: string
}

export interface Captain {
  id: string
  name: string
  bio?: string
  avatarUrl?: string
  isVerifiedCaptain: boolean
  createdAt: string
  routes: Route[]
}

export interface Marina {
  id: string
  name: string
  country: string
  region: string
  lat: number
  lng: number
  phone?: string
  email?: string
  website?: string
  vhfChannel?: number
  depthM?: number
  capacity?: number
  maxLoaM?: number
  fuel: boolean
  water: boolean
  electricity: boolean
  wifi: boolean
  showers: boolean
  reservationRequired: boolean
  reservationMethod?: string
  mooringType?: string
  shelterNotes?: string
  checkInNotes?: string
  groceryNearby: boolean
  photos: string[]
  rating: number
  lastVerifiedAt?: string
  // from nearby endpoint
  distanceKm?: number
  distanceNm?: number
}

export interface RoutePoint {
  id: string
  routeId: string
  sequence: number
  type: PointType
  name: string
  lat: number
  lng: number
  description?: string
  distanceFromPrevNm?: number
  sailTimeHours?: number
  stayDurationHours?: number
  tips: string[]
  warnings: string[]
  weatherNotes?: string
  alternativeStopNotes?: string
  proximityAlertNm: number
  proximityMessage?: string
  marinaId?: string
  marina?: Marina
  intermediateStops?: IntermediateStop[]
}

export interface Route {
  id: string
  title: string
  description: string
  region: string
  country: string
  durationDays: number
  totalNm: number
  difficulty: Difficulty
  season?: string
  startMarinaId?: string
  endMarinaId?: string
  startMarina?: Marina
  endMarina?: Marina
  creatorId: string
  creator: {
    id: string
    name: string
    avatarUrl?: string
    isVerifiedCaptain: boolean
    bio?: string
  }
  priceUsd: number
  isPublished: boolean
  isVerified: boolean
  lastVerifiedAt?: string
  lastUpdatedAt: string
  tags: string[]
  previewPhotos: string[]
  avgRating: number
  hasPurchased?: boolean
  _count?: { purchases: number; reviews: number }
}

export interface Purchase {
  id: string
  userId: string
  routeId: string
  amountUsd: number
  status: PurchaseStatus
  purchasedAt: string
  route: Route
}

export interface Review {
  id: string
  userId: string
  routeId: string
  rating: number
  comment?: string
  createdAt: string
  user: { id: string; name: string; avatarUrl?: string }
}