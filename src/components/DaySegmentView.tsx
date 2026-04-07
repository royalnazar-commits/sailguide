/**
 * DaySegmentView — read-only segment-based route renderer.
 *
 * Renders each day as a structured SEGMENT (A → stops → B), not a flat list.
 * Used in profile, route cards, and any non-editable route context.
 *
 * Two modes:
 *   compact  — single line per day: "Day N  ·  A → B  ·  X nm"
 *   full     — full card per day with nested intermediate stops and alt
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { UserRoute, UserRouteStop } from '../types/userRoute'
import { Colors } from '../constants/colors'

// ── Helpers ───────────────────────────────────────────────────────────────────

function legNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 3440.065
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

const TYPE_COLORS: Record<string, string> = {
  MARINA: '#1B6CA8', ANCHORAGE: '#22C55E', BAY: '#00B4D8',
  BEACH: '#FF7043', LAGOON: '#0891B2', CAVE: '#7C3AED', FUEL: '#F59E0B',
}

const TYPE_LABELS: Record<string, string> = {
  MARINA: 'Marina', ANCHORAGE: 'Anchorage', BAY: 'Bay', BEACH: 'Beach',
  LAGOON: 'Lagoon', CAVE: 'Cave', FUEL: 'Fuel', CUSTOM: 'Waypoint',
}

const DAY_PALETTE = ['#1B6CA8', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#00B4D8', '#F97316']

// ── Internal types ────────────────────────────────────────────────────────────

interface DayGroup {
  day: number
  departure: UserRouteStop | undefined
  destination: UserRouteStop | undefined
  intermediate: UserRouteStop[]
  alt: UserRouteStop | undefined
  nm: number
  isInherited: boolean   // departure is carried over from prev day's destination
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Returns true if the route has explicit day structure.
 * Flat routes (no DAY_START/DAY_END types) return false.
 */
export function hasDayStructure(route: UserRoute): boolean {
  return route.stops.some((s) => s.type === 'DAY_START' || s.type === 'DAY_END')
}

// ── Group builder ─────────────────────────────────────────────────────────────

function buildGroups(stops: UserRouteStop[]): DayGroup[] {
  if (stops.length === 0) return []
  const maxDay = Math.max(...stops.map((s) => s.dayIndex ?? 0))
  const groups: DayGroup[] = []

  for (let d = 0; d <= maxDay; d++) {
    const dayStops = stops
      .filter((s) => (s.dayIndex ?? 0) === d)
      .sort((a, b) => a.sequence - b.sequence)

    if (dayStops.length === 0) continue

    const departure    = dayStops.find((s) => s.type === 'DAY_START')
    const destination  = dayStops.find((s) => s.type === 'DAY_END')
    const intermediate = dayStops.filter((s) => s.type !== 'DAY_START' && s.type !== 'DAY_END' && s.type !== 'ALT_END')
    const alt          = dayStops.find((s) => s.type === 'ALT_END')

    // Day 2+ inherits departure from previous day's destination
    const inherited = !departure && d > 0
      ? stops.find((s) => (s.dayIndex ?? 0) === d - 1 && s.type === 'DAY_END')
      : undefined

    const effective = departure ?? inherited

    const nm = (effective?.lat && effective?.lng && destination?.lat && destination?.lng)
      ? legNm(effective.lat, effective.lng, destination.lat, destination.lng)
      : 0

    groups.push({
      day: d,
      departure: effective,
      destination,
      intermediate,
      alt,
      nm,
      isInherited: !!inherited,
    })
  }

  return groups
}

// ── Main component ────────────────────────────────────────────────────────────

interface DaySegmentViewProps {
  route: UserRoute
  /**
   * compact: renders one line per day (Day N · A → B · X nm).
   * Full (default): full card with nested intermediate stops and alt destination.
   */
  compact?: boolean
  /** Cap the number of rendered days. Remaining shown as "+N more days" hint. */
  maxDays?: number
}

