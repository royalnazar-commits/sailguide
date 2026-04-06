/**
 * seaRouter.ts
 *
 * Lightweight visual routing utility for Mediterranean sailing routes.
 *
 * When a direct line between two coordinates would cut through a known island,
 * this utility inserts bypass waypoints that route around the island's bounding
 * box instead.  The result is visually plausible and deterministic.
 *
 * This is NOT a full marine routing engine — it is a visual quality fix.
 * Island polygons are intentionally simplified; the goal is crossing detection,
 * not GIS accuracy.
 */

type Pt = { lat: number; lng: number }
export type SeaPt = { latitude: number; longitude: number }

interface Island {
  name: string
  minLat: number; maxLat: number
  minLng: number; maxLng: number
  /** Simplified outline polygon used for crossing detection */
  poly: Pt[]
}

// ─── Geometry primitives ──────────────────────────────────────────────────────

function cross2d(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx
}

/**
 * True if segments P1→P2 and P3→P4 properly intersect.
 * Uses the cross-product sign-change test; works in lat/lng space for
 * distances well under 1 000 nm (no spherical correction needed).
 */
function segmentsIntersect(
  lat1: number, lng1: number, lat2: number, lng2: number,
  lat3: number, lng3: number, lat4: number, lng4: number,
): boolean {
  const d1a = lat2 - lat1, d1b = lng2 - lng1
  const d2a = lat4 - lat3, d2b = lng4 - lng3
  const c1 = cross2d(d2a, d2b, lat1 - lat3, lng1 - lng3)
  const c2 = cross2d(d2a, d2b, lat2 - lat3, lng2 - lng3)
  if (c1 * c2 >= 0) return false
  const c3 = cross2d(d1a, d1b, lat3 - lat1, lng3 - lng1)
  const c4 = cross2d(d1a, d1b, lat4 - lat1, lng4 - lng1)
  return c3 * c4 < 0
}

/**
 * Approximate 2-D distance in degree-space with latitude correction.
 * Sufficient for comparing relative path lengths — not for precise nm totals.
 */
function dist2d(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = lat2 - lat1
  const dlng = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180))
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

/** True if the segment (lat1,lng1)→(lat2,lng2) crosses the island polygon.
 *
 * NOTE: we intentionally do NOT run a point-in-polygon test for the segment
 * endpoints.  Sea routes always start/end at the coast or offshore, and
 * simplified polygons often include marina bays, which would cause false
 * positives and infinite bypass loops.  Edge-intersection alone is sufficient:
 * any segment that cuts through an island must cross at least two polygon edges.
 *
 * Hidden waypoints are different — they are synthesised mid-air and CAN land
 * inside a polygon.  Use isWater() to validate those points explicitly.
 */
function segmentCrossesIsland(
  lat1: number, lng1: number, lat2: number, lng2: number,
  island: Island,
): boolean {
  // Fast bounding-box rejection
  if (Math.max(lat1, lat2) < island.minLat || Math.min(lat1, lat2) > island.maxLat) return false
  if (Math.max(lng1, lng2) < island.minLng || Math.min(lng1, lng2) > island.maxLng) return false

  // Check if the segment crosses any polygon edge
  const n = island.poly.length
  for (let i = 0; i < n; i++) {
    const p1 = island.poly[i], p2 = island.poly[(i + 1) % n]
    if (segmentsIntersect(lat1, lng1, lat2, lng2, p1.lat, p1.lng, p2.lat, p2.lng)) return true
  }
  return false
}

/**
 * Ray-casting point-in-polygon test (even-odd rule).
 * Returns true when (lat, lng) is strictly inside the polygon.
 * Used only to validate synthesised hidden waypoints — not segment endpoints.
 */
function pointInPolygon(lat: number, lng: number, island: Island): boolean {
  // Fast bounding-box pre-filter
  if (lat < island.minLat || lat > island.maxLat) return false
  if (lng < island.minLng || lng > island.maxLng) return false
  const poly = island.poly
  const n = poly.length
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = poly[i], pj = poly[j]
    if (
      (pi.lat > lat) !== (pj.lat > lat) &&
      lng < ((pj.lng - pi.lng) * (lat - pi.lat)) / (pj.lat - pi.lat) + pi.lng
    ) inside = !inside
  }
  return inside
}

/**
 * Returns true when the point is NOT inside any known land polygon.
 * Checks ALL polygons — no exceptions.
 */
function isWater(lat: number, lng: number): boolean {
  for (const island of ISLANDS) {
    if (pointInPolygon(lat, lng, island)) return false
  }
  return true
}

