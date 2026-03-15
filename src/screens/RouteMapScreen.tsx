import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated, ScrollView, PanResponder,
} from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { routesApi } from '../services/api'
import { RoutePoint } from '../types'
import { Colors } from '../constants/colors'

// ─── Config ─────────────────────────────────────────────────────────────────

const PIN_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  MARINA:    { color: Colors.marinaPin,    icon: 'boat',                    label: 'Marina' },
  ANCHORAGE: { color: Colors.anchoragePin, icon: 'location',                label: 'Anchorage' },
  WAYPOINT:  { color: Colors.textMuted,    icon: 'navigate-circle-outline', label: 'Waypoint' },
  POI:       { color: Colors.accent,       icon: 'star-outline',            label: 'Point of Interest' },
  DANGER:    { color: Colors.dangerPin,    icon: 'warning',                 label: 'Danger Zone' },
  FUEL:      { color: Colors.warning,      icon: 'flame-outline',           label: 'Fuel Stop' },
}

const PANEL_HEIGHT = 340

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function RouteMapScreen() {
  const { id, focusStop } = useLocalSearchParams<{ id: string; focusStop?: string }>()
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const translateY = useRef(new Animated.Value(PANEL_HEIGHT)).current
  const focusApplied = useRef(false)

  const [selectedPoint, setSelectedPoint] = useState<RoutePoint | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const { data: route } = useQuery({
    queryKey: ['route', id],
    queryFn: () => routesApi.get(id),
  })

  const { data: rawPoints = [], isLoading } = useQuery({
    queryKey: ['route-points', id],
    queryFn: () => routesApi.getPoints(id),
  })

  const points = useMemo(
    () => [...(rawPoints as RoutePoint[])].sort((a, b) => a.sequence - b.sequence),
    [rawPoints],
  )

  const coordinates = useMemo(
    () => points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [points],
  )

  // Fit map once both map is ready and points are loaded
  useEffect(() => {
    if (focusStop) return // focusStop effect handles camera
    if (mapReady && coordinates.length >= 2) {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 120, right: 48, bottom: PANEL_HEIGHT + 60, left: 48 },
        animated: true,
      })
    } else if (mapReady && coordinates.length === 1) {
      mapRef.current?.animateToRegion({
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      })
    }
  }, [mapReady, coordinates, focusStop])

  const openPanel = useCallback(
    (point: RoutePoint) => {
      setSelectedPoint(point)
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 9,
        tension: 80,
      }).start()
    },
    [translateY],
  )

  // Focus a specific leg when navigated from itinerary
  useEffect(() => {
    if (!focusStop || !mapReady || points.length === 0 || focusApplied.current) return
    const seq = parseInt(focusStop, 10)
    const toPoint = points.find((p) => p.sequence === seq)
    if (!toPoint) return
    focusApplied.current = true
    openPanel(toPoint)
    const fromPoint = points.find((p) => p.sequence === seq - 1)
    const legCoords = fromPoint
      ? [{ latitude: fromPoint.lat, longitude: fromPoint.lng }, { latitude: toPoint.lat, longitude: toPoint.lng }]
      : [{ latitude: toPoint.lat, longitude: toPoint.lng }]
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(legCoords, {
        edgePadding: { top: 100, right: 60, bottom: PANEL_HEIGHT + 80, left: 60 },
        animated: true,
      })
    }, 400)
  }, [mapReady, points, focusStop, openPanel])

  const closePanel = useCallback(() => {
    Animated.timing(translateY, {
      toValue: PANEL_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setSelectedPoint(null))
  }, [translateY])

  // Navigate map camera to a point
  const animateToPoint = useCallback((point: RoutePoint) => {
    mapRef.current?.animateToRegion({
      latitude: point.lat,
      longitude: point.lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 400)
  }, [])

  // Go to adjacent stop by index offset
  const navigateStop = useCallback((offset: number) => {
    if (!selectedPoint || points.length === 0) return
    const currentIdx = points.findIndex((p) => p.id === selectedPoint.id)
    if (currentIdx === -1) return
    const nextIdx = currentIdx + offset
    if (nextIdx < 0 || nextIdx >= points.length) return
    const nextPoint = points[nextIdx]
    openPanel(nextPoint)
    animateToPoint(nextPoint)
  }, [selectedPoint, points, openPanel, animateToPoint])

  // Keep a stable ref so the panResponder (created once) always calls the latest version
  const navigateStopRef = useRef(navigateStop)
  const closePanelRef = useRef(closePanel)
  navigateStopRef.current = navigateStop
  closePanelRef.current = closePanel

  // PanResponder for the panel: horizontal swipe → next/prev stop, vertical swipe down → close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, gs) =>
        (Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10) &&
        (Math.abs(gs.dx) > Math.abs(gs.dy) * 0.5 || gs.dy > 0),
      onPanResponderRelease: (_e, gs) => {
        const isHorizontal = Math.abs(gs.dx) > Math.abs(gs.dy)
        if (isHorizontal && Math.abs(gs.dx) > 50 && Math.abs(gs.dy) < 80) {
          // Horizontal swipe: left = next, right = prev
          if (gs.dx < 0) navigateStopRef.current(1)
          else navigateStopRef.current(-1)
        } else if (!isHorizontal && gs.dy > 60) {
          // Swipe down → close
          closePanelRef.current()
        }
      },
    })
  ).current

  // Separate PanResponder specifically for the drag handle (swipe-down only)
  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gs) =>
        Math.abs(gs.dy) > 8 && gs.dy > 0,
      onPanResponderMove: (_e, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy)
        }
      },
      onPanResponderRelease: (_e, gs) => {
        if (gs.dy > 60) {
          closePanelRef.current()
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 10,
            tension: 80,
          }).start()
        }
      },
    })
  ).current

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        onMapReady={() => setMapReady(true)}
        onPress={() => selectedPoint && closePanel()}
        showsUserLocation
        showsCompass={false}
        showsScale={false}
        initialRegion={{
          latitude: 37.9,
          longitude: 20.5,
          latitudeDelta: 8,
          longitudeDelta: 8,
        }}
      >
        {/* Route polyline */}
        {coordinates.length > 1 && (
          <Polyline
            coordinates={coordinates}
            strokeColor={Colors.routeLine}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Stop markers */}
        {points.map((point, index) => {
          const cfg = PIN_CONFIG[point.type] ?? PIN_CONFIG.WAYPOINT
          const isSelected = selectedPoint?.id === point.id
          return (
            <Marker
              key={point.id}
              coordinate={{ latitude: point.lat, longitude: point.lng }}
              onPress={(e) => {
                e.stopPropagation()
                openPanel(point)
                animateToPoint(point)
              }}
              tracksViewChanges={isSelected}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.markerOuter,
                  {
                    borderColor: cfg.color,
                    transform: [{ scale: isSelected ? 1.25 : 1 }],
                  },
                ]}
              >
                <View style={[styles.markerInner, { backgroundColor: cfg.color }]}>
                  <Text style={styles.markerNum}>{index + 1}</Text>
                </View>
              </View>
            </Marker>
          )
        })}
      </MapView>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={20} color={Colors.text} />
      </TouchableOpacity>

      {/* Title card */}
      {route && (
        <View style={[styles.titleCard, { top: insets.top + 12 }]}>
          <Text style={styles.titleText} numberOfLines={1}>
            {route.title}
          </Text>
          <Text style={styles.titleSub}>
            {points.length} stops · {route.totalNm} nm
          </Text>
        </View>
      )}

      {/* Legend */}
      <MapLegend bottomInset={insets.bottom} />

      {/* Bottom panel */}
      <Animated.View
        style={[
          styles.panel,
          { paddingBottom: Math.max(20, insets.bottom + 8), transform: [{ translateY }] },
        ]}
        pointerEvents={selectedPoint ? 'auto' : 'none'}
      >
        {selectedPoint && (
          <StopCard
            point={selectedPoint}
            index={points.indexOf(selectedPoint)}
            total={points.length}
            onClose={closePanel}
            panResponder={panResponder}
            handlePan={handlePan}
          />
        )}
      </Animated.View>
    </View>
  )
}

