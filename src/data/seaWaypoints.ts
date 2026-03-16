/**
 * seaWaypoints.ts
 *
 * Intermediate sea waypoints to insert between route legs so that the
 * map polyline stays over water and does not visually cross islands.
 *
 * Key format:  `${routeId}:${fromSequence}-${toSequence}`
 * Value:       Ordered array of {lat, lng} points to splice in between
 *              the two main RoutePoint markers.
 *
 * Only legs that would otherwise draw a straight line through a landmass
 * need an entry here.  Open-water crossings are fine as-is.
 */

export interface SeaWaypoint {
  lat: number
  lng: number
}

/**
 * Look up sea waypoints for a given route leg.
 * Returns undefined when no correction is needed (leg is already over water).
 */
export function getSeaWaypoints(
  routeId: string,
  fromSeq: number,
  toSeq: number,
): SeaWaypoint[] | undefined {
  return SEA_WAYPOINTS[`${routeId}:${fromSeq}-${toSeq}`]
}

// ─────────────────────────────────────────────────────────────────────────────
// Waypoint data
// ─────────────────────────────────────────────────────────────────────────────

const SEA_WAYPOINTS: Record<string, SeaWaypoint[]> = {

  // ══════════════════════════════════════════════════════════════════════════
  // BALEARIC DISCOVERY  (balearic-discovery)
  // ══════════════════════════════════════════════════════════════════════════

  // Leg 1 → 2 : Palma de Mallorca (NW coast) → Cala Mondragó (SE coast)
  // Direct line would cut straight across the mountains of central Mallorca.
  // Fix: hug the south coast around Cap Blanc → Cap de ses Salines.
  'balearic-discovery:1-2': [
    { lat: 39.47, lng: 2.74 }, // leaving Palma Bay heading SE
    { lat: 39.36, lng: 2.84 }, // Cap Blanc — southernmost mainland point
    { lat: 39.32, lng: 3.09 }, // off Cala Pi, before SE corner
  ],

  // Leg 2 → 3 : Cala Mondragó (SE Mallorca) → Ibiza Town
  // Direct line passes through southern Mallorca then cuts across the channel.
  // Fix: pass south of Cap de ses Salines then open-water to Ibiza.
  'balearic-discovery:2-3': [
    { lat: 39.26, lng: 3.04 }, // south of Cap de ses Salines
    { lat: 39.02, lng: 2.50 }, // open water mid-channel
    { lat: 38.96, lng: 1.90 }, // approaching Ibiza from the east
  ],

  // Leg 3 → 4 : Ibiza Town → Ses Illetes, Formentera
  // Ibiza's southern tip (Punta des Jondal, ~38.86°N) sits on the direct path.
  // Fix: nudge east of the tip and into the open Ibiza–Formentera strait.
  'balearic-discovery:3-4': [
    { lat: 38.84, lng: 1.44 }, // open water just east of Ibiza's southern tip
  ],

  // Leg 4 → 5 : Ses Illetes (N Formentera) → Cala Saona (SW Formentera)
  // The direct line runs straight across the narrow island body.
  // Fix: loop south of the island, then approach Cala Saona from open water.
  'balearic-discovery:4-5': [
    { lat: 38.64, lng: 1.41 }, // south of Formentera's coast
    { lat: 38.64, lng: 1.34 }, // rounding the SW corner
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // BALEARIC EASY EXPLORER  (balearic-easy-explorer)
  // ══════════════════════════════════════════════════════════════════════════

  // Leg 1 → 2 : Palma → Cabrera Island
  // Cabrera lies south of Mallorca; straight line crosses the SE highlands.
  // Fix: follow the south coast then drop down to Cabrera.
  'balearic-easy-explorer:1-2': [
    { lat: 39.47, lng: 2.74 }, // leaving Palma Bay heading SE
    { lat: 39.36, lng: 2.84 }, // Cap Blanc
    { lat: 39.27, lng: 3.00 }, // off the SE coast before turning south
  ],

  // Leg 3 → 4 : Ibiza Town → Ses Illetes, Formentera
  'balearic-easy-explorer:3-4': [
    { lat: 38.84, lng: 1.44 }, // open water east of Ibiza's southern tip
  ],

  // Leg 4 → 5 : Ses Illetes → Cala Comte (NW Ibiza)
  // Direct line cuts across western Ibiza.
  // Fix: head south around Ibiza's SW coast then north along the western shore.
  'balearic-easy-explorer:4-5': [
    { lat: 38.73, lng: 1.38 }, // south of Ses Variades / SW Ibiza coast
    { lat: 38.79, lng: 1.22 }, // open water off Ibiza's west coast
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // BALEARIC ISLANDS EAST  (balearic-islands-east)
  // ══════════════════════════════════════════════════════════════════════════

  // Leg 1 → 2 : Palma → Cala d'Or (SE Mallorca)
  // Same NW → SE island crossing as balearic-discovery Leg 1-2.
  'balearic-islands-east:1-2': [
    { lat: 39.47, lng: 2.74 }, // leaving Palma Bay heading SE
    { lat: 39.36, lng: 2.84 }, // Cap Blanc
    { lat: 39.33, lng: 3.12 }, // off Cala Pi, before Cala d'Or
  ],

  // Leg 5 → 6 : Mahon (E Menorca) → Ciutadella (W Menorca)
  // Direct line passes straight through the centre of Menorca.
  // Fix: drop south below the island then come back up to Ciutadella.
  'balearic-islands-east:5-6': [
    { lat: 39.80, lng: 4.24 }, // south of Mahon harbour
    { lat: 39.77, lng: 4.00 }, // south coast mid-island
    { lat: 39.82, lng: 3.84 }, // approaching Ciutadella from the south
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // BALEARIC ISLANDS WEST  (balearic-islands-west)
  // ══════════════════════════════════════════════════════════════════════════

  // Leg 5 → 6 : Espalmador → Cabrera National Park
  // Long northeastward crossing; mostly open water, no correction needed.
  // (no entry required)

  // Leg 6 → 7 : Cabrera → Palma
  // Approaches from the south; enters Palma Bay from the SW — open water.
  // (no entry required)

}