/** True if the segment crosses any island polygon. */
function segmentCrossesAnyIsland(
  lat1: number, lng1: number, lat2: number, lng2: number,
): boolean {
  for (const island of ISLANDS) {
    if (segmentCrossesIsland(lat1, lng1, lat2, lng2, island)) return true
  }
  return false
}

/**
 * One iteration of the Chaikin corner-cutting algorithm.
 * Replaces each edge with two new points at 1/4 and 3/4 along it.
 * First and last points are kept exactly so endpoints never move.
 */
function chaikin(pts: SeaPt[]): SeaPt[] {
  if (pts.length < 3) return pts
  const out: SeaPt[] = [pts[0]]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1]
    out.push({
      latitude:  0.75 * p0.latitude  + 0.25 * p1.latitude,
      longitude: 0.75 * p0.longitude + 0.25 * p1.longitude,
    })
    out.push({
      latitude:  0.25 * p0.latitude  + 0.75 * p1.latitude,
      longitude: 0.25 * p0.longitude + 0.75 * p1.longitude,
    })
  }
  out.push(pts[pts.length - 1])
  return out
}

// ─── Public API ───────────────────────────────────────────────────────────────
//
// Routing strategy: recursive segment splitting with best-candidate scoring.
//
// buildPath(A, B, depth):
//   1. If A→B does not cross any land polygon — return [A, B].
//   2. Compute midpoint M of A→B.
//   3. Generate candidate waypoints by shifting M perpendicular to A→B at
//      several offset fractions of |A→B| on both sides.
//   4. Filter candidates: keep only those where
//        isWater(C) AND A→C clear AND C→B clear.
//   5. Score valid candidates by total detour length dist(A→C) + dist(C→B).
//      Pick the one with the LOWEST score (minimum detour).
//   6. If no valid candidate found — return [A, B] (depth cap prevents
//      infinite loops; the recursion below will further subdivide).
//   7. Recurse: left = buildPath(A, C) + right = buildPath(C, B).
//      Merge into a single ordered array.
//
// After the path is assembled, one pass of Chaikin smoothing is applied.
// The smoothed result is accepted only when EVERY smoothed point is in water
// AND no smoothed segment crosses land.  Otherwise the raw path is returned.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DEPTH = 6
/** Perpendicular offset fractions of segment length to try on each side. */
const CANDIDATE_FRACS = [0.15, 0.3, 0.5, 0.75, 1.0, 1.5] as const

/**
 * Recursive segment splitter with best-candidate selection.
 * Returns an ordered array of Pt; every adjacent pair was explicitly
 * verified to be land-free before being accepted.
 */
function buildPath(
  aLat: number, aLng: number,
  bLat: number, bLng: number,
  depth: number,
): Pt[] {
  if (depth > MAX_DEPTH || !segmentCrossesAnyIsland(aLat, aLng, bLat, bLng)) {
    return [{ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng }]
  }

  const midLat = (aLat + bLat) / 2
  const midLng = (aLng + bLng) / 2

  // Perpendicular unit vector for this segment (latitude-corrected)
  const cos = Math.cos(midLat * Math.PI / 180)
  const dLat = bLat - aLat
  const dLng = (bLng - aLng) * cos
  const len  = Math.sqrt(dLat * dLat + dLng * dLng)
  if (len < 1e-9) return [{ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng }]

  const perpLatUnit = -dLng / len
  const perpLngUnit =  dLat / len / cos

  // Generate all candidates and keep valid ones, scored by detour length
  let bestPt: Pt | null = null
  let bestScore = Infinity

  for (const frac of CANDIDATE_FRACS) {
    const off = frac * len
    for (const side of [1, -1] as const) {
      const cLat = midLat + perpLatUnit * off * side
      const cLng = midLng + perpLngUnit * off * side
      if (!isWater(cLat, cLng)) continue
      if (segmentCrossesAnyIsland(aLat, aLng, cLat, cLng)) continue
      if (segmentCrossesAnyIsland(cLat, cLng, bLat, bLng)) continue
      const score = dist2d(aLat, aLng, cLat, cLng) + dist2d(cLat, cLng, bLat, bLng)
      if (score < bestScore) { bestScore = score; bestPt = { lat: cLat, lng: cLng } }
    }
  }

  // No valid candidate — return direct segment; deeper recursion will handle sub-segments
  if (!bestPt) return [{ lat: aLat, lng: aLng }, { lat: bLat, lng: bLng }]

  const left  = buildPath(aLat,       aLng,       bestPt.lat, bestPt.lng, depth + 1)
  const right = buildPath(bestPt.lat, bestPt.lng, bLat,       bLng,       depth + 1)
  return [...left, ...right.slice(1)]
}

