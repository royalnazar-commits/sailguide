/**
 * PlaceMarker — custom map pin for react-native-maps.
 *
 * WHY NO IONICONS:
 * Font-based icon libraries (@expo/vector-icons, Ionicons) render glyphs
 * via the JS thread. react-native-maps captures Marker children as a native
 * bitmap snapshot. When tracksViewChanges={false} the snapshot is taken once,
 * often before the font has loaded → every glyph appears as "?" (missing char).
 *
 * Solution: draw every icon as pure View / border shapes. No text, no fonts,
 * no external assets → always renders correctly on first paint.
 *
 * SHAPE:
 * A teardrop pin — circular bubble on top + downward-pointing triangle at bottom.
 * The triangle tip sits exactly on the geographic coordinate.
 * Anchor must be set to MARKER_ANCHOR = { x: 0.5, y: 1.0 } on the Marker.
 */

import React from 'react'
import { View, StyleSheet } from 'react-native'
import {
  CanonicalPlaceType,
  CANONICAL_PLACE_TYPES,
  getPlaceTypeMeta,
  normalizePlaceType,
} from '../constants/placeTypes'

// ── Type config ───────────────────────────────────────────────────────────────

interface Config { color: string }

export const PLACE_CONFIG: Record<CanonicalPlaceType, Config> = Object.fromEntries(
  CANONICAL_PLACE_TYPES.map((t) => [t, { color: getPlaceTypeMeta(t).color }]),
) as Record<CanonicalPlaceType, Config>

/**
 * Anchor for Marker when using PlaceMarker.
 * y: 1.0 means the bottom of the rendered view (the teardrop tip) maps to
 * the geographic coordinate — so the tip sits exactly on the location.
 */
export const MARKER_ANCHOR = { x: 0.5, y: 1.0 } as const

// ── Inner icon components (pure Views, no fonts) ──────────────────────────────

/**
 * Anchor shape for MARINA.
 */
function AnchorIcon({ s }: { s: number }) {
  const lw  = Math.max(1.5, s * 0.13)
  const rW  = s * 0.46
  const rH  = s * 0.32
  const rL  = (s - rW) / 2
  const shL = (s - lw) / 2
  const shT = rH * 0.6
  const shH = s - shT
  const stL = s * 0.06
  const stW = s - stL * 2
  const stT = shT + shH * 0.38

  return (
    <View style={{ width: s, height: s }}>
      <View style={{ position: 'absolute', left: rL, top: 0, width: rW, height: rH, borderRadius: rW / 2, borderWidth: lw, borderColor: '#fff' }} />
      <View style={{ position: 'absolute', left: shL, top: shT, width: lw, height: shH, backgroundColor: '#fff' }} />
      <View style={{ position: 'absolute', left: stL, top: stT, width: stW, height: lw, backgroundColor: '#fff', borderRadius: lw / 2 }} />
    </View>
  )
}

/**
 * Mooring buoy for ANCHORAGE.
 */
function AnchorageIcon({ s }: { s: number }) {
  const lw      = Math.max(1.5, s * 0.12)
  const floatR  = s * 0.18
  const cx      = s / 2
  const floatT  = s * 0.10
  const lineTop = floatT + floatR * 2
  const lineH   = s * 0.40
  const baseW   = s * 0.56

  return (
    <View style={{ width: s, height: s }}>
      <View style={{ position: 'absolute', left: cx - floatR, top: floatT, width: floatR * 2, height: floatR * 2, borderRadius: floatR, backgroundColor: '#fff' }} />
      <View style={{ position: 'absolute', left: cx - lw / 2, top: lineTop, width: lw, height: lineH, backgroundColor: '#fff' }} />
      <View style={{ position: 'absolute', left: cx - baseW / 2, top: lineTop + lineH, width: baseW, height: lw, backgroundColor: '#fff', borderRadius: lw / 2 }} />
    </View>
  )
}

/**
 * Three wave arcs for BAY.
 */
function WaveIcon({ s }: { s: number }) {
  const lw   = Math.max(1.5, s * 0.13)
  const n    = 3
  const bW   = s * 0.24
  const bH   = s * 0.52
  const gap  = (s - n * bW) / (n + 1)
  const topY = (s - bH) / 2 - lw * 0.5

  return (
    <View style={{ width: s, height: s }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            position: 'absolute', left: gap + i * (bW + gap), top: topY,
            width: bW, height: bH,
            borderTopLeftRadius: bW / 2, borderTopRightRadius: bW / 2,
            borderTopWidth: lw, borderLeftWidth: lw, borderRightWidth: lw,
            borderBottomWidth: 0, borderColor: '#fff',
          }}
        />
      ))}
    </View>
  )
}