// ─── Map legend ──────────────────────────────────────────────────────────────

function MapLegend({ bottomInset }: { bottomInset: number }) {
  const [expanded, setExpanded] = useState(false)
  const legendItems = [
    { type: 'MARINA',    cfg: PIN_CONFIG.MARINA },
    { type: 'ANCHORAGE', cfg: PIN_CONFIG.ANCHORAGE },
    { type: 'FUEL',      cfg: PIN_CONFIG.FUEL },
    { type: 'DANGER',    cfg: PIN_CONFIG.DANGER },
  ]

  return (
    <View style={[styles.legend, { bottom: Math.max(20, bottomInset) + PANEL_HEIGHT + 12 }]}>
      {expanded && (
        <View style={styles.legendItems}>
          {legendItems.map(({ type, cfg }) => (
            <View key={type} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
              <Text style={styles.legendText}>{cfg.label}</Text>
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity
        style={styles.legendToggle}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={expanded ? 'close' : 'information-circle-outline'}
          size={18}
          color={Colors.secondary}
        />
      </TouchableOpacity>
    </View>
  )
}

// ─── Stop detail card ────────────────────────────────────────────────────────

interface StopCardProps {
  point: RoutePoint
  index: number
  total: number
  onClose: () => void
  panResponder: ReturnType<typeof PanResponder.create>
  handlePan: ReturnType<typeof PanResponder.create>
}

function StopCard({ point, index, total, onClose, panResponder, handlePan }: StopCardProps) {
  const cfg = PIN_CONFIG[point.type] ?? PIN_CONFIG.WAYPOINT

  return (
    <View {...panResponder.panHandlers}>
      {/* Drag handle — has its own swipe-down pan */}
      <View {...handlePan.panHandlers} style={styles.handleWrap}>
        <View style={styles.handleBar} />
      </View>

      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: cfg.color + '22' }]}>
          <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
        </View>

        <View style={styles.headerInfo}>
          <View style={styles.headerTopRow}>
            <Text style={styles.stopName} numberOfLines={1}>
              {point.name}
            </Text>
            <Text style={styles.stopOrder}>
              {index + 1} / {total}
            </Text>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: cfg.color + '18' }]}>
            <Text style={[styles.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={10} activeOpacity={0.7}>
          <Ionicons name="close" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {(point.distanceFromPrevNm != null ||
        point.sailTimeHours != null ||
        point.stayDurationHours != null) && (
        <View style={styles.statsRow}>
          {point.distanceFromPrevNm != null && (
            <StatPill icon="navigate-outline" value={`${point.distanceFromPrevNm} nm`} />
          )}
          {point.sailTimeHours != null && (
            <StatPill icon="time-outline" value={`${point.sailTimeHours}h sail`} />
          )}
          {point.stayDurationHours != null && (
            <StatPill icon="anchor-outline" value={`${point.stayDurationHours}h stay`} />
          )}
        </View>
      )}

      {/* Swipe hint */}
      {total > 1 && (
        <View style={styles.swipeHint}>
          <Ionicons name="swap-horizontal-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.swipeHintText}>Swipe left/right to navigate stops</Text>
        </View>
      )}

      {/* Scrollable content */}
      <ScrollView
        style={styles.cardScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {point.description ? (
          <Text style={styles.description}>{point.description}</Text>
        ) : null}

        {point.warnings.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>⚠️</Text>
            <Text style={[styles.infoText, { color: Colors.danger }]} numberOfLines={3}>
              {point.warnings[0]}
            </Text>
          </View>
        )}

        {point.weatherNotes ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>🌊</Text>
            <Text style={styles.infoText} numberOfLines={3}>
              {point.weatherNotes}
            </Text>
          </View>
        ) : null}

        {point.tips.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>💡</Text>
            <Text style={styles.infoText} numberOfLines={3}>
              {point.tips[0]}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function StatPill({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={12} color={Colors.secondary} />
      <Text style={styles.statPillText}>{value}</Text>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Floating controls
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },

  titleCard: {
    position: 'absolute',
    left: 68,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },
  titleText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  titleSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  // Markers
  markerOuter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerNum: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Legend
  legend: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendItems: { paddingHorizontal: 12, paddingTop: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Colors.textSecondary },
  legendToggle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },

  // Bottom panel
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },

  // Stop card internals
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  stopName: { fontSize: 17, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  stopOrder: { fontSize: 12, color: Colors.textMuted, flexShrink: 0 },
  typeBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeLabel: { fontSize: 12, fontWeight: '600' },
  closeBtn: { padding: 2 },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statPillText: { fontSize: 12, color: Colors.secondary, fontWeight: '500' },

  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  swipeHintText: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

  cardScroll: { maxHeight: 140, paddingHorizontal: 16 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 8 },
  infoRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginBottom: 6 },
  infoEmoji: { fontSize: 14, lineHeight: 20 },
  infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
})