export function DaySegmentView({ route, compact = false, maxDays }: DaySegmentViewProps) {
  const groups  = buildGroups(route.stops)
  if (groups.length === 0) return null

  const visible = maxDays ? groups.slice(0, maxDays) : groups
  const hidden  = maxDays ? Math.max(0, groups.length - maxDays) : 0

  return (
    <View style={dv.container}>
      {visible.map((g) =>
        compact
          ? <CompactDayRow key={g.day} group={g} />
          : <FullDayCard    key={g.day} group={g} />
      )}
      {hidden > 0 && (
        <View style={dv.moreHint}>
          <Text style={dv.moreHintText}>+ {hidden} more day{hidden !== 1 ? 's' : ''}</Text>
        </View>
      )}
    </View>
  )
}

// ── Compact row ───────────────────────────────────────────────────────────────

function CompactDayRow({ group }: { group: DayGroup }) {
  const color = DAY_PALETTE[group.day % DAY_PALETTE.length]
  return (
    <View style={dv.compactRow}>
      {/* Color pip */}
      <View style={[dv.compactPip, { backgroundColor: color }]} />
      {/* Day label */}
      <Text style={[dv.compactDay, { color }]}>Day {group.day + 1}</Text>
      {/* Leg */}
      <View style={dv.compactLeg}>
        {group.departure && (
          <Text style={dv.compactPort} numberOfLines={1}>{group.departure.name ?? 'Departure'}</Text>
        )}
        {group.departure && group.destination && (
          <Ionicons name="arrow-forward" size={9} color={Colors.textMuted} />
        )}
        {group.destination && (
          <Text style={dv.compactPort} numberOfLines={1}>{group.destination.name ?? 'Destination'}</Text>
        )}
      </View>
      {/* Distance */}
      {group.nm > 0 && <Text style={dv.compactNm}>{group.nm} nm</Text>}
    </View>
  )
}

// ── Full day card ─────────────────────────────────────────────────────────────