/**
 * Flag icon for POI / landmark.
 */
function FlagIcon({ s }: { s: number }) {
  const lw      = Math.max(1.5, s * 0.12)
  const staffX  = s * 0.22
  const flagW   = s * 0.55
  const flagH   = s * 0.36
  const flagTop = s * 0.10
  const staffH  = s * 0.82

  return (
    <View style={{ width: s, height: s }}>
      <View style={{ position: 'absolute', left: staffX + lw, top: flagTop, width: flagW, height: flagH, backgroundColor: '#fff', borderRadius: 2 }} />
      <View style={{ position: 'absolute', left: staffX, top: flagTop, width: lw, height: staffH, backgroundColor: '#fff', borderRadius: lw / 2 }} />
    </View>
  )
}

/**
 * Ring + centre dot for LAGOON.
 */
function LagoonIcon({ s }: { s: number }) {
  const lw   = Math.max(1.5, s * 0.12)
  const r    = s * 0.38
  const cx   = s / 2
  const cy   = s * 0.48
  const dotR = s * 0.10

  return (
    <View style={{ width: s, height: s }}>
      <View style={{ position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r, borderWidth: lw, borderColor: '#fff' }} />
      <View style={{ position: 'absolute', left: cx - dotR, top: cy - dotR, width: dotR * 2, height: dotR * 2, borderRadius: dotR, backgroundColor: '#fff' }} />
    </View>
  )
}

/**
 * Goggles icon for SNORKELING.
 */
function SnorkelingIcon({ s }: { s: number }) {
  const lw      = Math.max(1.5, s * 0.12)
  const strapW  = s * 0.05
  const lensW   = s * 0.28
  const lensH   = s * 0.38
  const bridge  = s * 0.08
  const leftOff = (s - 2 * strapW - 2 * lensW - bridge) / 2
  const lensTop = s * 0.31

  return (
    <View style={{ width: s, height: s }}>
      <View style={{ position: 'absolute', left: leftOff, top: lensTop + lensH * 0.38, width: strapW, height: lw, backgroundColor: '#fff' }} />
      <View style={{ position: 'absolute', left: leftOff + strapW, top: lensTop, width: lensW, height: lensH, borderRadius: lensW * 0.42, borderWidth: lw, borderColor: '#fff' }} />
      <View style={{ position: 'absolute', left: leftOff + strapW + lensW, top: lensTop + lensH * 0.38, width: bridge, height: lw, backgroundColor: '#fff' }} />
      <View style={{ position: 'absolute', left: leftOff + strapW + lensW + bridge, top: lensTop, width: lensW, height: lensH, borderRadius: lensW * 0.42, borderWidth: lw, borderColor: '#fff' }} />
      <View style={{ position: 'absolute', left: leftOff + strapW + lensW + bridge + lensW, top: lensTop + lensH * 0.38, width: strapW, height: lw, backgroundColor: '#fff' }} />
    </View>
  )
}

/**
 * Beach umbrella for BEACH.
 */
function UmbrellaIcon({ s }: { s: number }) {
  const lw      = Math.max(1.5, s * 0.12)
  const canopyW = s * 0.76
  const canopyH = s * 0.38
  const canopyL = (s - canopyW) / 2
  const canopyT = s * 0.14
  const stickX  = s / 2 - lw / 2
  const stickT  = canopyT + canopyH * 0.72
  const stickH  = s * 0.54

  return (
    <View style={{ width: s, height: s }}>
      <View style={{
        position: 'absolute', left: canopyL, top: canopyT,
        width: canopyW, height: canopyH,
        borderTopLeftRadius: canopyW / 2, borderTopRightRadius: canopyW / 2,
        borderTopWidth: lw, borderLeftWidth: lw, borderRightWidth: lw,
        borderBottomWidth: 0, borderColor: '#fff',
      }} />
      <View style={{ position: 'absolute', left: stickX, top: stickT, width: lw, height: stickH, backgroundColor: '#fff', borderRadius: lw / 2 }} />
    </View>
  )
}

/**
 * Cave arch icon for CAVE.
 */
