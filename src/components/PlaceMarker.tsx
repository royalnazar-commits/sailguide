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
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import {
  CanonicalPlaceType,
  CANONICAL_PLACE_TYPES,
  getPlaceTypeMeta,
  normalizePlaceType,
} from '../constants/placeTypes'

// ── Emoji per place type (each type must be visually distinct) ────────────────
const PLACE_EMOJI: Record<CanonicalPlaceType, string> = {
  MARINA:     '⚓',
  ANCHORAGE:  '⚓',
  BAY:        '🌊',
  POI:        '📍',
  BEACH:      '🏖',
  CAVE:       '🦇',
  LAGOON:     '🏝',
  SNORKELING: '🤿',
}

// ── Type config ───────────────────────────────────────────────────────────────
// Derived from the central registry — single source of truth for colors.

interface Config { color: string }

export const PLACE_CONFIG: Record<CanonicalPlaceType, Config> = Object.fromEntries(
  CANONICAL_PLACE_TYPES.map((t) => [t, { color: getPlaceTypeMeta(t).color }]),
) as Record<CanonicalPlaceType, Config>

// ── Inner icon components (pure Views, no fonts) ──────────────────────────────

/**
 * Anchor shape for MARINA.
 * Anatomy: oval ring at top + vertical shaft + horizontal stock (crossbar).
 * The three elements together read unmistakably as ⚓ at any size ≥ 14px.
 */
function AnchorIcon({ s }: { s: number }) {
  const lw  = Math.max(1.5, s * 0.13)   // line weight
  const rW  = s * 0.46                  // ring width
  const rH  = s * 0.32                  // ring height
  const rL  = (s - rW) / 2             // ring left
  const shL = (s - lw) / 2             // shaft centre-x
  const shT = rH * 0.6                  // shaft starts inside ring
  const shH = s - shT                   // shaft height to bottom
  const stL = s * 0.06                  // stock (crossbar) left edge
  const stW = s - stL * 2              // stock width
  const stT = shT + shH * 0.38        // stock vertical position

  return (
    <View style={{ width: s, height: s }}>
      {/* Ring */}
      <View style={{
        position: 'absolute', left: rL, top: 0,
        width: rW, height: rH,
        borderRadius: rW / 2,
        borderWidth: lw, borderColor: '#fff',
      }} />
      {/* Shaft */}
      <View style={{
        position: 'absolute', left: shL, top: shT,
        width: lw, height: shH, backgroundColor: '#fff',
      }} />
      {/* Stock (crossbar) */}
      <View style={{
        position: 'absolute', left: stL, top: stT,
        width: stW, height: lw, backgroundColor: '#fff',
        borderRadius: lw / 2,
      }} />
    </View>
  )
}

/**
 * Anchor with chain dot for ANCHORAGE.
 * Same anchor but slightly trimmer stock + a small filled circle at the
 * bottom of the shaft — suggests a chain end / seafloor contact.
 * The colour difference (green vs navy) makes marina vs anchorage distinct.
 */
function AnchorageIcon({ s }: { s: number }) {
  const lw  = Math.max(1.5, s * 0.13)
  const rW  = s * 0.42
  const rH  = s * 0.30
  const rL  = (s - rW) / 2
  const shL = (s - lw) / 2
  const shT = rH * 0.55
  const shH = s * 0.62
  const stL = s * 0.12
  const stW = s - stL * 2
  const stT = shT + shH * 0.40
  const dotR = lw * 1.6              // small dot at base of shaft
  const dotL = (s - dotR * 2) / 2
  const dotT = shT + shH - dotR

  return (
    <View style={{ width: s, height: s }}>
      {/* Ring */}
      <View style={{
        position: 'absolute', left: rL, top: 0,
        width: rW, height: rH,
        borderRadius: rW / 2,
        borderWidth: lw, borderColor: '#fff',
      }} />
      {/* Shaft */}
      <View style={{
        position: 'absolute', left: shL, top: shT,
        width: lw, height: shH, backgroundColor: '#fff',
      }} />
      {/* Stock */}
      <View style={{
        position: 'absolute', left: stL, top: stT,
        width: stW, height: lw, backgroundColor: '#fff',
        borderRadius: lw / 2,
      }} />
      {/* Chain dot */}
      <View style={{
        position: 'absolute', left: dotL, top: dotT,
        width: dotR * 2, height: dotR * 2,
        borderRadius: dotR, backgroundColor: '#fff',
      }} />
    </View>
  )
}

/**
 * Three wave arcs for BAY.
 * Each arc is a rectangle with rounded top corners only — drawn with
 * borderTopWidth + borderLeftWidth + borderRightWidth (no borderBottomWidth).
 * Three side-by-side arcs read as ≈ / water waves on any screen size.
 */