function FullDayCard({ group }: { group: DayGroup }) {
  const color = DAY_PALETTE[group.day % DAY_PALETTE.length]
  const hasContent = group.intermediate.length > 0 || group.destination

  return (
    <View style={dv.card}>

      {/* Header strip */}
      <View style={[dv.cardHeader, { borderLeftColor: color }]}>
        <View style={[dv.dayTag, { backgroundColor: color + '16' }]}>
          <Text style={[dv.dayTagText, { color }]}>Day {group.day + 1}</Text>
        </View>
        {group.nm > 0 && (
          <View style={dv.nmRow}>
            <Ionicons name="navigate-outline" size={10} color={Colors.textMuted} />
            <Text style={dv.nmText}>{group.nm} nm</Text>
          </View>
        )}
        {group.intermediate.length > 0 && (
          <Text style={dv.hdrStopCount}>
            {group.intermediate.length} stop{group.intermediate.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* ── DEPARTURE (A) ── */}
      {group.departure && (
        <View style={dv.anchorRow}>
          <View style={dv.tlCol}>
            <View style={[dv.anchorDot, { backgroundColor: '#22C55E', borderColor: '#22C55E25' }]}>
              <Ionicons name="boat-outline" size={11} color="#fff" />
            </View>
            {hasContent && <View style={[dv.tlLine, { backgroundColor: color + '28' }]} />}
          </View>
          <View style={dv.anchorBody}>
            <Text style={dv.anchorName} numberOfLines={1}>{group.departure.name ?? 'Departure'}</Text>
            <View style={[dv.badge, { backgroundColor: '#22C55E0E' }]}>
              <Text style={[dv.badgeText, { color: '#22C55E' }]}>
                {group.isInherited ? `Overnight · Day ${group.day}` : 'Departure'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── INTERMEDIATE STOPS (nested) ── */}
      {group.intermediate.map((stop, i) => {
        const sc   = TYPE_COLORS[stop.type ?? 'CUSTOM'] ?? Colors.textMuted
        const sl   = TYPE_LABELS[stop.type ?? 'CUSTOM'] ?? 'Waypoint'
        const last = i === group.intermediate.length - 1
        return (
          <View key={stop.id} style={dv.stopRow}>
            <View style={dv.tlCol}>
              <View style={[dv.stopDot, { backgroundColor: sc }]} />
              {(!last || group.destination) && (
                <View style={[dv.tlLine, { backgroundColor: color + '28' }]} />
              )}
            </View>
            <View style={dv.stopBody}>
              <Text style={dv.stopName} numberOfLines={1}>{stop.name ?? `Stop ${i + 1}`}</Text>
              <View style={[dv.stopBadge, { backgroundColor: sc + '14' }]}>
                <View style={[dv.stopBadgeDot, { backgroundColor: sc }]} />
                <Text style={[dv.stopBadgeText, { color: sc }]}>{sl}</Text>
              </View>
            </View>
          </View>
        )
      })}

      {/* ── DESTINATION (B) ── */}
      {group.destination && (
        <View style={dv.anchorRow}>
          <View style={dv.tlCol}>
            <View style={[dv.anchorDot, { backgroundColor: '#1B6CA8', borderColor: '#1B6CA825' }]}>
              <Ionicons name="flag" size={11} color="#fff" />
            </View>
            {group.alt && <View style={[dv.tlLine, { backgroundColor: '#F9731640' }]} />}
          </View>
          <View style={dv.anchorBody}>
            <Text style={dv.anchorName} numberOfLines={1}>{group.destination.name ?? 'Destination'}</Text>
            <View style={[dv.badge, { backgroundColor: '#1B6CA80E' }]}>
              <Text style={[dv.badgeText, { color: '#1B6CA8' }]}>
                {'Destination' + (group.nm > 0 ? ` · ${group.nm} nm` : '')}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── ALT DESTINATION ── */}
      {group.alt && (
        <View style={dv.altRow}>
          <View style={dv.tlCol}>
            <View style={dv.altIcon}>
              <Ionicons name="git-branch-outline" size={11} color="#F97316" />
            </View>
          </View>
          <View style={dv.anchorBody}>
            <Text style={dv.altName} numberOfLines={1}>{group.alt.name ?? 'Backup Destination'}</Text>
            <View style={[dv.badge, { backgroundColor: '#F9731610' }]}>
              <Text style={[dv.badgeText, { color: '#F97316' }]}>Alt. Destination</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const dv = StyleSheet.create({
  container: { gap: 10 },

  // ── Compact ──────────────────────────────────────────────────────────────
  compactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4,
  },
  compactPip: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  compactDay: { fontSize: 11, fontWeight: '700', minWidth: 38, flexShrink: 0 },
  compactLeg: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden',
  },
  compactPort: { fontSize: 12, color: Colors.text, fontWeight: '500', flexShrink: 1 },
  compactNm: { fontSize: 11, color: Colors.textMuted, fontWeight: '500', flexShrink: 0 },

  // ── More hint ─────────────────────────────────────────────────────────────
  moreHint: { alignItems: 'center', paddingTop: 2 },
  moreHintText: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },

  // ── Full card ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },

  // Header
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    borderLeftWidth: 3,
  },
  dayTag: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  dayTagText: { fontSize: 11, fontWeight: '700' },
  nmRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nmText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  hdrStopCount: { fontSize: 11, color: Colors.textMuted, marginLeft: 'auto' as any },

  // Anchor rows (departure / destination)
  anchorRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  anchorDot: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, flexShrink: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10, shadowRadius: 2, elevation: 1,
  },
  anchorBody: { flex: 1, paddingTop: 2 },
  anchorName: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '600' },

  // Timeline column
  tlCol: { width: 26, alignItems: 'center', flexShrink: 0 },
  tlLine: { width: 1.5, flex: 1, minHeight: 12, marginTop: 2, borderRadius: 1 },

  // Intermediate stops
  stopRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingLeft: 14, paddingRight: 14, paddingVertical: 7,
    backgroundColor: '#FAFBFC',
  },
  stopDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0, marginTop: 3 },
  stopBody: { flex: 1 },
  stopName: { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  stopBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start',
  },
  stopBadgeDot: { width: 4, height: 4, borderRadius: 2 },
  stopBadgeText: { fontSize: 10, fontWeight: '600' },

  // Alt destination
  altRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 14, paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F9731618',
    backgroundColor: '#FFF9F5',
  },
  altIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F9731610', borderWidth: 1.5, borderColor: '#F9731632',
  },
  altName: { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 3 },
})