function CaveIcon({ s }: { s: number }) {
  const lw    = Math.max(1.5, s * 0.13)
  const archW = s * 0.70
  const archH = s * 0.62
  const archL = (s - archW) / 2
  const archT = s * 0.10

  return (
    <View style={{ width: s, height: s }}>
      <View style={{
        position: 'absolute', left: archL, top: archT,
        width: archW, height: archH,
        borderTopLeftRadius: archW / 2, borderTopRightRadius: archW / 2,
        borderTopWidth: lw, borderLeftWidth: lw, borderRightWidth: lw,
        borderBottomWidth: 0, borderColor: '#fff',
      }} />
      <View style={{ position: 'absolute', left: archL - lw, top: archT + archH, width: archW + lw * 2, height: lw, backgroundColor: '#fff', borderRadius: lw / 2 }} />
    </View>
  )
}

// ── Icon selector ─────────────────────────────────────────────────────────────

function PlaceIcon({ type, size }: { type: CanonicalPlaceType; size: number }) {
  switch (type) {
    case 'MARINA':     return <AnchorIcon      s={size} />
    case 'ANCHORAGE':  return <AnchorageIcon   s={size} />
    case 'BAY':        return <WaveIcon        s={size} />
    case 'POI':        return <FlagIcon        s={size} />
    case 'BEACH':      return <UmbrellaIcon    s={size} />
    case 'CAVE':       return <CaveIcon        s={size} />
    case 'LAGOON':     return <LagoonIcon      s={size} />
    case 'SNORKELING': return <SnorkelingIcon  s={size} />
    default:           return <FlagIcon        s={size} />
  }
}

// ── Marker ───────────────────────────────────────────────────────────────────

interface Props {
  /** Accepts any raw string — normalised internally, never crashes */
  type: string
  selected?: boolean
  /** When true, shows a small lock badge on the pin */
  isPremium?: boolean
}

export function PlaceMarker({ type, selected = false, isPremium = false }: Props) {
  const canonical = normalizePlaceType(type)
  const { color } = PLACE_CONFIG[canonical]

  // Selected markers are larger and have a white border ring.
  const BUBBLE = selected ? 38 : 30
  const ICON   = selected ? 18 : 14
  // Teardrop pointer dimensions
  const PTR_W  = selected ? 8  : 6   // half-width of downward triangle
  const PTR_H  = selected ? 11 : 9   // height of downward triangle

  return (
    <View style={styles.wrapper}>
      {/* Circular bubble */}
      <View
        style={[
          styles.bubble,
          {
            width:           BUBBLE,
            height:          BUBBLE,
            borderRadius:    BUBBLE / 2,
            backgroundColor: color,
            borderWidth:     selected ? 2.5 : 0,
            borderColor:     '#fff',
            shadowOpacity:   selected ? 0.40 : 0.22,
            shadowRadius:    selected ? 9    : 4,
            elevation:       selected ? 8    : 5,
          },
        ]}
      >
        <PlaceIcon type={canonical} size={ICON} />
      </View>

      {/* Teardrop pointer — downward-pointing triangle via zero-size borders */}
      <View
        style={{
          width:            0,
          height:           0,
          borderLeftWidth:  PTR_W,
          borderRightWidth: PTR_W,
          borderTopWidth:   PTR_H,
          borderLeftColor:  'transparent',
          borderRightColor: 'transparent',
          borderTopColor:   color,
          marginTop:        -1,   // overlap 1px to avoid hairline gap
        }}
      />

      {isPremium && <LockBadge />}
    </View>
  )
}

/**
 * Lock-shaped badge for premium places.
 */
function LockBadge() {
  const S  = 13
  const bW = S * 0.42
  const bH = S * 0.35
  const bL = (S - bW) / 2
  const bT = S * 0.48
  const lw = Math.max(1.2, S * 0.12)
  const sW = bW * 0.55
  const sH = S * 0.30
  const sL = (S - sW - lw * 2) / 2 + lw / 2
  const sT = bT - sH + lw * 0.5

  return (
    <View style={[styles.lockBadge, { width: S, height: S, borderRadius: S / 2 }]}>
      <View style={{
        position: 'absolute', left: sL, top: sT,
        width: sW, height: sH,
        borderTopLeftRadius: sW / 2, borderTopRightRadius: sW / 2,
        borderTopWidth: lw, borderLeftWidth: lw, borderRightWidth: lw, borderBottomWidth: 0,
        borderColor: '#fff',
      }} />
      <View style={{
        position: 'absolute', left: bL, top: bT,
        width: bW, height: bH,
        borderRadius: 2, backgroundColor: '#fff',
      }} />
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    // No overflow: 'hidden' — the lock badge overflows intentionally
  },
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
  },
  lockBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F59E0B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
})
