/**
 * UserRouteMapScreen — premium full-screen map for a published UserRoute.
 *
 * Accessed via "View on Map" button in RouteViewScreen.
 * Navionics × Airbnb × Apple Maps aesthetic.
 */

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform,
} from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { usePlacesStore } from '../store/placesStore'
import { MaritimePolyline } from '../components/MaritimePolyline'
import { seedPlaces } from '../data/seedPlaces'
import { Place } from '../types/place'
import { UserRouteStop } from '../types/userRoute'
import { Colors } from '../constants/colors'

// ── Stop type config ──────────────────────────────────────────────────────────

const STOP_COLORS: Record<string, string> = {
  MARINA:    '#1B6CA8',
  ANCHORAGE: '#22C55E',
  BAY:       '#00B4D8',
  BEACH:     '#FF7043',
  LAGOON:    '#0891B2',
  CAVE:      '#7C3AED',
  FUEL:      '#F59E0B',
  CUSTOM:    '#64748B',
  DAY_START: '#22C55E',
  DAY_END:   '#1B6CA8',
  ALT_END:   '#F97316',
}

const STOP_TYPE_LABELS: Record<string, string> = {
  MARINA:    'Marina',
  ANCHORAGE: 'Anchorage',
  BAY:       'Bay',
  BEACH:     'Beach',
  LAGOON:    'Lagoon',
  CAVE:      'Cave',
  FUEL:      'Fuel Stop',
  CUSTOM:    'Waypoint',
  DAY_START: 'Day Start',
  DAY_END:   'Day End',
  ALT_END:   'Alt. End',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ResolvedStop {
  id: string
  name: string
  lat: number
  lng: number
  type: string
  sequence: number
  dayIndex: number
}

function resolveStops(stops: UserRouteStop[], places: Place[]): ResolvedStop[] {
  const placeMap = new Map(places.map((p) => [p.id, p]))
  return stops
    .map((stop): ResolvedStop | null => {
      if (stop.lat != null && stop.lng != null) {
        return {
          id: stop.id,
          name: stop.name ?? 'Waypoint',
          lat: stop.lat,
          lng: stop.lng,
          type: stop.type ?? 'CUSTOM',
          sequence: stop.sequence,
          dayIndex: stop.dayIndex ?? 0,
        }
      }
      const place = placeMap.get(stop.placeId)
      if (!place) return null
      return {
        id: stop.id,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        type: stop.type ?? place.type ?? 'CUSTOM',
        sequence: stop.sequence,
        dayIndex: stop.dayIndex ?? 0,
      }
    })
    .filter((s): s is ResolvedStop => s != null)
    .sort((a, b) => a.sequence - b.sequence)
}

function computeRegion(stops: ResolvedStop[]): Region | null {
  if (stops.length === 0) return null
  const lats = stops.map((s) => s.lat)
  const lngs = stops.map((s) => s.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latDelta = Math.max((maxLat - minLat) * 1.5, 0.06)
  const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.06)
  return {
    latitude:  (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta:  latDelta,
    longitudeDelta: lngDelta,
  }
}

// ── Stop marker ───────────────────────────────────────────────────────────────

interface StopMarkerProps {
  stop: ResolvedStop
  index: number
  total: number
  isSelected: boolean
  onPress: (stop: ResolvedStop) => void
}

const StopMarker = React.memo(function StopMarker({
  stop, index, total, isSelected, onPress,
}: StopMarkerProps) {
  const isFirst = index === 0
  const isLast  = index === total - 1

  const handlePress = useCallback(() => onPress(stop), [onPress, stop])

  // Endpoint colors: vibrant green start, deep navy end
  const color = isFirst ? '#16A34A' : isLast ? '#0A2540' : (STOP_COLORS[stop.type] ?? STOP_COLORS.CUSTOM)

  return (
    <Marker
      coordinate={{ latitude: stop.lat, longitude: stop.lng }}
      tracksViewChanges={isSelected}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={handlePress}
    >
      <View style={[
        mk.shell,
        isFirst || isLast ? mk.shellEndpoint : mk.shellStop,
        isSelected && mk.shellSelected,
        { shadowColor: color },
      ]}>
        <View style={[
          mk.core,
          { backgroundColor: color },
          isFirst || isLast ? mk.coreEndpoint : mk.coreStop,
        ]}>
          {isFirst ? (
            <Ionicons name="navigate" size={13} color="#fff" />
          ) : isLast ? (
            <Ionicons name="flag" size={12} color="#fff" />
          ) : (
            <Text style={mk.num}>{index + 1}</Text>
          )}
        </View>
      </View>
    </Marker>
  )
})

const mk = StyleSheet.create({
  shell: {
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  shellStop: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2.5, borderColor: '#fff',
  },
  shellEndpoint: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 3, borderColor: '#fff',
  },
  shellSelected: {
    transform: [{ scale: 1.2 }],
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  core: {
    alignItems: 'center', justifyContent: 'center',
  },
  coreStop: {
    width: 23, height: 23, borderRadius: 11.5,
  },
  coreEndpoint: {
    width: 30, height: 30, borderRadius: 15,
  },
  num: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
})

// ── Stop callout card ─────────────────────────────────────────────────────────

interface StopCalloutProps {
  stop: ResolvedStop
  index: number
  total: number
  anim: Animated.Value
  onClose: () => void
  insetBottom: number
}

function StopCallout({ stop, index, total, anim, onClose, insetBottom }: StopCalloutProps) {
  const isFirst = index === 0
  const isLast  = index === total - 1
  const color   = isFirst ? '#16A34A' : isLast ? '#0A2540' : (STOP_COLORS[stop.type] ?? STOP_COLORS.CUSTOM)
  const label   = STOP_TYPE_LABELS[stop.type] ?? 'Stop'
  const posLabel = isFirst ? 'Departure' : isLast ? 'Destination' : `Stop ${index + 1}`

  return (
    <Animated.View
      style={[
        co.card,
        { bottom: insetBottom + 100, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] },
      ]}
    >
      {/* Color accent bar */}
      <View style={[co.accentBar, { backgroundColor: color }]} />

      <View style={co.body}>
        <View style={co.topRow}>
          <View style={[co.typePill, { backgroundColor: color + '18' }]}>
            <Text style={[co.typeText, { color }]}>{posLabel}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={co.name} numberOfLines={2}>{stop.name}</Text>

        <View style={co.metaRow}>
          <View style={[co.dot, { backgroundColor: color }]} />
          <Text style={co.metaText}>{label}</Text>
          {stop.dayIndex > 0 && (
            <>
              <View style={co.separator} />
              <Text style={co.metaText}>Day {stop.dayIndex + 1}</Text>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

const co = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16, right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    // shadow wrapper pattern
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 20,
  },
  accentBar: { width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  body: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typePill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  name: { fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  metaText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  separator: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted },
})

// ── Screen ────────────────────────────────────────────────────────────────────

export default function UserRouteMapScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>()
  const insets  = useSafeAreaInsets()
  const mapRef  = useRef<MapView>(null)

  const { getRoute }   = useRouteBuilderStore()
  const { userPlaces } = usePlacesStore()

  const route     = getRoute(id)
  const allPlaces = useMemo(() => [...seedPlaces, ...userPlaces], [userPlaces])
  const stops     = useMemo(
    () => resolveStops(route?.stops ?? [], allPlaces),
    [route?.stops, allPlaces],
  )
  const region    = useMemo(() => computeRegion(stops), [stops])

  // ── Overlay fade-in on mount ──────────────────────────────────────────────
  const overlayAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(overlayAnim, {
      toValue: 1, duration: 380, delay: 200,
      useNativeDriver: true,
    }).start()
  }, [])

  // ── Selected stop callout ─────────────────────────────────────────────────
  const [selectedStop, setSelectedStop] = useState<ResolvedStop | null>(null)
  const calloutAnim = useRef(new Animated.Value(0)).current

  const handleMarkerPress = useCallback((stop: ResolvedStop) => {
    setSelectedStop(stop)
    Animated.spring(calloutAnim, {
      toValue: 1, tension: 80, friction: 10,
      useNativeDriver: true,
    }).start()
  }, [calloutAnim])

  const handleCalloutClose = useCallback(() => {
    Animated.timing(calloutAnim, {
      toValue: 0, duration: 180,
      useNativeDriver: true,
    }).start(() => setSelectedStop(null))
  }, [calloutAnim])

  // Dismiss callout on map tap
  const handleMapPress = useCallback(() => {
    if (selectedStop) handleCalloutClose()
  }, [selectedStop, handleCalloutClose])

  // ── Fit map after mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!stops.length || !mapRef.current) return
    const coords = stops.map((s) => ({ latitude: s.lat, longitude: s.lng }))
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 48, bottom: 160, left: 48 },
        animated: true,
      })
    }, 450)
  }, [stops])

  // Polyline coords (MaritimePolyline expects { latitude, longitude })
  const polylineCoords = useMemo(
    () => stops.map((s) => ({ latitude: s.lat, longitude: s.lng })),
    [stops],
  )

  const fallbackRegion: Region = {
    latitude: 43.5, longitude: 16.4,
    latitudeDelta: 3, longitudeDelta: 3,
  }

  const days = route?.estimatedDays ?? 0

  return (
    <View style={s.container}>
      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={region ?? fallbackRegion}
        mapType="satellite"
        showsUserLocation
        showsCompass={false}
        onPress={handleMapPress}
      >
        {polylineCoords.length >= 2 && (
          <MaritimePolyline
            coordinates={polylineCoords}
            color="#1B6CA8"
            strokeWidth={4}
          />
        )}

        {stops.map((stop, i) => (
          <StopMarker
            key={stop.id}
            stop={stop}
            index={i}
            total={stops.length}
            isSelected={selectedStop?.id === stop.id}
            onPress={handleMarkerPress}
          />
        ))}
      </MapView>

      {/* ── Header overlay ── */}
      <Animated.View
        style={[s.header, { top: insets.top + 10, opacity: overlayAnim }]}
        pointerEvents="box-none"
      >
        {/* Back button */}
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.82}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Title glass pill */}
        {route && (
          <View style={s.titleGlass}>
            <Text style={s.titleText} numberOfLines={1}>{route.title}</Text>
          </View>
        )}

        {/* Map type indicator dot — decorative right-side balance */}
        <View style={s.mapTypeDot}>
          <Ionicons name="layers-outline" size={18} color="#fff" />
        </View>
      </Animated.View>

      {/* ── Route info pill (bottom) ── */}
      {stops.length > 0 && (
        <Animated.View
          style={[s.infoPill, { bottom: insets.bottom + 28, opacity: overlayAnim }]}
        >
          {/* Stops */}
          <View style={s.statItem}>
            <Ionicons name="location" size={13} color={Colors.accent} />
            <Text style={s.statValue}>{stops.length}</Text>
            <Text style={s.statLabel}>stops</Text>
          </View>

          {(route?.totalNm ?? 0) > 0 && (
            <>
              <View style={s.pillDivider} />
              <View style={s.statItem}>
                <Ionicons name="navigate-outline" size={13} color={Colors.accent} />
                <Text style={s.statValue}>{route!.totalNm}</Text>
                <Text style={s.statLabel}>nm</Text>
              </View>
            </>
          )}

          {days > 0 && (
            <>
              <View style={s.pillDivider} />
              <View style={s.statItem}>
                <Ionicons name="sunny-outline" size={13} color={Colors.accent} />
                <Text style={s.statValue}>{days}</Text>
                <Text style={s.statLabel}>{days === 1 ? 'day' : 'days'}</Text>
              </View>
            </>
          )}
        </Animated.View>
      )}

      {/* ── Stop callout card ── */}
      {selectedStop != null && (
        <StopCallout
          stop={selectedStop}
          index={stops.indexOf(selectedStop)}
          total={stops.length}
          anim={calloutAnim}
          onClose={handleCalloutClose}
          insetBottom={insets.bottom}
        />
      )}

      {/* ── Empty state ── */}
      {stops.length === 0 && route != null && (
        <Animated.View style={[s.emptyState, { opacity: overlayAnim }]}>
          <View style={s.emptyCard}>
            <Ionicons name="map-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No stops to display</Text>
            <Text style={s.emptySubtitle}>This route has no mapped locations yet.</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Not found ── */}
      {route == null && (
        <View style={s.notFound}>
          <View style={s.emptyCard}>
            <Ionicons name="alert-circle-outline" size={32} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>Route not found</Text>
          </View>
        </View>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const GLASS_BG    = 'rgba(10, 37, 64, 0.72)'  // deep navy tint — matches Colors.primary
const GLASS_BORDER = 'rgba(255,255,255,0.18)'

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A2540' },
  map: { ...StyleSheet.absoluteFillObject },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    position: 'absolute',
    left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },

  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: GLASS_BG,
    borderWidth: 0.5, borderColor: GLASS_BORDER,
    alignItems: 'center', justifyContent: 'center',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 6,
  },

  titleGlass: {
    flex: 1,
    height: 40,
    backgroundColor: GLASS_BG,
    borderRadius: 20,
    borderWidth: 0.5, borderColor: GLASS_BORDER,
    paddingHorizontal: 16,
    justifyContent: 'center',
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },
  titleText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  mapTypeDot: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: GLASS_BG,
    borderWidth: 0.5, borderColor: GLASS_BORDER,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
  },

  // ── Info pill ───────────────────────────────────────────────────────────────
  infoPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: GLASS_BG,
    borderWidth: 0.5, borderColor: GLASS_BORDER,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 28,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '500',
  },
  pillDivider: {
    width: 1, height: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ── Empty / not found ────────────────────────────────────────────────────────
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  notFound: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,37,64,0.6)',
    zIndex: 20,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 28, paddingVertical: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptySubtitle: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
})
