/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SailGuide — Place Type Registry
 * ─────────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for every place type used in the app.
 *
 * HOW TO ADD A NEW TYPE
 *   1. Add the string to CANONICAL_PLACE_TYPES below
 *   2. Add its metadata row to REGISTRY
 *   3. Update src/types/place.ts (PlaceType re-exports CanonicalPlaceType)
 *   4. Add its icon renderer in PlaceMarker.tsx
 *   5. Add aliases to ALIASES if needed
 *
 * EVERY consumer must use getPlaceTypeMeta() — never access raw objects directly.
 * getPlaceTypeMeta() is guaranteed to NEVER return undefined.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Canonical type constants ──────────────────────────────────────────────────

export const CANONICAL_PLACE_TYPES = [
  'MARINA',
  'ANCHORAGE',
  'BAY',
  'BEACH',
  'CAVE',
  'LAGOON',
  'POI',
  'SNORKELING',
] as const

export type CanonicalPlaceType = (typeof CANONICAL_PLACE_TYPES)[number]

/** Default type returned when normalization fails */
export const FALLBACK_PLACE_TYPE: CanonicalPlaceType = 'POI'

// ── Metadata shape ────────────────────────────────────────────────────────────

export interface PlaceTypeMeta {
  type: CanonicalPlaceType
  /** Human-readable label shown in badges, lists, and filter chips */
  label: string
  /** Plural label used in filter chips ("Marinas", "Bays", …) */
  labelPlural: string
  /** Ionicons icon name — badges, search results, filter chips */
  icon: string
  /** Primary hex color */
  color: string
  /** Soft background (color at 12 % opacity) */
  bg: string
}

// ── Registry ──────────────────────────────────────────────────────────────────

const REGISTRY: Record<CanonicalPlaceType, PlaceTypeMeta> = {
  MARINA: {
    type: 'MARINA', label: 'Marina', labelPlural: 'Marinas',
    icon: 'anchor', color: '#1B6CA8', bg: '#1B6CA820',
  },
  ANCHORAGE: {
    type: 'ANCHORAGE', label: 'Anchorage', labelPlural: 'Anchorages',
    icon: 'boat-outline', color: '#22C55E', bg: '#22C55E20',
  },
  BAY: {
    type: 'BAY', label: 'Bay', labelPlural: 'Bays',
    icon: 'water-outline', color: '#00B4D8', bg: '#00B4D820',
  },
  BEACH: {
    type: 'BEACH', label: 'Beach', labelPlural: 'Beaches',
    icon: 'sunny-outline', color: '#FF7043', bg: '#FF704320',
  },
  CAVE: {
    type: 'CAVE', label: 'Cave', labelPlural: 'Caves',
    icon: 'aperture-outline', color: '#7C3AED', bg: '#7C3AED20',
  },
  LAGOON: {
    type: 'LAGOON', label: 'Lagoon', labelPlural: 'Lagoons',
    icon: 'ellipse-outline', color: '#0891B2', bg: '#0891B220',
  },
  POI: {
    type: 'POI', label: 'Point of Interest', labelPlural: 'POI',
    icon: 'star-outline', color: '#F59E0B', bg: '#F59E0B20',
  },
  SNORKELING: {
    type: 'SNORKELING', label: 'Snorkeling', labelPlural: 'Snorkeling',
    icon: 'fish-outline', color: '#0D9488', bg: '#0D948820',
  },
}

// ── Safe fallback (returned for completely unknown types) ─────────────────────

export const PLACE_TYPE_FALLBACK_META: PlaceTypeMeta = {
  type: FALLBACK_PLACE_TYPE,
  label: 'Place',
  labelPlural: 'Places',
  icon: 'location-outline',
  color: '#64748B',
  bg: '#64748B20',
}

// ── Alias map ─────────────────────────────────────────────────────────────────
// Keys are UPPER_SNAKE_CASE after .toUpperCase().replace(/[\s\-]+/g, '_')