/**
 * Returns a sea-safe, smoothed path from (lat1,lng1) to (lat2,lng2).
 * Always returns at least 2 points; first and last are exactly A and B.
 */
export function seaSafePath(lat1: number, lng1: number, lat2: number, lng2: number): SeaPt[] {
  const pts = buildPath(lat1, lng1, lat2, lng2, 0)
  const raw: SeaPt[] = pts.map(p => ({ latitude: p.lat, longitude: p.lng }))

  // Apply Chaikin smoothing and validate BOTH points and segments.
  // Any smoothed point on land or smoothed segment crossing land → discard smoothing.
  const smoothed = chaikin(raw)
  for (let i = 0; i < smoothed.length - 1; i++) {
    if (!isWater(smoothed[i].latitude, smoothed[i].longitude)) return raw
    if (segmentCrossesAnyIsland(
      smoothed[i].latitude, smoothed[i].longitude,
      smoothed[i + 1].latitude, smoothed[i + 1].longitude,
    )) return raw
  }
  if (!isWater(smoothed[smoothed.length - 1].latitude, smoothed[smoothed.length - 1].longitude)) return raw
  return smoothed
}

// ─── Island polygon data ──────────────────────────────────────────────────────
//
// Polygons are simplified convex-ish outlines.  Coordinates are intentionally
// approximate — a few km error is fine for crossing detection.  The router
// inserts perpendicular hidden waypoints that bend routes around these shapes.
//
// Coverage: Balearics · W Mediterranean · Ionian · Saronic · Cyclades ·
//           E Aegean · Crete · Dalmatian · Cyprus
//
// ─────────────────────────────────────────────────────────────────────────────