function WaveIcon({ s }: { s: number }) {
  const lw   = Math.max(1.5, s * 0.13)
  const n    = 3                          // number of arcs
  const bW   = s * 0.24                  // arc width
  const bH   = s * 0.52                  // arc height
  const gap  = (s - n * bW) / (n + 1)   // spacing between arcs
  const topY = (s - bH) / 2 - lw * 0.5 // vertical centre

  return (
    <View style={{ width: s, height: s }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left:  gap + i * (bW + gap),
            top:   topY,
            width: bW,
            height: bH,
            borderTopLeftRadius:  bW / 2,
            borderTopRightRadius: bW / 2,
            borderTopWidth:   lw,
            borderLeftWidth:  lw,
            borderRightWidth: lw,
            borderBottomWidth: 0,
            borderColor: '#fff',
          }}
        />
      ))}
    </View>
  )
}

/**
 * Four-pointed star for POI.
 * Four slim rectangles radiating from the centre at 0°, 45°, 90°, 135°.
 * Reads as ✦ / ★ at any size ≥ 14px. No SVG needed.
 */
function StarIcon({ s }: { s: number }) {
  const armW = s * 0.18            // arm thickness
  const armH = s * 0.82            // arm length
  const cx   = (s - armW) / 2     // arm left when horizontal
  const cy   = (s - armH) / 2     // arm top when vertical
  const br   = armW / 2            // border radius on arm ends

  const arm = {
    position: 'absolute' as const,
    width: armW, height: armH,
    backgroundColor: '#fff',
    borderRadius: br,
    left: cx, top: cy,
  }

  return (
    <View style={{ width: s, height: s }}>
      <View style={arm} />
      <View style={[arm, { transform: [{ rotate: '90deg' }] }]} />
      <View style={[arm, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[arm, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  )
}

/**
 * Ring + centre dot for LAGOON.
 * An outer circle (shoreline) with a small filled circle inside reads unmistakably
 * as a bird's-eye view of an enclosed lagoon or lake.
 */
function LagoonIcon({ s }: { s: number }) {
  const lw   = Math.max(1.5, s * 0.12)
  const r    = s * 0.38
  const cx   = s / 2
  const cy   = s * 0.48
  const dotR = s * 0.10

  return (
    <View style={{ width: s, height: s }}>
      {/* Outer ring */}
      <View style={{
        position: 'absolute', left: cx - r, top: cy - r,
        width: r * 2, height: r * 2, borderRadius: r,
        borderWidth: lw, borderColor: '#fff',
      }} />
      {/* Centre dot (still water) */}
      <View style={{
        position: 'absolute', left: cx - dotR, top: cy - dotR,
        width: dotR * 2, height: dotR * 2, borderRadius: dotR,
        backgroundColor: '#fff',
      }} />
    </View>
  )
}

/**
 * Goggles icon for SNORKELING.
 * Two oval lenses connected by a bridge + side straps.
 * Reads instantly as a snorkel mask at any size ≥ 14px.
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
      {/* Left strap */}
      <View style={{
        position: 'absolute', left: leftOff, top: lensTop + lensH * 0.38,
        width: strapW, height: lw, backgroundColor: '#fff',
      }} />
      {/* Left lens */}
      <View style={{
        position: 'absolute', left: leftOff + strapW, top: lensTop,
        width: lensW, height: lensH, borderRadius: lensW * 0.42,
        borderWidth: lw, borderColor: '#fff',
      }} />
      {/* Bridge */}
      <View style={{
        position: 'absolute', left: leftOff + strapW + lensW, top: lensTop + lensH * 0.38,
        width: bridge, height: lw, backgroundColor: '#fff',
      }} />
      {/* Right lens */}
      <View style={{
        position: 'absolute', left: leftOff + strapW + lensW + bridge, top: lensTop,
        width: lensW, height: lensH, borderRadius: lensW * 0.42,
        borderWidth: lw, borderColor: '#fff',
      }} />
      {/* Right strap */}
      <View style={{
        position: 'absolute', left: leftOff + strapW + lensW + bridge + lensW,
        top: lensTop + lensH * 0.38, width: strapW, height: lw, backgroundColor: '#fff',
      }} />
    </View>
  )
}

/**
 * Sunrise icon for BEACH.
 * A filled circle (sun) above a horizon line with two small wave arcs below.
 */