const ALIASES: Readonly<Record<string, CanonicalPlaceType>> = {
  // ── Marina ──
  MARINA: 'MARINA',
  MOORING_FIELD: 'MARINA',
  MOORING: 'MARINA',
  HARBOUR: 'MARINA',
  HARBOR: 'MARINA',
  PORT: 'MARINA',

  // ── Anchorage ──
  ANCHORAGE: 'ANCHORAGE',
  ANCHOR: 'ANCHORAGE',

  // ── Bay ──
  BAY: 'BAY',
  HIDDEN_BAY: 'BAY',
  INLET: 'BAY',
  COVE: 'BAY',

  // ── Beach / swimming ──
  BEACH: 'BEACH',
  NATURAL_POOL: 'BEACH',
  CLIFF_JUMP: 'BEACH',
  CLIFF_JUMPING: 'BEACH',
  SWIMMING_SPOT: 'BEACH',
  SWIMMING: 'BEACH',
  SWIM_SPOT: 'BEACH',
  SWIM: 'BEACH',

  // ── Cave ──
  CAVE: 'CAVE',
  SEA_CAVE: 'CAVE',
  BLUE_CAVE: 'CAVE',
  BLUE_GROTTO: 'CAVE',
  GROTTO: 'CAVE',
  SEA_GROTTO: 'CAVE',

  // ── Lagoon ──
  LAGOON: 'LAGOON',

  // ── POI / scenic ──
  POI: 'POI',
  POINT_OF_INTEREST: 'POI',
  SCENIC_POI: 'POI',
  SCENIC: 'POI',
  VIEWPOINT: 'POI',
  LANDMARK: 'POI',

  // ── Snorkeling / diving ──
  SNORKELING: 'SNORKELING',
  SNORKELING_SPOT: 'SNORKELING',
  SNORKEL: 'SNORKELING',
  SNORKEL_SPOT: 'SNORKELING',
  DIVING: 'SNORKELING',
  DIVE_SPOT: 'SNORKELING',
}

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Normalize any raw type string to a canonical CanonicalPlaceType.
 *
 * Safe for: null, undefined, lowercase, mixed-case, hyphen-separated,
 * space-separated, and any known alias. Unknown values → FALLBACK_PLACE_TYPE.
 */
export function normalizePlaceType(
  raw: string | null | undefined,
): CanonicalPlaceType {
  if (!raw) return FALLBACK_PLACE_TYPE
  const key = raw.trim().toUpperCase().replace(/[\s\-]+/g, '_')
  return ALIASES[key] ?? FALLBACK_PLACE_TYPE
}

/**
 * Resolve full metadata for any raw place type string.
 *
 * GUARANTEED to always return a valid PlaceTypeMeta object.
 * Never returns undefined, never throws.
 */
export function getPlaceTypeMeta(
  raw: string | null | undefined,
): PlaceTypeMeta {
  const canonical = normalizePlaceType(raw)
  return REGISTRY[canonical] ?? PLACE_TYPE_FALLBACK_META
}

// ── Derived collections used by UI ────────────────────────────────────────────

/** All canonical metadata in definition order */
export const ALL_PLACE_TYPE_META: readonly PlaceTypeMeta[] =
  CANONICAL_PLACE_TYPES.map((t) => REGISTRY[t])

// ── Filter chips (ExploreScreen) ──────────────────────────────────────────────

export type FilterKey = CanonicalPlaceType | 'ALL'

export interface PlaceTypeFilter {
  key: FilterKey
  label: string
  icon: string
  activeColor: string
}

export const PLACE_TYPE_FILTERS: readonly PlaceTypeFilter[] = [
  { key: 'ALL',        label: 'All',        icon: 'globe-outline',    activeColor: '#1B6CA8' },
  { key: 'MARINA',     label: 'Marinas',    icon: 'anchor',           activeColor: '#1B6CA8' },
  { key: 'ANCHORAGE',  label: 'Anchorages', icon: 'boat-outline',     activeColor: '#22C55E' },
  { key: 'BAY',        label: 'Bays',       icon: 'water-outline',    activeColor: '#00B4D8' },
  { key: 'LAGOON',     label: 'Lagoons',    icon: 'ellipse-outline',  activeColor: '#0891B2' },
  { key: 'BEACH',      label: 'Beaches',    icon: 'sunny-outline',    activeColor: '#FF7043' },
  { key: 'SNORKELING', label: 'Snorkeling', icon: 'fish-outline',     activeColor: '#0D9488' },
  { key: 'CAVE',       label: 'Caves',      icon: 'aperture-outline', activeColor: '#7C3AED' },
  { key: 'POI',        label: 'POI',        icon: 'star-outline',     activeColor: '#F59E0B' },
]

// ── Quick-add chips (ExploreScreen long-press sheet) ──────────────────────────

export interface PlaceTypeQuick {
  type: CanonicalPlaceType
  label: string
  color: string
}

export const PLACE_TYPE_QUICK: readonly PlaceTypeQuick[] = [
  { type: 'ANCHORAGE',  label: 'Anchorage',  color: '#22C55E' },
  { type: 'BAY',        label: 'Bay',        color: '#00B4D8' },
  { type: 'LAGOON',     label: 'Lagoon',     color: '#0891B2' },
  { type: 'BEACH',      label: 'Beach',      color: '#FF7043' },
  { type: 'SNORKELING', label: 'Snorkeling', color: '#0D9488' },
  { type: 'MARINA',     label: 'Marina',     color: '#1B6CA8' },
  { type: 'CAVE',       label: 'Cave',       color: '#7C3AED' },
  { type: 'POI',        label: 'POI',        color: '#F59E0B' },
]

// ── Full type-selector options (CreatePlaceScreen) ────────────────────────────

export const PLACE_TYPE_OPTIONS: readonly PlaceTypeMeta[] = ALL_PLACE_TYPE_META