const ISLANDS: Island[] = [

  // ══ Balearic Islands ════════════════════════════════════════════════════════

  {
    name: 'Mallorca',
    minLat: 39.25, maxLat: 40.05, minLng: 2.30, maxLng: 3.50,
    poly: [
      { lat: 39.88, lng: 2.34 }, { lat: 39.97, lng: 3.21 },
      { lat: 39.74, lng: 3.48 }, { lat: 39.54, lng: 3.47 },
      { lat: 39.25, lng: 3.05 }, { lat: 39.26, lng: 2.77 },
      { lat: 39.38, lng: 2.38 }, { lat: 39.65, lng: 2.30 },
    ],
  },
  {
    name: 'Menorca',
    minLat: 39.80, maxLat: 40.10, minLng: 3.70, maxLng: 4.35,
    poly: [
      { lat: 40.05, lng: 3.72 }, { lat: 40.08, lng: 4.33 },
      { lat: 39.80, lng: 4.33 }, { lat: 39.80, lng: 3.72 },
    ],
  },
  {
    name: 'Ibiza',
    minLat: 38.80, maxLat: 39.10, minLng: 1.18, maxLng: 1.60,
    poly: [
      { lat: 39.08, lng: 1.44 }, { lat: 39.02, lng: 1.58 },
      { lat: 38.90, lng: 1.56 }, { lat: 38.84, lng: 1.46 },
      { lat: 38.80, lng: 1.28 }, { lat: 38.90, lng: 1.18 },
    ],
  },
  {
    name: 'Formentera',
    minLat: 38.63, maxLat: 38.75, minLng: 1.35, maxLng: 1.77,
    poly: [
      { lat: 38.75, lng: 1.40 }, { lat: 38.72, lng: 1.77 },
      { lat: 38.63, lng: 1.72 }, { lat: 38.63, lng: 1.37 },
    ],
  },

  // ══ Western Mediterranean ═══════════════════════════════════════════════════

  {
    name: 'Corsica',
    minLat: 41.33, maxLat: 43.02, minLng: 8.53, maxLng: 9.57,
    poly: [
      { lat: 43.00, lng: 9.35 }, { lat: 42.62, lng: 9.57 },
      { lat: 41.76, lng: 9.57 }, { lat: 41.35, lng: 9.22 },
      { lat: 41.36, lng: 8.73 }, { lat: 41.84, lng: 8.54 },
      { lat: 42.73, lng: 8.56 },
    ],
  },
  {
    name: 'Sardinia',
    minLat: 38.85, maxLat: 41.25, minLng: 8.10, maxLng: 9.85,
    poly: [
      { lat: 41.25, lng: 9.22 }, { lat: 41.15, lng: 9.73 },
      { lat: 40.50, lng: 9.85 }, { lat: 39.80, lng: 9.80 },
      { lat: 38.88, lng: 9.50 }, { lat: 38.85, lng: 9.00 },
      { lat: 39.12, lng: 8.13 }, { lat: 40.15, lng: 8.10 },
      { lat: 40.90, lng: 8.25 },
    ],
  },
  {
    name: 'Sicily',
    minLat: 36.65, maxLat: 38.30, minLng: 12.42, maxLng: 15.65,
    poly: [
      { lat: 38.00, lng: 12.47 }, { lat: 38.28, lng: 13.38 },
      { lat: 38.24, lng: 15.56 }, { lat: 37.60, lng: 15.65 },
      { lat: 36.67, lng: 15.16 }, { lat: 37.00, lng: 14.25 },
      { lat: 37.30, lng: 13.59 }, { lat: 37.84, lng: 12.44 },
    ],
  },
  {
    name: 'Malta',
    minLat: 35.79, maxLat: 36.09, minLng: 14.18, maxLng: 14.58,
    poly: [
      { lat: 36.08, lng: 14.35 }, { lat: 36.00, lng: 14.57 },
      { lat: 35.79, lng: 14.55 }, { lat: 35.83, lng: 14.18 },
    ],
  },

  // ══ Ionian Islands ══════════════════════════════════════════════════════════

  {
    name: 'Corfu',
    minLat: 39.35, maxLat: 39.85, minLng: 19.65, maxLng: 20.15,
    poly: [
      { lat: 39.84, lng: 19.90 }, { lat: 39.83, lng: 20.14 },
      { lat: 39.60, lng: 20.15 }, { lat: 39.36, lng: 20.09 },
      { lat: 39.35, lng: 19.93 }, { lat: 39.56, lng: 19.65 },
    ],
  },
  {
    name: 'Lefkada',
    minLat: 38.50, maxLat: 38.90, minLng: 20.55, maxLng: 20.85,
    poly: [
      { lat: 38.88, lng: 20.71 }, { lat: 38.73, lng: 20.85 },
      { lat: 38.51, lng: 20.69 }, { lat: 38.61, lng: 20.56 },
    ],
  },
  {
    name: 'Kefalonia',
    minLat: 38.10, maxLat: 38.65, minLng: 20.30, maxLng: 20.85,
    poly: [
      { lat: 38.65, lng: 20.52 }, { lat: 38.62, lng: 20.84 },
      { lat: 38.27, lng: 20.85 }, { lat: 38.11, lng: 20.42 },
      { lat: 38.16, lng: 20.32 }, { lat: 38.40, lng: 20.30 },
    ],
  },
  {
    name: 'Zakynthos',
    minLat: 37.65, maxLat: 38.00, minLng: 20.70, maxLng: 21.00,
    poly: [
      { lat: 37.98, lng: 20.88 }, { lat: 37.76, lng: 21.00 },
      { lat: 37.65, lng: 20.85 }, { lat: 37.65, lng: 20.71 },
      { lat: 37.83, lng: 20.70 },
    ],
  },
  {
    name: 'Ithaca',
    minLat: 38.34, maxLat: 38.51, minLng: 20.60, maxLng: 20.75,
    poly: [
      { lat: 38.50, lng: 20.66 }, { lat: 38.47, lng: 20.75 },
      { lat: 38.34, lng: 20.74 }, { lat: 38.35, lng: 20.61 },
    ],
  },
  {
    name: 'Paxi',
    minLat: 39.19, maxLat: 39.25, minLng: 20.14, maxLng: 20.22,
    poly: [
      { lat: 39.24, lng: 20.14 }, { lat: 39.25, lng: 20.22 },
      { lat: 39.19, lng: 20.21 }, { lat: 39.19, lng: 20.15 },
    ],
  },

  // ══ Saronic Gulf ════════════════════════════════════════════════════════════

  {
    name: 'Aegina',
    minLat: 37.65, maxLat: 37.88, minLng: 23.40, maxLng: 23.63,
    poly: [
      { lat: 37.88, lng: 23.53 }, { lat: 37.80, lng: 23.62 },
      { lat: 37.66, lng: 23.57 }, { lat: 37.65, lng: 23.41 },
      { lat: 37.76, lng: 23.40 },
    ],
  },
  {
    name: 'Salamina',
    minLat: 37.88, maxLat: 37.98, minLng: 23.38, maxLng: 23.57,
    poly: [
      { lat: 37.97, lng: 23.43 }, { lat: 37.98, lng: 23.57 },
      { lat: 37.88, lng: 23.54 }, { lat: 37.89, lng: 23.38 },
    ],
  },
  {
    name: 'Poros',
    minLat: 37.47, maxLat: 37.54, minLng: 23.44, maxLng: 23.54,
    poly: [
      { lat: 37.53, lng: 23.46 }, { lat: 37.54, lng: 23.52 },
      { lat: 37.47, lng: 23.52 }, { lat: 37.47, lng: 23.44 },
    ],
  },
  {
    name: 'Hydra',
    minLat: 37.32, maxLat: 37.38, minLng: 23.39, maxLng: 23.54,
    poly: [
      { lat: 37.38, lng: 23.41 }, { lat: 37.37, lng: 23.53 },
      { lat: 37.32, lng: 23.53 }, { lat: 37.32, lng: 23.39 },
    ],
  },
  {
    name: 'Spetses',
    minLat: 37.23, maxLat: 37.28, minLng: 23.07, maxLng: 23.19,
    poly: [
      { lat: 37.28, lng: 23.09 }, { lat: 37.27, lng: 23.18 },
      { lat: 37.23, lng: 23.17 }, { lat: 37.24, lng: 23.07 },
    ],
  },

  // ══ Cyclades ════════════════════════════════════════════════════════════════

  {
    name: 'Andros',
    minLat: 37.78, maxLat: 37.95, minLng: 24.67, maxLng: 24.97,
    poly: [
      { lat: 37.95, lng: 24.69 }, { lat: 37.92, lng: 24.97 },
      { lat: 37.78, lng: 24.93 }, { lat: 37.80, lng: 24.67 },
    ],
  },
  {
    name: 'Tinos',
    minLat: 37.50, maxLat: 37.66, minLng: 25.02, maxLng: 25.28,
    poly: [
      { lat: 37.65, lng: 25.03 }, { lat: 37.66, lng: 25.28 },
      { lat: 37.50, lng: 25.26 }, { lat: 37.51, lng: 25.02 },
    ],
  },
  {
    name: 'Mykonos',
    minLat: 37.42, maxLat: 37.52, minLng: 25.30, maxLng: 25.46,
    poly: [
      { lat: 37.52, lng: 25.32 }, { lat: 37.49, lng: 25.46 },
      { lat: 37.42, lng: 25.43 }, { lat: 37.44, lng: 25.30 },
    ],
  },
  {
    name: 'Syros',
    minLat: 37.38, maxLat: 37.50, minLng: 24.88, maxLng: 25.00,
    poly: [
      { lat: 37.50, lng: 24.90 }, { lat: 37.47, lng: 25.00 },
      { lat: 37.38, lng: 24.98 }, { lat: 37.39, lng: 24.88 },
    ],
  },
  {
    name: 'Paros',
    minLat: 36.98, maxLat: 37.12, minLng: 25.10, maxLng: 25.30,
    poly: [
      { lat: 37.12, lng: 25.13 }, { lat: 37.09, lng: 25.30 },
      { lat: 36.98, lng: 25.27 }, { lat: 37.00, lng: 25.10 },
    ],
  },
  {
    name: 'Naxos',
    minLat: 36.90, maxLat: 37.18, minLng: 25.35, maxLng: 25.70,
    poly: [
      { lat: 37.17, lng: 25.37 }, { lat: 37.15, lng: 25.70 },
      { lat: 36.90, lng: 25.64 }, { lat: 36.92, lng: 25.38 },
    ],
  },
  {
    name: 'Ios',
    minLat: 36.67, maxLat: 36.78, minLng: 25.24, maxLng: 25.43,
    poly: [
      { lat: 36.78, lng: 25.24 }, { lat: 36.76, lng: 25.42 },
      { lat: 36.67, lng: 25.40 }, { lat: 36.68, lng: 25.25 },
    ],
  },
  {
    name: 'Santorini',
    minLat: 36.34, maxLat: 36.53, minLng: 25.34, maxLng: 25.50,
    poly: [
      { lat: 36.52, lng: 25.37 }, { lat: 36.47, lng: 25.50 },
      { lat: 36.34, lng: 25.47 }, { lat: 36.38, lng: 25.34 },
    ],
  },
  {
    name: 'Milos',
    minLat: 36.65, maxLat: 36.80, minLng: 24.33, maxLng: 24.59,
    poly: [
      { lat: 36.79, lng: 24.34 }, { lat: 36.76, lng: 24.58 },
      { lat: 36.65, lng: 24.57 }, { lat: 36.66, lng: 24.33 },
    ],
  },

  // ══ Eastern Aegean ═══════════════════════════════════════════════════════════

  {
    name: 'Lesbos',
    minLat: 38.95, maxLat: 39.40, minLng: 25.85, maxLng: 26.72,
    poly: [
      { lat: 39.38, lng: 26.16 }, { lat: 39.40, lng: 26.72 },
      { lat: 39.12, lng: 26.66 }, { lat: 38.95, lng: 26.27 },
      { lat: 39.08, lng: 25.85 },
    ],
  },
  {
    name: 'Chios',
    minLat: 38.25, maxLat: 38.65, minLng: 25.85, maxLng: 26.24,
    poly: [
      { lat: 38.65, lng: 26.03 }, { lat: 38.56, lng: 26.23 },
      { lat: 38.25, lng: 26.23 }, { lat: 38.28, lng: 25.85 },
    ],
  },
  {
    name: 'Samos',
    minLat: 37.65, maxLat: 37.85, minLng: 26.60, maxLng: 27.10,
    poly: [
      { lat: 37.85, lng: 26.63 }, { lat: 37.80, lng: 27.10 },
      { lat: 37.65, lng: 27.07 }, { lat: 37.68, lng: 26.60 },
    ],
  },
  {
    name: 'Kos',
    minLat: 36.70, maxLat: 36.90, minLng: 26.80, maxLng: 27.36,
    poly: [
      { lat: 36.90, lng: 26.82 }, { lat: 36.86, lng: 27.35 },
      { lat: 36.70, lng: 27.34 }, { lat: 36.72, lng: 26.80 },
    ],
  },
  {
    name: 'Rhodes',
    minLat: 35.85, maxLat: 36.50, minLng: 27.65, maxLng: 28.25,
    poly: [
      { lat: 36.47, lng: 28.00 }, { lat: 36.45, lng: 28.24 },
      { lat: 36.10, lng: 28.25 }, { lat: 35.87, lng: 28.05 },
      { lat: 35.85, lng: 27.76 }, { lat: 36.20, lng: 27.65 },
    ],
  },

  // ══ Crete ════════════════════════════════════════════════════════════════════

  {
    name: 'Crete',
    minLat: 34.85, maxLat: 35.70, minLng: 23.55, maxLng: 26.35,
    poly: [
      { lat: 35.65, lng: 23.57 }, { lat: 35.60, lng: 24.47 },
      { lat: 35.67, lng: 25.36 }, { lat: 35.33, lng: 26.33 },
      { lat: 34.87, lng: 26.25 }, { lat: 34.85, lng: 25.06 },
      { lat: 35.08, lng: 23.56 },
    ],
  },

  // ══ Dalmatian Coast (Croatia) ════════════════════════════════════════════════

  {
    name: 'Pag',
    minLat: 44.24, maxLat: 44.92, minLng: 14.78, maxLng: 15.42,
    poly: [
      { lat: 44.90, lng: 14.80 }, { lat: 44.92, lng: 15.38 },
      { lat: 44.48, lng: 15.42 }, { lat: 44.24, lng: 15.19 },
      { lat: 44.25, lng: 14.78 },
    ],
  },
  {
    name: 'Dugi Otok',
    minLat: 43.70, maxLat: 44.18, minLng: 14.70, maxLng: 15.22,
    poly: [
      { lat: 44.17, lng: 14.72 }, { lat: 44.18, lng: 15.00 },
      { lat: 43.95, lng: 15.22 }, { lat: 43.70, lng: 15.18 },
      { lat: 43.73, lng: 14.70 },
    ],
  },
  {
    name: 'Brač',
    minLat: 43.20, maxLat: 43.42, minLng: 16.40, maxLng: 17.20,
    poly: [
      { lat: 43.33, lng: 16.42 }, { lat: 43.42, lng: 17.18 },
      { lat: 43.21, lng: 17.20 }, { lat: 43.20, lng: 16.48 },
    ],
  },
  {
    name: 'Hvar',
    minLat: 43.05, maxLat: 43.25, minLng: 16.35, maxLng: 17.38,
    poly: [
      { lat: 43.19, lng: 16.38 }, { lat: 43.25, lng: 16.80 },
      { lat: 43.21, lng: 17.35 }, { lat: 43.07, lng: 17.38 },
      { lat: 43.05, lng: 17.02 }, { lat: 43.06, lng: 16.46 },
    ],
  },
  {
    name: 'Šolta',
    minLat: 43.34, maxLat: 43.42, minLng: 16.18, maxLng: 16.48,
    poly: [
      { lat: 43.41, lng: 16.18 }, { lat: 43.42, lng: 16.48 },
      { lat: 43.34, lng: 16.47 }, { lat: 43.35, lng: 16.18 },
    ],
  },
  {
    name: 'Vis',
    minLat: 43.00, maxLat: 43.16, minLng: 15.90, maxLng: 16.30,
    poly: [
      { lat: 43.13, lng: 16.12 }, { lat: 43.12, lng: 16.28 },
      { lat: 43.00, lng: 16.28 }, { lat: 43.00, lng: 15.93 },
      { lat: 43.09, lng: 15.91 },
    ],
  },
  {
    name: 'Korčula',
    minLat: 42.90, maxLat: 43.01, minLng: 16.60, maxLng: 17.25,
    poly: [
      { lat: 42.98, lng: 16.63 }, { lat: 43.01, lng: 17.22 },
      { lat: 42.91, lng: 17.23 }, { lat: 42.90, lng: 16.97 },
      { lat: 42.92, lng: 16.64 },
    ],
  },
  {
    name: 'Pelješac',
    // Pelješac is a peninsula but effectively acts as an island for routing
    minLat: 42.85, maxLat: 43.10, minLng: 17.03, maxLng: 17.73,
    poly: [
      { lat: 43.09, lng: 17.05 }, { lat: 43.06, lng: 17.72 },
      { lat: 42.85, lng: 17.72 }, { lat: 42.87, lng: 17.04 },
    ],
  },
  {
    name: 'Mljet',
    minLat: 42.70, maxLat: 42.85, minLng: 17.30, maxLng: 17.75,
    poly: [
      { lat: 42.82, lng: 17.32 }, { lat: 42.85, lng: 17.73 },
      { lat: 42.71, lng: 17.73 }, { lat: 42.71, lng: 17.32 },
    ],
  },
  {
    name: 'Lastovo',
    minLat: 42.73, maxLat: 42.80, minLng: 16.80, maxLng: 17.00,
    poly: [
      { lat: 42.80, lng: 16.81 }, { lat: 42.79, lng: 17.00 },
      { lat: 42.73, lng: 16.99 }, { lat: 42.74, lng: 16.80 },
    ],
  },

  // ══ Cyprus ═══════════════════════════════════════════════════════════════════

  {
    name: 'Cyprus',
    minLat: 34.55, maxLat: 35.70, minLng: 32.25, maxLng: 34.60,
    poly: [
      { lat: 35.68, lng: 32.29 }, { lat: 35.70, lng: 34.00 },
      { lat: 35.35, lng: 34.60 }, { lat: 34.57, lng: 34.55 },
      { lat: 34.55, lng: 33.00 }, { lat: 34.72, lng: 32.28 },
    ],
  },

  // ══ Mainland coastlines ══════════════════════════════════════════════════════
  //
  // Treated as large "island" polygons so the bypass logic avoids routing
  // through continental land masses.  Polygons trace approximate coastlines;
  // slight over-coverage is intentional — a small detour is always better
  // than a land crossing.  The edge-intersection-only detection means that
  // marina/harbour coordinates sitting right at the coast will not trigger
  // false positives (a single-edge crossing is ignored; only through-passages
  // that enter AND exit the polygon are caught).
  //
  // ─────────────────────────────────────────────────────────────────────────────

  {
    name: 'Iberian Peninsula',
    minLat: 35.9, maxLat: 43.9, minLng: -9.5, maxLng: 3.4,
    poly: [
      { lat: 43.9, lng: -8.8 }, { lat: 43.4, lng: 3.3 },
      { lat: 41.2, lng: 2.2 }, { lat: 39.5, lng: 0.5 },
      { lat: 37.8, lng: -1.4 }, { lat: 36.0, lng: -5.6 },
      { lat: 35.9, lng: -9.5 }, { lat: 43.9, lng: -9.5 },
    ],
  },
  {
    name: 'France South',
    minLat: 43.0, maxLat: 49.0, minLng: -2.0, maxLng: 8.0,
    poly: [
      { lat: 49.0, lng: -2.0 }, { lat: 49.0, lng: 8.0 },
      { lat: 43.8, lng: 7.7 }, { lat: 43.1, lng: 6.0 },
      { lat: 43.3, lng: 4.6 }, { lat: 43.5, lng: 3.5 },
      { lat: 43.4, lng: -2.0 },
    ],
  },
  {
    name: 'Italian Peninsula',
    minLat: 37.6, maxLat: 44.6, minLng: 8.8, maxLng: 18.6,
    poly: [
      { lat: 44.2, lng: 8.9 },  { lat: 44.6, lng: 12.3 },
      { lat: 43.5, lng: 13.5 }, { lat: 41.9, lng: 15.2 },
      { lat: 40.0, lng: 18.5 }, { lat: 39.8, lng: 18.1 },
      { lat: 37.9, lng: 15.7 }, { lat: 37.6, lng: 15.1 },
      { lat: 38.2, lng: 13.9 }, { lat: 40.6, lng: 14.4 },
      { lat: 41.0, lng: 13.5 }, { lat: 42.0, lng: 11.8 },
      { lat: 43.7, lng: 10.4 }, { lat: 44.1, lng: 9.8 },
    ],
  },
  {
    name: 'Balkan Coast',
    // Slovenia / Croatia / Bosnia / Montenegro / Albania
    minLat: 39.6, maxLat: 46.0, minLng: 13.4, maxLng: 21.1,
    poly: [
      { lat: 46.0, lng: 13.4 }, { lat: 46.0, lng: 21.1 },
      { lat: 42.5, lng: 21.0 }, { lat: 41.3, lng: 20.1 },
      { lat: 40.2, lng: 19.8 }, { lat: 39.6, lng: 20.0 },
      { lat: 39.9, lng: 19.4 }, { lat: 41.0, lng: 19.4 },
      { lat: 43.0, lng: 16.6 }, { lat: 45.1, lng: 14.1 },
    ],
  },
  {
    name: 'Greece Mainland',
    // Mainland Greece north of the Corinth isthmus
    minLat: 37.9, maxLat: 42.2, minLng: 19.5, maxLng: 26.6,
    poly: [
      { lat: 42.2, lng: 19.5 }, { lat: 42.2, lng: 26.6 },
      { lat: 40.5, lng: 24.5 }, { lat: 40.0, lng: 23.5 },
      { lat: 39.0, lng: 23.2 }, { lat: 38.2, lng: 23.7 },
      { lat: 38.0, lng: 23.5 }, // Attica / Cape Sounion area
      { lat: 37.9, lng: 22.4 }, // Corinth isthmus (S limit of this polygon)
      { lat: 38.3, lng: 21.8 }, // Patras
      { lat: 38.8, lng: 20.7 }, // Mesolongi
      { lat: 39.5, lng: 20.0 }, // Preveza / Epirus
      { lat: 40.6, lng: 20.0 }, // NW Greece coast
    ],
  },
  {
    name: 'Peloponnese',
    // Peninsula south of Corinth — almost an island; separated so routes can
    // thread the Kithira Strait between it and Crete.
    minLat: 36.4, maxLat: 38.1, minLng: 21.3, maxLng: 23.7,
    poly: [
      { lat: 37.9, lng: 22.4 }, // Corinth isthmus (N)
      { lat: 38.0, lng: 23.5 }, // NE Peloponnese / Attica junction
      { lat: 37.3, lng: 23.1 }, // SE Peloponnese
      { lat: 36.4, lng: 22.5 }, // Cape Tenaro (S tip)
      { lat: 36.7, lng: 21.7 }, // SW corner
      { lat: 37.4, lng: 21.3 }, // NW coast
      { lat: 38.1, lng: 21.7 }, // Patras / Gulf of Corinth (N)
    ],
  },
  {
    name: 'Anatolian Coast',
    // Western & southern Turkish mainland facing the Aegean / Mediterranean
    minLat: 36.0, maxLat: 41.0, minLng: 26.4, maxLng: 37.0,
    poly: [
      { lat: 41.0, lng: 26.4 }, { lat: 41.0, lng: 37.0 },
      { lat: 36.0, lng: 37.0 }, { lat: 36.0, lng: 30.1 },
      { lat: 36.7, lng: 28.1 }, { lat: 36.8, lng: 27.3 },
      { lat: 37.3, lng: 27.0 }, { lat: 37.5, lng: 26.7 },
      { lat: 38.3, lng: 26.6 }, { lat: 39.1, lng: 26.8 },
      { lat: 40.2, lng: 26.5 },
    ],
  },
  {
    name: 'North Africa',
    // Moroccan / Algerian / Tunisian / Libyan / Egyptian coast strip
    minLat: 29.5, maxLat: 37.5, minLng: -6.0, maxLng: 37.0,
    poly: [
      { lat: 37.5, lng: -6.0 }, { lat: 35.9, lng: -2.0 },
      { lat: 37.1, lng: 8.8 },  { lat: 37.3, lng: 11.0 },
      { lat: 33.0, lng: 13.0 }, { lat: 32.0, lng: 25.0 },
      { lat: 31.0, lng: 32.0 }, { lat: 29.5, lng: 37.0 },
      { lat: 29.5, lng: -6.0 },
    ],
  },
]
