import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Signal, SignalCategory, getCategoryMeta } from '../lib/signalService'

/**
 * SignalMarker — custom map pin for react-native-maps.
 *
 * WHY NO TEXT / EMOJI:
 * react-native-maps captures Marker children as a native bitmap snapshot.
 * <Text> rendering (including emoji) is asynchronous — the glyph is drawn via
 * the JS-thread font pipeline. If the snapshot is taken before the glyph paints
 * (which happens on every mount, remount, or tracksViewChanges re-capture),
 * the marker appears blank. tracksViewChanges={true} re-enters the same race
 * on every React render — including during zoom — so it does not fix the issue.
 *
 * Solution: draw every icon as pure View / border shapes.
 * No Text, no fonts, no external assets → always correct on first paint.
 * Same approach used by PlaceMarker.
 */

interface Props {
  signal: Signal
  selected?: boolean
}

// ── Category icons — pure View shapes, no Text ────────────────────────────────

function SignalCategoryIcon({ category, size: s }: { category: SignalCategory; size: number }) {
  const cx = s / 2
  const lw = Math.max(1.5, s * 0.13)

  if (category === 'MeetUp') {
    // Two overlapping circles (people meeting)
    const r = s * 0.24
    return (
      <View style={{ width: s, height: s }}>
        <View style={{ position: 'absolute', left: cx - r * 1.5, top: cx - r, width: r * 2, height: r * 2, borderRadius: r, borderWidth: lw, borderColor: '#fff' }} />
        <View style={{ position: 'absolute', left: cx - r * 0.5, top: cx - r, width: r * 2, height: r * 2, borderRadius: r, borderWidth: lw, borderColor: '#fff' }} />
      </View>
    )
  }

  if (category === 'NeedHelp') {
    // Bold plus / cross (emergency)
    const len = s * 0.65
    return (
      <View style={{ width: s, height: s }}>
        <View style={{ position: 'absolute', left: cx - lw / 2, top: (s - len) / 2, width: lw, height: len, backgroundColor: '#fff', borderRadius: lw / 2 }} />
        <View style={{ position: 'absolute', left: (s - len) / 2, top: cx - lw / 2, width: len, height: lw, backgroundColor: '#fff', borderRadius: lw / 2 }} />
      </View>
    )
  }

  if (category === 'Crew') {
    // Sail triangle + hull line
    const sailW = s * 0.54
    const sailH = s * 0.50
    const sailL = (s - sailW) / 2
    const sailT = s * 0.08
    const hullW = sailW * 1.28
    const hullL = (s - hullW) / 2
    return (
      <View style={{ width: s, height: s }}>
        {/* Sail — triangle via zero-size-border trick (same as PlaceMarker teardrop) */}
        <View style={{
          position: 'absolute', left: sailL, top: sailT,
          width: 0, height: 0,
          borderLeftWidth: sailW / 2, borderRightWidth: sailW / 2, borderBottomWidth: sailH,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#fff',
        }} />
        {/* Hull */}
        <View style={{ position: 'absolute', left: hullL, top: sailT + sailH + 1, width: hullW, height: lw, backgroundColor: '#fff', borderRadius: lw / 2 }} />
      </View>
    )
  }

  if (category === 'Tip') {
    // Exclamation mark — tall rect + dot
    const barW = Math.max(lw * 1.4, 2)
    const barH = s * 0.50
    const barT = s * 0.08
    const dotR = Math.max(lw, 1.5)
    const dotT = barT + barH + lw * 1.2
    return (
      <View style={{ width: s, height: s }}>
        <View style={{ position: 'absolute', left: cx - barW / 2, top: barT, width: barW, height: barH, backgroundColor: '#fff', borderRadius: barW / 2 }} />
        <View style={{ position: 'absolute', left: cx - dotR, top: dotT, width: dotR * 2, height: dotR * 2, borderRadius: dotR, backgroundColor: '#fff' }} />
      </View>
    )
  }

  // Other / default — three upward radio-wave arcs + base dot
  const radii = [s * 0.15, s * 0.26, s * 0.37]
  const baseY = s * 0.78
  return (
    <View style={{ width: s, height: s }}>
      {radii.map((r, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: cx - r, top: baseY - r * 1.6,
          width: r * 2, height: r * 1.6,
          borderTopLeftRadius: r, borderTopRightRadius: r,
          borderTopWidth: lw * (1 - i * 0.1),
          borderLeftWidth: lw * (1 - i * 0.1),
          borderRightWidth: lw * (1 - i * 0.1),
          borderBottomWidth: 0,
          borderColor: `rgba(255,255,255,${0.9 - i * 0.2})`,
        }} />
      ))}
      {/* Base dot */}
      <View style={{ position: 'absolute', left: cx - lw * 0.8, top: baseY - lw * 0.8, width: lw * 1.6, height: lw * 1.6, borderRadius: lw, backgroundColor: '#fff' }} />
    </View>
  )
}

// ── Marker ───────────────────────────────────────────────────────────────────

export function SignalMarker({ signal, selected }: Props) {
  const meta = getCategoryMeta(signal.category)
  const size = selected ? 50 : 42

  return (
    <View style={{ width: size + 20, height: size + 20, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer pulse ring */}
      {selected && (
        <View style={[
          styles.pulseRing,
          { width: size + 20, height: size + 20, borderRadius: (size + 20) / 2, borderColor: meta.color + '28' },
        ]} />
      )}
      {/* Inner pulse ring */}
      {selected && (
        <View style={[
          styles.pulseRing,
          { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2, borderColor: meta.color + '50',
            position: 'absolute' },
        ]} />
      )}
      {/* Main pin */}
      <View style={[
        styles.pin,
        {
          width: size, height: size, borderRadius: size / 2,
          borderColor: meta.color,
          borderWidth: selected ? 3 : 2.5,
          shadowColor: meta.color,
          shadowOpacity: selected ? 0.35 : 0.18,
        },
      ]}>
        <View style={[styles.fill, { backgroundColor: meta.color + '14' }]}>
          <SignalCategoryIcon category={signal.category} size={selected ? 20 : 17} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  pulseRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  pin: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
