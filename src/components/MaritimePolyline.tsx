/**
 * MaritimePolyline — nautical-styled route line for react-native-maps.
 *
 * Visual design (three layers, bottom to top):
 *
 *  1. Glow       — wide, very transparent copy of the main line.
 *                  Creates the soft "depth" halo seen on chart-plotter apps.
 *  2. Main line  — the actual route at the configured weight and dash style.
 *  3. Direction arrows — small flat chevrons placed at even intervals along
 *                  the smoothed path, rotated to face the direction of travel.
 *
 * Smoothing:
 *  Chaikin corner-cutting is applied to the raw coordinate array before
 *  rendering.  Even two or three straight segments get smooth, organic curves
 *  at their joints — no external dependency required.
 *
 * Usage:
 *  <MaritimePolyline coordinates={coords} />
 *  <MaritimePolyline coordinates={coords} color="#F97316" dash showArrows={false} />
 */

import React, { useMemo } from 'react'
import { View } from 'react-native'
import { Marker, Polyline } from 'react-native-maps'
import { chaikinSmooth, bearing, arrowIndices } from '../utils/routeSmoother'

export type Coord = { latitude: number; longitude: number }

// ── Props ─────────────────────────────────────────────────────────────────────

interface MaritimePolylineProps {
  coordinates: Coord[]

  /** Main line colour. Defaults to the nautical cyan used throughout the app. */
  color?: string

  /**
   * Chaikin smoothing passes applied to coordinates before rendering.
   * 0 = raw straight segments.  1-2 = natural curves (default 2).
   */
  smoothPasses?: number

  /** When true, dashes the main line (good for draft / user-created routes). */
  dash?: boolean

  /**
   * Render directional chevrons along the route (default true).
   * Set false for liteMode preview maps — Markers don't render in liteMode.
   */
  showArrows?: boolean

  /** Maximum number of direction arrows distributed along the route. */
  arrowCount?: number

  /** Main line stroke width in logical pixels (default 3.5). */
  strokeWidth?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Bright nautical cyan — matches Colors.routeLine and Colors.accent */
const DEFAULT_COLOR  = '#00B4D8'
const DASH_PATTERN   = [16, 8] as const  // long dash, short gap — readable at all zoom levels
const GLOW_OPACITY   = 0.22              // alpha channel as fraction → ~26 of 255

// ── Arrow chevron (pure-View, no font dependency) ─────────────────────────────

/**
 * Upward-pointing triangle rendered via the zero-size border trick.
 * The Marker's `rotation` prop rotates it to face the direction of travel,
 * and `flat={true}` pins it to the map plane so it honours compass bearings.
 */
function DirectionArrow() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 2 }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 4,
          borderRightWidth: 4,
          borderBottomWidth: 7,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: 'rgba(255,255,255,0.90)',
        }}
      />
    </View>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MaritimePolyline({
  coordinates,
  color      = DEFAULT_COLOR,
  smoothPasses = 2,
  dash       = false,
  showArrows = true,
  arrowCount = 5,
  strokeWidth = 3.5,
}: MaritimePolylineProps) {
  // Apply Chaikin smoothing to the raw coordinate array
  const smoothed = useMemo(
    () => (smoothPasses > 0 ? chaikinSmooth(coordinates, smoothPasses) : coordinates),
    [coordinates, smoothPasses],
  )

  // Arrow positions: (coordinate + bearing) for each arrow along the smoothed path
  const arrows = useMemo(() => {
    if (!showArrows || smoothed.length < 3) return []
    return arrowIndices(smoothed, arrowCount).map((idx) => {
      // Use the segment just before the arrow point for bearing
      const prev = smoothed[Math.max(0, idx - 1)]
      const next = smoothed[Math.min(smoothed.length - 1, idx + 1)]
      return {
        coordinate: smoothed[idx],
        rotation:   bearing(prev, next),
      }
    })
  }, [smoothed, showArrows, arrowCount])

  if (smoothed.length < 2) return null

  // Glow colour: same hue at low opacity
  // Append a 2-digit hex opacity suffix to the colour string
  const glowAlpha  = Math.round(GLOW_OPACITY * 255).toString(16).padStart(2, '0')
  const glowColor  = color.startsWith('#') && color.length === 7
    ? `${color}${glowAlpha}`
    : color
  const glowWidth  = strokeWidth * 3.2

  const dashPattern = dash ? (DASH_PATTERN as number[]) : undefined

  return (
    <>
      {/* ── Layer 1: glow halo ── */}
      <Polyline
        coordinates={smoothed}
        strokeColor={glowColor}
        strokeWidth={glowWidth}
        lineCap="round"
        lineJoin="round"
      />

      {/* ── Layer 2: main route line ── */}
      <Polyline
        coordinates={smoothed}
        strokeColor={color}
        strokeWidth={strokeWidth}
        lineCap="round"
        lineJoin="round"
        lineDashPattern={dashPattern}
      />

      {/* ── Layer 3: direction chevrons ── */}
      {arrows.map(({ coordinate, rotation }, i) => (
        <Marker
          key={`arrow-${i}`}
          coordinate={coordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          rotation={rotation}
          flat
        >
          <DirectionArrow />
        </Marker>
      ))}
    </>
  )
}
