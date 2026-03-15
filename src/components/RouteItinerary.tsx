import React, { useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Animated, TouchableWithoutFeedback, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { RoutePoint } from '../types'
import { Colors } from '../constants/colors'

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_W = 168
const CARD_GAP = 12
const SNAP = CARD_W + CARD_GAP
const SHEET_MAX = 520

const TYPE_COLOR: Record<string, string> = {
  MARINA:    '#1E3A5F',
  ANCHORAGE: Colors.primary,
  WAYPOINT:  Colors.textMuted,
  POI:       Colors.accent,
  DANGER:    Colors.danger,
  FUEL:      Colors.warning,
}

const TYPE_LABEL: Record<string, string> = {
  MARINA:    'Marina',
  ANCHORAGE: 'Anchorage',
  WAYPOINT:  'Waypoint',
  POI:       'Point of Interest',
  DANGER:    'Danger',
  FUEL:      'Fuel Stop',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Leg {
  day: number
  from: RoutePoint
  to: RoutePoint
}

function buildLegs(points: RoutePoint[]): Leg[] {
  const sorted = [...points].sort((a, b) => a.sequence - b.sequence)
  const legs: Leg[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    legs.push({ day: i + 1, from: sorted[i], to: sorted[i + 1] })
  }
  return legs
}

function formatSailTime(hours?: number): string {
  if (!hours || hours === 0) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatStay(hours?: number): string {
  if (!hours || hours === 0) return '—'
  if (hours >= 24) {
    const d = Math.round(hours / 24)
    return `${d} night${d > 1 ? 's' : ''}`
  }
  return `${hours}h`
}

function tipEmoji(tip: string): string {
  const t = tip.toLowerCase()
  if (t.includes('swim') || t.includes('snorkel') || t.includes('beach') || t.includes('bay')) return '🏖'
  if (t.includes('restaurant') || t.includes('food') || t.includes('eat') || t.includes('taverna') || t.includes('cuisine') || t.includes('dinner')) return '🍽'
  if (t.includes('wine') || t.includes('drink') || t.includes('bar')) return '🍷'
  if (t.includes('museum') || t.includes('historic') || t.includes('palace') || t.includes('fortress') || t.includes('castle') || t.includes('church') || t.includes('visit')) return '🏛'
  if (t.includes('view') || t.includes('sunset') || t.includes('climb') || t.includes('panoram')) return '👁'
  if (t.includes('fuel') || t.includes('provision') || t.includes('stock') || t.includes('supermarket') || t.includes('grocery')) return '🛒'
  if (t.includes('marina') || t.includes('harbor') || t.includes('harbour') || t.includes('moor') || t.includes('anchor')) return '⚓'
  return '⛵'
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  points: RoutePoint[]
  routeId: string
}

export function RouteItinerary({ points, routeId }: Props) {
  const [activeLeg, setActiveLeg] = useState<Leg | null>(null)
  const translateY = useRef(new Animated.Value(SHEET_MAX)).current

  const legs = buildLegs(points)
  if (legs.length === 0) return null

  const openSheet = useCallback((leg: Leg) => {
    setActiveLeg(leg)
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 10,
      tension: 70,
    }).start()
  }, [translateY])

  const closeSheet = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SHEET_MAX,
      duration: 260,
      useNativeDriver: true,
    }).start(() => setActiveLeg(null))
  }, [translateY])

  const viewOnMap = useCallback((leg: Leg) => {
    closeSheet()
    setTimeout(() => {
      router.push(`/route/${routeId}/map?focusStop=${leg.to.sequence}`)
    }, 280)
  }, [routeId, closeSheet])

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionTitle}>Itinerary</Text>
      <Text style={styles.sectionSub}>{legs.length} sailing legs · swipe to explore</Text>

      {/* Horizontal card strip — breaks out of parent padding */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={styles.strip}
        style={styles.stripScroll}
      >
        {legs.map((leg) => (
          <DayCard key={leg.day} leg={leg} onPress={openSheet} />
        ))}
        {/* Right padding sentinel */}
        <View style={{ width: 20 }} />
      </ScrollView>

      {/* Bottom sheet */}
      <Modal
        visible={activeLeg !== null}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={closeSheet}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
          pointerEvents="box-none"
        >
          {activeLeg && <SheetContent leg={activeLeg} onClose={closeSheet} onViewMap={viewOnMap} />}
        </Animated.View>
      </Modal>
    </View>
  )
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({ leg, onPress }: { leg: Leg; onPress: (l: Leg) => void }) {
  const accentColor = TYPE_COLOR[leg.to.type] ?? Colors.primary
  const hasDistance = (leg.to.distanceFromPrevNm ?? 0) > 0

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: accentColor }]}
      onPress={() => onPress(leg)}
      activeOpacity={0.82}
    >
      {/* Day badge */}
      <View style={styles.cardDayRow}>
        <View style={[styles.dayBadge, { backgroundColor: accentColor + '18' }]}>
          <Text style={[styles.dayBadgeText, { color: accentColor }]}>DAY {leg.day}</Text>
        </View>
        <View style={[styles.typeDot, { backgroundColor: accentColor }]} />
      </View>

      {/* Route line */}
      <View style={styles.routeLine}>
        <Text style={styles.fromName} numberOfLines={1}>{leg.from.name}</Text>

        <View style={styles.arrowRow}>
          <View style={[styles.arrowLine, { backgroundColor: accentColor + '40' }]} />
          <View style={[styles.arrowCircle, { borderColor: accentColor }]}>
            <Ionicons name="arrow-down" size={10} color={accentColor} />
          </View>
          <View style={[styles.arrowLine, { backgroundColor: accentColor + '40' }]} />
        </View>

        <Text style={styles.toName} numberOfLines={1}>{leg.to.name}</Text>
      </View>

      {/* Stats footer */}
      <View style={styles.cardFooter}>
        {hasDistance && (
          <View style={styles.statPill}>
            <Text style={styles.statPillText}>{leg.to.distanceFromPrevNm} nm</Text>
          </View>
        )}
        {(leg.to.sailTimeHours ?? 0) > 0 && (
          <View style={styles.statPill}>
            <Text style={styles.statPillText}>{formatSailTime(leg.to.sailTimeHours)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

// ─── Sheet Content ────────────────────────────────────────────────────────────

function SheetContent({
  leg, onClose, onViewMap,
}: { leg: Leg; onClose: () => void; onViewMap: (l: Leg) => void }) {
  const accentColor = TYPE_COLOR[leg.to.type] ?? Colors.primary
  const hasDistance = (leg.to.distanceFromPrevNm ?? 0) > 0

  return (
    <ScrollView
      bounces={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.sheetContent}
    >
      {/* Handle */}
      <View style={styles.sheetHandle} />

      {/* Header */}
      <View style={styles.sheetHeaderRow}>
        <View style={[styles.sheetDayBadge, { backgroundColor: accentColor + '18' }]}>
          <Text style={[styles.sheetDayText, { color: accentColor }]}>DAY {leg.day}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <View style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Leg title */}
      <View style={styles.sheetLegTitle}>
        <Text style={styles.sheetFromLabel}>{leg.from.name}</Text>
        <View style={styles.sheetArrowWrap}>
          <View style={[styles.sheetArrowLine, { backgroundColor: accentColor }]} />
          <Ionicons name="chevron-forward" size={14} color={accentColor} />
        </View>
        <Text style={[styles.sheetToLabel, { color: accentColor }]}>{leg.to.name}</Text>
      </View>

      {/* Type label */}
      <View style={[styles.sheetTypePill, { backgroundColor: accentColor + '18' }]}>
        <Text style={[styles.sheetTypePillText, { color: accentColor }]}>
          {TYPE_LABEL[leg.to.type] ?? leg.to.type}
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.sheetStats}>
        {hasDistance && (
          <SheetStat icon="navigate-outline" label="Distance" value={`${leg.to.distanceFromPrevNm} nm`} />
        )}
        {(leg.to.sailTimeHours ?? 0) > 0 && (
          <SheetStat icon="time-outline" label="Sail time" value={formatSailTime(leg.to.sailTimeHours)} />
        )}
        {(leg.to.stayDurationHours ?? 0) > 0 && (
          <SheetStat icon="moon-outline" label="Stay" value={formatStay(leg.to.stayDurationHours)} />
        )}
      </View>

      {/* Description */}
      {!!leg.to.description && (
        <Text style={styles.sheetDescription}>{leg.to.description}</Text>
      )}

      {/* Highlights */}
      {leg.to.tips.length > 0 && (
        <View style={styles.sheetSection}>
          <Text style={styles.sheetSectionTitle}>Highlights</Text>
          {leg.to.tips.map((tip, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletEmoji}>{tipEmoji(tip)}</Text>
              <Text style={styles.bulletText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Warnings */}
      {leg.to.warnings.length > 0 && (
        <View style={styles.sheetSection}>
          <Text style={styles.sheetSectionTitle}>Heads Up</Text>
          {leg.to.warnings.map((w, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bulletEmoji}>⚠️</Text>
              <Text style={[styles.bulletText, { color: Colors.danger }]}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Weather notes */}
      {!!leg.to.weatherNotes && (
        <View style={styles.weatherNote}>
          <Ionicons name="partly-sunny-outline" size={15} color={Colors.secondary} />
          <Text style={styles.weatherNoteText}>{leg.to.weatherNotes}</Text>
        </View>
      )}

      {/* View on map CTA */}
      <TouchableOpacity
        style={[styles.mapBtn, { backgroundColor: accentColor }]}
        onPress={() => onViewMap(leg)}
        activeOpacity={0.85}
      >
        <Ionicons name="map-outline" size={18} color="#fff" />
        <Text style={styles.mapBtnText}>View this leg on map</Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </ScrollView>
  )
}

function SheetStat({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.sheetStatBox}>
      <Ionicons name={icon} size={18} color={Colors.secondary} />
      <Text style={styles.sheetStatValue}>{value}</Text>
      <Text style={styles.sheetStatLabel}>{label}</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { marginTop: 8, marginBottom: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, paddingHorizontal: 20, marginBottom: 2 },
  sectionSub: { fontSize: 13, color: Colors.textMuted, paddingHorizontal: 20, marginBottom: 14 },

  stripScroll: { marginHorizontal: -20 },
  strip: { paddingLeft: 20, paddingRight: 8, flexDirection: 'row' },

  // Day card
  card: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderLeftWidth: 4,
    marginRight: CARD_GAP,
    padding: 14,
    justifyContent: 'space-between',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  cardDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dayBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  dayBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  typeDot: { width: 7, height: 7, borderRadius: 3.5 },

  routeLine: { flex: 1, justifyContent: 'center', gap: 4 },
  fromName: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  arrowRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  arrowLine: { flex: 1, height: 1 },
  arrowCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  toName: { fontSize: 14, fontWeight: '800', color: Colors.text },

  cardFooter: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  statPill: { backgroundColor: Colors.background, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statPillText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // Bottom sheet
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 16 },
    }),
  },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 16 },

  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetDayBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  sheetDayText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },

  sheetLegTitle: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  sheetFromLabel: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  sheetArrowWrap: { flexDirection: 'row', alignItems: 'center' },
  sheetArrowLine: { width: 16, height: 1.5, opacity: 0.5 },
  sheetToLabel: { fontSize: 18, fontWeight: '800' },
  sheetTypePill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 18 },
  sheetTypePillText: { fontSize: 12, fontWeight: '600' },

  sheetStats: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  sheetStatBox: { flex: 1, backgroundColor: Colors.background, borderRadius: 12, padding: 12, alignItems: 'center', gap: 3 },
  sheetStatValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sheetStatLabel: { fontSize: 11, color: Colors.textMuted },

  sheetDescription: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 16 },

  sheetSection: { marginBottom: 16 },
  sheetSectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  bulletEmoji: { fontSize: 16, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  weatherNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 11, marginBottom: 18,
  },
  weatherNoteText: { flex: 1, fontSize: 13, color: Colors.secondary, lineHeight: 18 },

  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18,
    marginTop: 4,
  },
  mapBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff' },
})
