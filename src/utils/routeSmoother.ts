/**
 * routeSmoother — coordinate smoothing utilities for maritime route rendering.
 *
 * Provides Chaikin corner-cutting to transform sharp polyline joints into
 * smooth, organic-looking curves — no extra dependencies, runs synchronously.
 */

export type Coord = { latitude: number; longitude: number }

// ── Chaikin smoothing ─────────────────────────────────────────────────────────

/** One pass of Chaikin corner-cutting. Endpoints stay fixed. */
function chaikin(pts: Coord[]): Coord[] {
  if (pts.length < 3) return pts
  const out: Coord[] = [pts[0]]
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    out.push({
      latitude:  0.75 * a.latitude  + 0.25 * b.latitude,
      longitude: 0.75 * a.longitude + 0.25 * b.longitude,
    })
    out.push({
      latitude:  0.25 * a.latitude  + 0.75 * b.latitude,
      longitude: 0.25 * a.longitude + 0.75 * b.longitude,
    })
  }
  out.push(pts[pts.length - 1])
  return out
}

/**
 * Apply `passes` iterations of Chaikin corner-cutting.
 * Each pass doubles the point count and rounds joints further.
 * 2 passes gives a good balance of smoothness vs. fidelity.
 */
export function chaikinSmooth(pts: Coord[], passes = 2): Coord[] {
  let result = pts
  for (let i = 0; i < passes; i++) result = chaikin(result)
  return result
}

// ── Bearing ───────────────────────────────────────────────────────────────────

/**
 * Geodesic bearing from A → B (degrees, 0 = north, clockwise).
 * Used to orient direction arrows along the route.
 */
export function bearing(a: Coord, b: Coord): number {
  const φ1 = a.latitude  * (Math.PI / 180)
  const φ2 = b.latitude  * (Math.PI / 180)
  const Δλ  = (b.longitude - a.longitude) * (Math.PI / 180)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * (180 / Math.PI)) + 360) % 360
}

// ── Arrow placement ────────────────────────────────────────────────────────────

/**
 * Returns indices into `coords` where direction arrows should sit.
 * Distributes `count` evenly, always skipping first and last points.
 */
export function arrowIndices(coords: Coord[], count: number): number[] {
  if (coords.length < 3 || count < 1) return []
  // Minimum spacing: at least 3 points between arrows so they don't crowd together
  const minSpacing = Math.max(3, Math.floor(coords.length / (count + 1)))
  const out: number[] = []
  let next = minSpacing
  while (next < coords.length - 1 && out.length < count) {
    out.push(next)
    next += minSpacing
  }
  return out
}

// ── Leg-by-leg coordinate builder ─────────────────────────────────────────────

/**
 * Chain per-leg coordinate arrays into a single continuous path.
 * `legFn(fromLat, fromLng, toLat, toLng)` is called for each consecutive
 * stop pair and may return any number of intermediate points.
 * The first point of each leg (= last point of previous leg) is deduplicated.
 */
export function buildChainedPath(
  stops: { lat: number; lng: number }[],
  legFn: (fromLat: number, fromLng: number, toLat: number, toLng: number) => Coord[],
): Coord[] {
  if (stops.length === 0) return []
  const result: Coord[] = [{ latitude: stops[0].lat, longitude: stops[0].lng }]
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1], curr = stops[i]
    const leg  = legFn(prev.lat, prev.lng, curr.lat, curr.lng)
    // Skip the first point of each leg (already present from previous leg's tail)
    for (let j = 1; j < leg.length; j++) result.push(leg[j])
  }
  return result
}