function SunriseIcon({ s }: { s: number }) {
  const lw = Math.max(1.5, s * 0.12)
  const r  = s * 0.24
  const cx = s / 2
  const cy = s * 0.36

  return (
    <View style={{ width: s, height: s }}>
      {/* Sun disc */}
      <View style={{
        position: 'absolute', left: cx - r, top: cy - r,
        width: r * 2, height: r * 2, borderRadius: r,
        backgroundColor: '#fff',
      }} />
      {/* Horizon */}
      <View style={{
        position: 'absolute', left: s * 0.08, top: cy + r + lw,
        width: s * 0.84, height: lw, backgroundColor: '#fff', borderRadius: lw / 2,
      }} />
      {/* Two wave arcs */}
      {[0, 1].map((i) => (
        <View key={i} style={{
          position: 'absolute',
          left: s * 0.09 + i * (s * 0.43),
          top: cy + r + lw * 3,
          width: s * 0.38, height: s * 0.20,
          borderTopLeftRadius: s * 0.19, borderTopRightRadius: s * 0.19,
          borderTopWidth: lw, borderLeftWidth: lw, borderRightWidth: lw, borderBottomWidth: 0,
          borderColor: '#fff',
        }} />
      ))}
    </View>
  )
}

/**
 * Cave arch icon for CAVE.
 * A rounded arch (cave entrance silhouette) with a ground line at the base.
 */
function CaveIcon({ s }: { s: number }) {
  const lw    = Math.max(1.5, s * 0.13)
  const archW = s * 0.70
  const archH = s * 0.62
  const archL = (s - archW) / 2
  const archT = s * 0.10

  return (
    <View style={{ width: s, height: s }}>
      {/* Arch */}
      <View style={{
        position: 'absolute', left: archL, top: archT,
        width: archW, height: archH,
        borderTopLeftRadius: archW / 2, borderTopRightRadius: archW / 2,
        borderTopWidth: lw, borderLeftWidth: lw, borderRightWidth: lw, borderBottomWidth: 0,
        borderColor: '#fff',
      }} />
      {/* Ground line */}
      <View style={{
        position: 'absolute', left: archL - lw, top: archT + archH,
        width: archW + lw * 2, height: lw,
        backgroundColor: '#fff', borderRadius: lw / 2,
      }} />
    </View>
  )
}

// ── Icon selector ─────────────────────────────────────────────────────────────

function PlaceIcon({ type, size }: { type: CanonicalPlaceType; size: number }) {
  switch (type) {
    case 'MARINA':     return <AnchorIcon      s={size} />
    case 'ANCHORAGE':  return <AnchorageIcon   s={size} />
    case 'BAY':        return <WaveIcon        s={size} />
    case 'POI':        return <StarIcon        s={size} />
    case 'BEACH':      return <SunriseIcon     s={size} />
    case 'CAVE':       return <CaveIcon        s={size} />
    case 'LAGOON':     return <LagoonIcon      s={size} />
    case 'SNORKELING': return <SnorkelingIcon  s={size} />
    default:           return <StarIcon        s={size} />
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
  const canonical  = normalizePlaceType(type)
  const { color }  = PLACE_CONFIG[canonical]
  const size       = selected ? 34 : 28
  const iconSize   = selected ? 16 : 13

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: color,
            width:            size,
            height:           size,
            borderRadius:     size / 2,
            shadowOpacity:    selected ? 0.4 : 0.18,
            shadowRadius:     selected ? 6 : 3,
            transform:        [{ scale: selected ? 1.1 : 1 }],
          },
        ]}
      >
        <PlaceIcon type={canonical} size={iconSize} />
      </View>
      {isPremium && <LockBadge />}
    </View>
  )
}

/**
 * Lock-shaped badge for premium places.
 * Drawn with pure Views so it renders correctly as a map marker snapshot.
 * Shape: rounded rectangle body with a smaller U-shaped shackle on top.
 */
function LockBadge() {
  const S  = 13          // badge circle diameter
  const bW = S * 0.42    // lock body width
  const bH = S * 0.35    // lock body height
  const bL = (S - bW) / 2
  const bT = S * 0.48
  const lw = Math.max(1.2, S * 0.12)  // shackle line weight
  const sW = bW * 0.55               // shackle inner width
  const sH = S * 0.30                // shackle height
  const sL = (S - sW - lw * 2) / 2 + lw / 2
  const sT = bT - sH + lw * 0.5

  return (
    <View style={[styles.lockBadge, { width: S, height: S, borderRadius: S / 2 }]}>
      {/* Shackle (U-arch) */}
      <View style={{
        position: 'absolute', left: sL, top: sT,
        width: sW, height: sH,
        borderTopLeftRadius: sW / 2, borderTopRightRadius: sW / 2,
        borderTopWidth: lw, borderLeftWidth: lw, borderRightWidth: lw, borderBottomWidth: 0,
        borderColor: '#fff',
      }} />
      {/* Body */}
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
  wrapper: { alignItems: 'center' },
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
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
})
