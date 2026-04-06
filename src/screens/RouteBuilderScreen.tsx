import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Animated, PanResponder, FlatList, Dimensions,
  Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { MaritimePolyline } from '../components/MaritimePolyline'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useMapMarkersStore } from '../store/mapMarkersStore'
import { MapMarker, MapMarkerCategory } from '../types/mapMarker'
import { UserRouteStop } from '../types/userRoute'
import { Colors } from '../constants/colors'
import { seedPlaces } from '../data/seedPlaces'
import { usePlacesStore } from '../store/placesStore'
import { Place } from '../types/place'
import { seaSafePath } from '../utils/seaRouter'
import { sharedMapRegion } from '../utils/sharedMapRegion'

// ── Layout constants ───────────────────────────────────────────────────────────

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window')

// The sheet has three snap states.
//
//  COLLAPSED — the thin collar always visible at the bottom (contains the CTA).
//              The map is fully usable; route building never blocked.
//  HALF      — user pulled up to review/edit their stops / saved places.
//  FULL      — fully expanded list.
//
// The CTA row lives inside the collar so it is visible at ALL snap states.
// After placing each waypoint the sheet snaps back to COLLAPSED automatically
// so the user always has a clear map and immediate access to Add Waypoint.

const SHEET_MAX_H    = Math.round(SCREEN_H * 0.68)
const COLLAR_H       = 230  // handle + day card (always visible) + phase actions + safe-area
const SNAP_COLLAPSED = SHEET_MAX_H - COLLAR_H
const SNAP_HALF      = Math.round(SHEET_MAX_H * 0.46)
const SNAP_FULL      = 0

const CROSSHAIR_SIZE = 44

const STOP_COLORS = ['#1B6CA8', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#00B4D8', '#F97316']

const STOP_TYPE_OPTIONS = [
  { type: 'CUSTOM',    label: 'Custom point', color: '#64748B' },
  { type: 'ANCHORAGE', label: 'Anchorage',    color: '#22C55E' },
  { type: 'MARINA',    label: 'Marina',       color: '#1B6CA8' },
  { type: 'BAY',       label: 'Bay',          color: '#00B4D8' },
  { type: 'BEACH',     label: 'Beach',        color: '#FF7043' },
  { type: 'LAGOON',    label: 'Lagoon',       color: '#0891B2' },
  { type: 'CAVE',      label: 'Cave',         color: '#7C3AED' },
  { type: 'FUEL',      label: 'Fuel stop',    color: '#F59E0B' },
]

type MarkerCategoryDef = { label: string; color: string; icon: string; stopType?: string }
const MARKER_CATEGORIES: Record<MapMarkerCategory, MarkerCategoryDef> = {
  ANCHORAGE:  { label: 'Anchorage',  color: '#22C55E', icon: 'boat-outline',      stopType: 'ANCHORAGE' },
  MARINA:     { label: 'Marina',     color: '#1B6CA8', icon: 'boat-outline',       stopType: 'MARINA'    },
  BAY:        { label: 'Bay',        color: '#00B4D8', icon: 'water-outline',      stopType: 'BAY'       },
  FUEL:       { label: 'Fuel',       color: '#F59E0B', icon: 'flash-outline',      stopType: 'FUEL'      },
  RESTAURANT: { label: 'Restaurant', color: '#F97316', icon: 'restaurant-outline', stopType: 'CUSTOM'    },
  BEACH:      { label: 'Beach',      color: '#FF7043', icon: 'sunny-outline',      stopType: 'BEACH'     },
  SNORKELING: { label: 'Snorkeling', color: '#06B6D4', icon: 'fish-outline',       stopType: 'CUSTOM'    },
  WARNING:    { label: 'Warning',    color: '#EF4444', icon: 'warning-outline',    stopType: 'CUSTOM'    },
  CUSTOM:     { label: 'Custom',     color: '#8B5CF6', icon: 'star-outline',       stopType: 'CUSTOM'    },
}
const MARKER_CATEGORY_LIST = Object.entries(MARKER_CATEGORIES) as [MapMarkerCategory, MarkerCategoryDef][]

// Quick-add type chips shown in the collar when adding waypoints
const QUICK_ADD_TYPES = [
  { type: 'MARINA',    label: 'Marina',   color: '#1B6CA8' },
  { type: 'ANCHORAGE', label: 'Anchor',   color: '#22C55E' },
  { type: 'BAY',       label: 'Bay',      color: '#00B4D8' },
  { type: 'BEACH',     label: 'Beach',    color: '#FF7043' },
  { type: 'CAVE',      label: 'Cave',     color: '#7C3AED' },
  { type: 'CUSTOM',    label: 'POI',      color: '#8B5CF6' },
]

// Stop types for intermediate waypoints (enrich phase)
const ENRICH_TYPES = [
  { type: 'BAY',       label: 'Bay',    color: '#00B4D8' },
  { type: 'BEACH',     label: 'Beach',  color: '#FF7043' },
  { type: 'ANCHORAGE', label: 'Anchor', color: '#22C55E' },
  { type: 'CAVE',      label: 'Cave',   color: '#7C3AED' },
  { type: 'FUEL',      label: 'Fuel',   color: '#F59E0B' },
  { type: 'CUSTOM',    label: 'POI',    color: '#8B5CF6' },
]

// Stop types for destination (define_end / add_alt_end phases)
const DEST_TYPES = [
  { type: 'ANCHORAGE', label: 'Anchorage', color: '#22C55E' },
  { type: 'MARINA',    label: 'Marina',    color: '#1B6CA8' },
  { type: 'BAY',       label: 'Bay',       color: '#00B4D8' },
  { type: 'BEACH',     label: 'Beach',     color: '#FF7043' },
]

// ── Haversine ─────────────────────────────────────────────────────────────────

function legNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

// ── Screen ─────────────────────────────────────────────────────────────────────

// ── Module-level camera persistence ──────────────────────────────────────────
// Initialised from the shared region so the builder opens wherever the user
// was on the Explore map.  Updated on every onRegionChangeComplete.
let _lastBuilderRegion = sharedMapRegion

export default function RouteBuilderScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const dayScrollRef = useRef<ScrollView>(null)

  const {
    draftRoute, addWaypoint, addWaypointToDay, removeStop, moveStop,
    updateDraftTitle, updateStopName, updateStopNotes, updateStopType,
    saveDraft, discardDraft, autoSplitDays, updateStopDayIndex,
  } = useRouteBuilderStore()

  const { markers, addMarker, updateMarker, removeMarker, loadMarkers } = useMapMarkersStore()
  useEffect(() => { loadMarkers() }, [])

  const { userPlaces } = usePlacesStore()
  const allPlaces = useMemo(() => [...seedPlaces, ...userPlaces], [userPlaces])

  const [titleFocused, setTitleFocused] = useState(false)
  const [mapMode, setMapMode] = useState<'route' | 'places'>('route')
  const [builderMode, setBuilderMode] = useState<'map' | 'plan'>('map')
  const [selectedAddType, setSelectedAddType] = useState('ANCHORAGE')

  // ── Phase state machine ───────────────────────────────────────────────────
  // define_start  → user places departure (Day N departure)
  // define_end    → user places today's main destination
  // day_options   → both placed; user enriches or advances to next day
  // add_alt_end   → user places backup anchorage for this day
  // add_stops     → user enriches the day with intermediate waypoints
  type BuilderPhase = 'define_start' | 'define_end' | 'day_options' | 'add_alt_end' | 'add_stops'
  const [phase, setPhase] = useState<BuilderPhase>('define_start')
  const [currentDay, setCurrentDay] = useState(0)
  const [destType, setDestType] = useState('ANCHORAGE')
  const [enrichType, setEnrichType] = useState('ANCHORAGE')

  // ── Per-day phase memory ──────────────────────────────────────────────────
  // Stores the last phase the user was in for each day index.
  // Prevents phase from resetting when the user swipes between days.
  const phaseByDay = useRef<Record<number, BuilderPhase>>({})

  // Switch the active day, saving the current phase for the day being left
  // and restoring the saved phase (or inferring it from stop data) for the
  // day being entered.  Pure view-state cursor — never mutates stop data.
  const switchToDay = useCallback((day: number) => {
    if (day === currentDay) return
    phaseByDay.current[currentDay] = phase          // save departing day's phase
    setCurrentDay(day)
    const saved = phaseByDay.current[day]
    if (saved) {
      setPhase(saved)
      return
    }
    // No saved phase yet — infer from stop data
    const dayStops = stops.filter(s => (s.dayIndex ?? 0) === day)
    const hasStart = dayStops.some(s => s.type === 'DAY_START')
                   || (day > 0 && stops.some(s => (s.dayIndex ?? 0) === day - 1 && s.type === 'DAY_END'))
    const hasEnd   = dayStops.some(s => s.type === 'DAY_END')
    setPhase(hasStart && hasEnd ? 'day_options' : hasStart ? 'define_end' : 'define_start')
  }, [currentDay, phase, stops])

  // Keep the pager scroll in sync when currentDay changes programmatically
  // (e.g. handleStartNextDay) so the visible page always matches state.
  useEffect(() => {
    const pageW = SCREEN_W - 28
    dayScrollRef.current?.scrollTo({ x: currentDay * pageW, animated: true })
  }, [currentDay])

  // First-use guidance (resets each session — intentional)
  const [showRouteHint,  setShowRouteHint]  = useState(true)
  const [showPlacesHint, setShowPlacesHint] = useState(true)

  // ── Map region tracking ───────────────────────────────────────────────────
  // Tracks the full region (including latitudeDelta) to compute the exact
  // coordinate under the crosshair, which is offset from the map centre.
  const mapRegionRef = useRef(_lastBuilderRegion)

  // ── Crosshair geometry ────────────────────────────────────────────────────
  // True centre of the visible map area (between header and sheet collar).
  // HEADER_H accounts for: title row (58) + builder mode toggle row (44)
  const HEADER_H     = insets.top + 102
  const mapAreaH     = SCREEN_H - HEADER_H - COLLAR_H
  const crosshairTop  = HEADER_H + mapAreaH / 2 - CROSSHAIR_SIZE / 2
  const crosshairLeft = SCREEN_W / 2 - CROSSHAIR_SIZE / 2

  // Returns the exact geographic coordinate under the crosshair by asking
  // the MapView to project the crosshair's screen pixel — no manual math.
  const getCrosshairCoord = useCallback(async () => {
    const x = SCREEN_W / 2
    const y = HEADER_H + mapAreaH / 2
    return mapRef.current?.coordinateForPoint({ x, y }) ?? mapRegionRef.current
  }, [HEADER_H, mapAreaH])

  // ── Day groups (for Plan mode) ─────────────────────────────────────────────
  const stops = draftRoute?.stops ?? []
  const dayGroups = useMemo(() => {
    if (stops.length === 0) return []
    const maxDay = Math.max(...stops.map((s) => s.dayIndex ?? 0))
    const groups: { day: number; stops: UserRouteStop[]; nm: number }[] = []
    for (let d = 0; d <= maxDay; d++) {
      const dayStops = stops
        .filter((s) => (s.dayIndex ?? 0) === d)
        .sort((a, b) => a.sequence - b.sequence)
      // nm = only start→end leg (intermediate stops are side trips, not route legs)
      const dayStart = dayStops.find(s => s.type === 'DAY_START')
      const dayEnd   = dayStops.find(s => s.type === 'DAY_END')
      const nm = (dayStart?.lat && dayStart?.lng && dayEnd?.lat && dayEnd?.lng)
        ? legNm(dayStart.lat, dayStart.lng, dayEnd.lat, dayEnd.lng)
        : 0
      if (dayStops.length > 0) groups.push({ day: d, stops: dayStops, nm: Math.round(nm * 10) / 10 })
    }
    return groups
  }, [stops])

  // ── Current day computed data ─────────────────────────────────────────────
  const currentDayAllStops = useMemo(() =>
    stops.filter(s => (s.dayIndex ?? 0) === currentDay).sort((a, b) => a.sequence - b.sequence),
    [stops, currentDay]
  )
  const currentDayAltEnd = currentDayAllStops.find(s => s.type === 'ALT_END')
  const altStops = stops.filter(s => s.type === 'ALT_END')

  // Route endpoints — explicit types only
  const currentDayEnd = currentDayAllStops.find(s => s.type === 'DAY_END')
  // Departure: explicit DAY_START for Day 1; for Day 2+ reuse previous day's DAY_END
  const currentDayStart = useMemo(() => {
    const explicit = currentDayAllStops.find(s => s.type === 'DAY_START')
    if (explicit) return explicit
    if (currentDay > 0) {
      return stops.find(s => (s.dayIndex ?? 0) === currentDay - 1 && s.type === 'DAY_END')
    }
    return undefined
  }, [currentDayAllStops, currentDay, stops])

  // Intermediate stops (not route endpoints, not alt) — shown as markers only
  const currentDayMain = currentDayAllStops.filter(s => s.type !== 'ALT_END')

  // Day leg distance: straight line start → end (intermediate stops are side trips)
  const currentDayNm = useMemo(() => {
    if (!currentDayStart?.lat || !currentDayStart?.lng || !currentDayEnd?.lat || !currentDayEnd?.lng) return 0
    return legNm(currentDayStart.lat, currentDayStart.lng, currentDayEnd.lat, currentDayEnd.lng)
  }, [currentDayStart, currentDayEnd])

  // ── Suggestions (nearby places along today's route) ───────────────────────
  const suggestions = useMemo(() => {
    if (phase !== 'add_stops' || !currentDayStart || !currentDayEnd) return []
    const minLat = Math.min(currentDayStart.lat!, currentDayEnd.lat!) - 0.4
    const maxLat = Math.max(currentDayStart.lat!, currentDayEnd.lat!) + 0.4
    const minLng = Math.min(currentDayStart.lng!, currentDayEnd.lng!) - 0.4
    const maxLng = Math.max(currentDayStart.lng!, currentDayEnd.lng!) + 0.4
    const addedIds = new Set(currentDayAllStops.map(s => s.placeId))
    return allPlaces
      .filter(p =>
        p.lat >= minLat && p.lat <= maxLat &&
        p.lng >= minLng && p.lng <= maxLng &&
        !addedIds.has(p.id)
      )
      .slice(0, 10)
  }, [phase, currentDayStart, currentDayEnd, currentDayAllStops, allPlaces])

  // ── Activation animation ──────────────────────────────────────────────────
  const [activating, setActivating] = useState(false)
  const placeAnim = useRef(new Animated.Value(0)).current

  // ── Sheet snap state ──────────────────────────────────────────────────────
  type SnapState = 'collapsed' | 'half' | 'full'
  const [snapState, setSnapState] = useState<SnapState>('collapsed')
  const sheetAnim  = useRef(new Animated.Value(SNAP_COLLAPSED)).current
  const lastY      = useRef(SNAP_COLLAPSED)
  const snapLabel  = useRef<SnapState>('collapsed')

  const snapTo = useCallback((target: number, label: SnapState) => {
    snapLabel.current = label
    lastY.current = target
    setSnapState(label)
    Animated.spring(sheetAnim, {
      toValue: target, useNativeDriver: true,
      bounciness: 3, speed: 14,
    }).start()
  }, [sheetAnim])

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 5,
    onPanResponderGrant: () => sheetAnim.stopAnimation(),
    onPanResponderMove: (_, g) => {
      // Clamp between FULL (0) and COLLAPSED (cannot go below collar)
      sheetAnim.setValue(Math.max(SNAP_FULL, Math.min(SNAP_COLLAPSED, lastY.current + g.dy)))
    },
    onPanResponderRelease: (_, g) => {
      const now = lastY.current + g.dy
      if (g.vy > 0.6) {
        // Fast swipe DOWN
        if (snapLabel.current === 'full') snapTo(SNAP_HALF, 'half')
        else snapTo(SNAP_COLLAPSED, 'collapsed')
      } else if (g.vy < -0.6) {
        // Fast swipe UP
        if (snapLabel.current === 'collapsed') snapTo(SNAP_HALF, 'half')
        else snapTo(SNAP_FULL, 'full')
      } else {
        // Slow drag — land on nearest snap point
        const snaps = [
          { t: SNAP_COLLAPSED, l: 'collapsed' as const },
          { t: SNAP_HALF,      l: 'half'      as const },
          { t: SNAP_FULL,      l: 'full'      as const },
        ]
        const nearest = snaps.sort((a, b) => Math.abs(a.t - now) - Math.abs(b.t - now))[0]
        snapTo(nearest.t, nearest.l)
      }
    },
  })).current

  // ── Phase initialization on mount ────────────────────────────────────────
  useEffect(() => {
    if (!draftRoute || stops.length === 0) {
      setPhase('define_start')
      setCurrentDay(0)
      return
    }
    const maxDay = Math.max(...stops.map(s => s.dayIndex ?? 0))
    setCurrentDay(maxDay)
    const dayStops = stops.filter(s => (s.dayIndex ?? 0) === maxDay)
    const hasDayEnd = dayStops.some(s => s.type === 'DAY_END')
    const hasDayStart = dayStops.some(s => s.type === 'DAY_START')
    // Day 0: need explicit start first; Day 2+: start is inherited, only need end
    if (!hasDayEnd && !hasDayStart && maxDay === 0) setPhase('define_start')
    else if (!hasDayEnd) setPhase('define_end')
    else setPhase('day_options')
  }, []) // intentionally empty deps — only run on mount

  // ── Route stop editor ─────────────────────────────────────────────────────

  const [editingStopId, setEditingStopId] = useState<string | null>(null)
  const [editName,  setEditName]  = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editType,  setEditType]  = useState('CUSTOM')

  const editingStopIndex = editingStopId ? stops.findIndex((s) => s.id === editingStopId) : -1

  const openStopEditor = useCallback((stop: UserRouteStop, index: number) => {
    setEditName(stop.name ?? `Stop ${index + 1}`)
    setEditNotes(stop.notes ?? '')
    setEditType(stop.type ?? 'CUSTOM')
    setEditingStopId(stop.id)
  }, [])

  const handleEditStopDone = useCallback(() => {
    if (!editingStopId) return
    updateStopName(editingStopId, editName.trim() || `Stop ${editingStopIndex + 1}`)
    updateStopNotes(editingStopId, editNotes.trim())
    updateStopType(editingStopId, editType)
    setEditingStopId(null)
  }, [editingStopId, editingStopIndex, editName, editNotes, editType,
      updateStopName, updateStopNotes, updateStopType])

  // ── Saved marker modals ────────────────────────────────────────────────────

  const [addingMarkerAt,    setAddingMarkerAt]    = useState<{ latitude: number; longitude: number } | null>(null)
  const [newMarkerTitle,    setNewMarkerTitle]    = useState('')
  const [newMarkerNote,     setNewMarkerNote]     = useState('')
  const [newMarkerCategory, setNewMarkerCategory] = useState<MapMarkerCategory>('ANCHORAGE')

  const [viewingMarkerId,    setViewingMarkerId]    = useState<string | null>(null)
  const [markerEditMode,     setMarkerEditMode]     = useState(false)
  const [editMarkerTitle,    setEditMarkerTitle]    = useState('')
  const [editMarkerNote,     setEditMarkerNote]     = useState('')
  const [editMarkerCategory, setEditMarkerCategory] = useState<MapMarkerCategory>('ANCHORAGE')

  const [filterCategory, setFilterCategory] = useState<MapMarkerCategory | null>(null)

  const viewingMarker = viewingMarkerId ? markers.find((m) => m.id === viewingMarkerId) ?? null : null

  const openMarkerViewer = useCallback((marker: MapMarker) => {
    setViewingMarkerId(marker.id)
    setMarkerEditMode(false)
    setEditMarkerTitle(marker.title)
    setEditMarkerNote(marker.note ?? '')
    setEditMarkerCategory(marker.category)
  }, [])

  const handleSaveNewMarker = useCallback(() => {
    if (!addingMarkerAt) return
    addMarker(
      addingMarkerAt.latitude, addingMarkerAt.longitude,
      newMarkerTitle.trim() || 'My Place',
      newMarkerCategory,
      newMarkerNote.trim() || undefined,
    )
    setAddingMarkerAt(null)
  }, [addingMarkerAt, newMarkerTitle, newMarkerNote, newMarkerCategory, addMarker])

  const handleSaveMarkerEdit = useCallback(() => {
    if (!viewingMarkerId) return
    updateMarker(viewingMarkerId, {
      title: editMarkerTitle.trim() || 'My Place',
      note: editMarkerNote.trim() || undefined,
      category: editMarkerCategory,
    })
    setMarkerEditMode(false)
  }, [viewingMarkerId, editMarkerTitle, editMarkerNote, editMarkerCategory, updateMarker])

  const handleDeleteMarker = useCallback(() => {
    if (!viewingMarkerId) return
    Alert.alert('Delete Place?', 'This saved place will be removed from your map.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: () => { removeMarker(viewingMarkerId); setViewingMarkerId(null) } },
    ])
  }, [viewingMarkerId, removeMarker])

  const handleAddMarkerToRoute = useCallback(() => {
    if (!viewingMarker) return
    const def = MARKER_CATEGORIES[viewingMarker.category]
    addWaypointToDay(viewingMarker.latitude, viewingMarker.longitude, currentDay, viewingMarker.title, def.stopType)
    setViewingMarkerId(null)
    setMapMode('route')
    snapTo(SNAP_COLLAPSED, 'collapsed')
  }, [viewingMarker, addWaypointToDay, currentDay, snapTo])

  // ── Primary action — place at crosshair ───────────────────────────────────

  const handleAddAtCenter = useCallback(async () => {
    const { latitude, longitude } = await getCrosshairCoord()

    if (phase === 'define_start') {
      setActivating(true)
      placeAnim.setValue(0)
      Animated.timing(placeAnim, { toValue: 1, duration: 500, useNativeDriver: true })
        .start(({ finished }) => {
          setActivating(false)
          if (finished) {
            addWaypointToDay(latitude, longitude, currentDay, `Day ${currentDay + 1} Start`, 'DAY_START')
            setPhase('define_end')
            setShowRouteHint(false)
          }
        })
    } else if (phase === 'define_end') {
      setActivating(true)
      placeAnim.setValue(0)
      Animated.timing(placeAnim, { toValue: 1, duration: 500, useNativeDriver: true })
        .start(({ finished }) => {
          setActivating(false)
          if (finished) {
            // Store update first — lets React render the polyline in this frame
            addWaypointToDay(latitude, longitude, currentDay, `Day ${currentDay + 1} End`, 'DAY_END')
            // Defer phase + sheet snap to next frame so the map layer has
            // time to mount the Polyline before further UI changes trigger re-renders
            requestAnimationFrame(() => {
              setPhase('day_options')
              snapTo(SNAP_COLLAPSED, 'collapsed')
            })
          }
        })
    } else if (phase === 'add_alt_end') {
      setActivating(true)
      placeAnim.setValue(0)
      Animated.timing(placeAnim, { toValue: 1, duration: 500, useNativeDriver: true })
        .start(({ finished }) => {
          setActivating(false)
          if (finished) {
            addWaypointToDay(latitude, longitude, currentDay, `Day ${currentDay + 1} Alt.`, 'ALT_END')
            requestAnimationFrame(() => { setPhase('day_options') })
          }
        })
    } else if (phase === 'add_stops') {
      setActivating(true)
      placeAnim.setValue(0)
      Animated.timing(placeAnim, { toValue: 1, duration: 500, useNativeDriver: true })
        .start(({ finished }) => {
          setActivating(false)
          if (finished) {
            // insertBeforeEnd=true: intermediate stops are placed before the day end, not after
            addWaypointToDay(latitude, longitude, currentDay, undefined, enrichType, true)
            snapTo(SNAP_HALF, 'half')
          }
        })
    } else if (mapMode === 'places') {
      // Places mode (legacy — still accessible via plan view context)
      setAddingMarkerAt({ latitude, longitude })
      setNewMarkerTitle('')
      setNewMarkerNote('')
      setNewMarkerCategory('ANCHORAGE')
      setShowPlacesHint(false)
    }
  }, [phase, currentDay, destType, enrichType, mapMode, addWaypointToDay, snapTo, placeAnim, getCrosshairCoord])

  // ── Start next day ────────────────────────────────────────────────────────
  const handleStartNextDay = useCallback(() => {
    phaseByDay.current[currentDay] = phase   // persist current day before leaving
    const nextDay = currentDay + 1
    setCurrentDay(nextDay)
    setPhase('define_end')                   // new day always begins at define_end
    snapTo(SNAP_COLLAPSED, 'collapsed')
  }, [currentDay, phase, snapTo])

  // ── Add suggestion to route ───────────────────────────────────────────────
  const handleAddSuggestion = useCallback((place: Place) => {
    // insertBeforeEnd=true so suggested places sit between start and end in the route
    addWaypointToDay(place.lat, place.lng, currentDay, place.name, place.type as string, true)
  }, [currentDay, addWaypointToDay])

  // ── Builder mode switch (Map ↔ Plan) ─────────────────────────────────────

  const handleSwitchToPlan = useCallback(() => {
    setBuilderMode('plan')
    // Auto-split if no day structure yet
    if (stops.every((s) => s.dayIndex == null)) autoSplitDays()
  }, [stops, autoSplitDays])

  // ── Mode switch ───────────────────────────────────────────────────────────

  const handleSetMode = useCallback((mode: 'route' | 'places') => {
    setMapMode(mode)
    // Expand to show the list when switching to places so the user can
    // immediately see their saved markers
    if (mode === 'places' && snapLabel.current === 'collapsed') snapTo(SNAP_HALF, 'half')
    // Collapse when returning to route so the map is clear for planning
    if (mode === 'route' && snapLabel.current !== 'collapsed') snapTo(SNAP_COLLAPSED, 'collapsed')
  }, [snapTo])

  // ── Map helpers ───────────────────────────────────────────────────────────

  // Route polyline: current day's DAY_START → DAY_END only.
  // Intermediate stops are side trips and do NOT influence the line.
  // seaSafePath() inserts hidden bend points when the direct line crosses land.
  const polylineCoords = useMemo(() => {
    if (!currentDayStart?.lat || !currentDayStart?.lng) return []
    if (!currentDayEnd?.lat   || !currentDayEnd?.lng)   return []
    return seaSafePath(
      currentDayStart.lat, currentDayStart.lng,
      currentDayEnd.lat,   currentDayEnd.lng,
    )
  }, [currentDayStart, currentDayEnd])

  const handleFitMap = useCallback(() => {
    const all = [
      ...polylineCoords,
      ...markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude })),
    ]
    if (all.length === 0) return
    mapRef.current?.fitToCoordinates(all, {
      edgePadding: { top: 100, right: 48, bottom: COLLAR_H + 60, left: 48 },
      animated: true,
    })
  }, [polylineCoords, markers])

  // ── Save / discard ────────────────────────────────────────────────────────

  const hasCompleteDay = stops.some(s => s.type === 'DAY_START') && stops.some(s => s.type === 'DAY_END')
  const canSave = !!(draftRoute?.title.trim() && hasCompleteDay)

  const handleSave = () => {
    if (!draftRoute?.title.trim()) { Alert.alert('Name required', 'Give your route a name first.'); return }
    if (!hasCompleteDay) { Alert.alert('Incomplete route', 'Set at least one departure and destination to save.'); return }
    const saved = saveDraft(() => null, 'DRAFT')
    if (saved) router.replace(`/user-route/${saved.id}`)
  }

  const handleDiscard = () => {
    Alert.alert('Discard Route?', 'All unsaved changes will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { discardDraft(); router.back() } },
    ])
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const visibleMarkers    = filterCategory ? markers.filter((m) => m.category === filterCategory) : markers
  const presentCategories = Array.from(new Set(markers.map((m) => m.category))) as MapMarkerCategory[]

  // Phase-aware activation animation color
  const activationColor = phase === 'define_start' ? '#22C55E'
    : phase === 'add_alt_end' ? '#F97316'
    : Colors.primary

  const isFirstRoute  = showRouteHint  && phase === 'define_start' && stops.length === 0
  const isFirstPlaces = showPlacesHint && mapMode === 'places' && markers.length === 0

  // ── No-draft guard ────────────────────────────────────────────────────────

  if (!draftRoute) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <Text style={s.centerText}>No active draft. Go back and start a new route.</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* ── Map mode: map + overlays ──────────────────────────────── */}
      {builderMode === 'map' && (
        <>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={_lastBuilderRegion}
            onRegionChangeComplete={(r) => {
              mapRegionRef.current = r
              _lastBuilderRegion = r
            }}
          >
            {/* Main route polyline (excludes ALT_END).
                key forces a native remount whenever endpoints change,
                fixing the RNMaps stale-layer bug where coordinate updates
                are ignored until an unrelated child is added.
                showArrows=false: the builder map is interactive — arrows are
                Markers and would intercept taps on the map canvas. */}
            {polylineCoords.length >= 2 && (
              <MaritimePolyline
                key={`route-${currentDayStart?.id ?? 'none'}-${currentDayEnd?.id ?? 'none'}-${altStops.length}`}
                coordinates={polylineCoords}
                color={Colors.secondary}
                strokeWidth={3}
                smoothPasses={1}
                dash
                showArrows={false}
              />
            )}

            {/* Alt-end connection lines: dashed orange from DAY_END → each ALT_END */}
            {stops.filter(s => s.type === 'ALT_END').map(altStop => {
              const dayEnd = stops.find(s2 => (s2.dayIndex ?? 0) === (altStop.dayIndex ?? 0) && s2.type === 'DAY_END')
              if (!dayEnd?.lat || !dayEnd?.lng || !altStop.lat || !altStop.lng) return null
              const altCoords = seaSafePath(dayEnd.lat, dayEnd.lng, altStop.lat, altStop.lng)
              return (
                <MaritimePolyline
                  key={`alt-line-${altStop.id}`}
                  coordinates={altCoords}
                  color="#F97316"
                  strokeWidth={2}
                  smoothPasses={1}
                  dash
                  showArrows={false}
                />
              )
            })}

            {/* Route endpoint markers (DAY_START, DAY_END) */}
            {stops.filter(s => s.type === 'DAY_START' || s.type === 'DAY_END').map(stop => {
              const isDayStart = stop.type === 'DAY_START'
              const isCurrentDay = (stop.dayIndex ?? 0) === currentDay
              const markerColor = isDayStart ? '#22C55E' : '#1B6CA8'
              return (
                <Marker key={stop.id}
                  coordinate={{ latitude: stop.lat!, longitude: stop.lng! }}
                  tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}
                  opacity={isCurrentDay ? 1 : 0.55}
                >
                  <View style={[s.routePin, { backgroundColor: markerColor, width: 32, height: 32, borderRadius: 16 }]}>
                    {isDayStart
                      ? <Ionicons name="boat-outline" size={14} color="#fff" />
                      : <Ionicons name="flag" size={14} color="#fff" />
                    }
                  </View>
                </Marker>
              )
            })}

            {/* Intermediate stop markers — standalone, NOT in route line */}
            {stops.filter(s => s.type !== 'DAY_START' && s.type !== 'DAY_END' && s.type !== 'ALT_END').map((stop, i) => {
              const isCurrentDay = (stop.dayIndex ?? 0) === currentDay
              return (
                <Marker key={stop.id}
                  coordinate={{ latitude: stop.lat!, longitude: stop.lng! }}
                  tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}
                  opacity={isCurrentDay ? 1 : 0.45}
                >
                  <View style={[s.routePin, { backgroundColor: STOP_COLORS[i % STOP_COLORS.length], width: 26, height: 26, borderRadius: 13 }]}>
                    <Text style={s.routePinText}>{i + 1}</Text>
                  </View>
                </Marker>
              )
            })}

            {/* Alt-end markers — distinct orange style */}
            {stops.filter(s => s.type === 'ALT_END').map(stop => {
              const isCurrentDay = (stop.dayIndex ?? 0) === currentDay
              return (
                <Marker key={stop.id}
                  coordinate={{ latitude: stop.lat!, longitude: stop.lng! }}
                  tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}
                  opacity={isCurrentDay ? 1 : 0.45}
                >
                  <View style={[s.routePin, { backgroundColor: '#F97316', width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff' }]}>
                    <Text style={[s.routePinText, { fontSize: 9 }]}>ALT</Text>
                  </View>
                </Marker>
              )
            })}
            {visibleMarkers.map((marker) => (
              <Marker key={marker.id}
                coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                tracksViewChanges={false} anchor={{ x: 0.5, y: 1.0 }}
                onPress={() => openMarkerViewer(marker)}>
                <SavedMarkerPin category={marker.category} />
              </Marker>
            ))}
          </MapView>

          {/* ── Crosshair ── */}
          {phase !== 'day_options' && (
            <View style={[s.crosshairWrap, { top: crosshairTop, left: crosshairLeft }]} pointerEvents="none">
              <CrosshairIndicator mode={mapMode} pulse={isFirstRoute || isFirstPlaces} />
            </View>
          )}

          {/* ── Map hints — shown under crosshair to guide placement ── */}
          {phase === 'define_start' && (
            <View style={[s.hintWrap, { top: crosshairTop + CROSSHAIR_SIZE + 14 }]} pointerEvents="none">
              <Text style={s.hintText}>
                {stops.length === 0
                  ? 'Pan to Day 1 departure — marina or anchorage'
                  : `Pan to Day ${currentDay + 1} departure`}
              </Text>
            </View>
          )}
          {phase === 'define_end' && (
            <View style={[s.hintWrap, { top: crosshairTop + CROSSHAIR_SIZE + 14 }]} pointerEvents="none">
              <Text style={s.hintText}>
                {currentDay > 0
                  ? `Pan to Day ${currentDay + 1} destination`
                  : `Pan to tonight's anchorage or marina`}
              </Text>
            </View>
          )}
          {phase === 'add_alt_end' && (
            <View style={[s.hintWrap, { top: crosshairTop + CROSSHAIR_SIZE + 14 }]} pointerEvents="none">
              <Text style={s.hintText}>Pan to a backup anchorage or bay</Text>
            </View>
          )}
          {phase === 'add_stops' && (
            <View style={[s.hintWrap, { top: crosshairTop + CROSSHAIR_SIZE + 14 }]} pointerEvents="none">
              <Text style={s.hintText}>Pan to a stop and tap the button below</Text>
            </View>
          )}
          {isFirstPlaces && (
            <View style={[s.hintWrap, { top: crosshairTop + CROSSHAIR_SIZE + 14 }]} pointerEvents="none">
              <Text style={s.hintText}>Pan to the spot you want to save</Text>
            </View>
          )}

          {/* ── Activation animation ── */}
          {activating && (
            <View style={[s.crosshairWrap, { top: crosshairTop, left: crosshairLeft }]} pointerEvents="none">
              <WaypointActivation anim={placeAnim} color={activationColor} />
            </View>
          )}
        </>
      )}

      {/* ── Floating header ──────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        {/* Row 1: back / title / save */}
        <View style={s.headerRow}>
          <TouchableOpacity style={s.circleBtn} onPress={handleDiscard}>
            <Ionicons name="close" size={18} color={Colors.text} />
          </TouchableOpacity>
          <TextInput
            style={[s.titleInput, titleFocused && s.titleInputFocused]}
            placeholder="Route name…"
            placeholderTextColor={Colors.textMuted}
            value={draftRoute.title}
            onChangeText={updateDraftTitle}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            maxLength={60}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[s.saveBtn, !canSave && s.saveBtnOff]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={s.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Map / Plan toggle */}
        <View style={s.builderToggle}>
          <TouchableOpacity
            style={[s.builderToggleBtn, builderMode === 'map' && s.builderToggleBtnActive]}
            onPress={() => setBuilderMode('map')}
            activeOpacity={0.8}
          >
            <Ionicons name="map-outline" size={14}
              color={builderMode === 'map' ? '#fff' : Colors.textSecondary} />
            <Text style={[s.builderToggleBtnText, builderMode === 'map' && { color: '#fff' }]}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.builderToggleBtn, builderMode === 'plan' && s.builderToggleBtnActive]}
            onPress={handleSwitchToPlan}
            activeOpacity={0.8}
          >
            <Ionicons name="list-outline" size={14}
              color={builderMode === 'plan' ? '#fff' : Colors.textSecondary} />
            <Text style={[s.builderToggleBtnText, builderMode === 'plan' && { color: '#fff' }]}>Plan</Text>
            {stops.length > 0 && (
              <View style={[s.badge, builderMode === 'plan' && s.badgeOnActive]}>
                <Text style={[s.badgeText, builderMode === 'plan' && { color: '#fff' }]}>{stops.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Plan mode view ─────────────────────────────────────────── */}
      {builderMode === 'plan' && (
        <ScrollView
          style={[s.planContainer, { paddingTop: HEADER_H }]}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: 16, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Auto-split control */}
          <View style={s.planAutoSplitRow}>
            <View style={s.planAutoSplitLeft}>
              <Text style={s.planAutoSplitLabel}>Days structure</Text>
              <Text style={s.planAutoSplitSub}>Auto-split by ~40 nm/day</Text>
            </View>
            <TouchableOpacity style={s.planAutoSplitBtn} onPress={() => autoSplitDays(40)} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={14} color={Colors.secondary} />
              <Text style={s.planAutoSplitBtnText}>Re-split</Text>
            </TouchableOpacity>
          </View>

          {/* Empty state */}
          {stops.length === 0 && (
            <View style={s.planEmpty}>
              <Ionicons name="navigate-circle-outline" size={36} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>No stops yet</Text>
              <Text style={s.emptySub}>Switch to Map mode to add waypoints</Text>
              <TouchableOpacity style={s.planGoMapBtn} onPress={() => setBuilderMode('map')} activeOpacity={0.8}>
                <Ionicons name="map-outline" size={14} color="#fff" />
                <Text style={s.planGoMapBtnText}>Open Map</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Day cards */}
          {dayGroups.map((group) => {
            const dayColor = STOP_COLORS[group.day % STOP_COLORS.length]
            return (
              <View key={group.day} style={s.dayCard}>
                {/* Day card header */}
                <View style={[s.dayCardHeader, { backgroundColor: dayColor + '18', borderColor: dayColor + '35' }]}>
                  <View style={[s.dayCardDot, { backgroundColor: dayColor }]} />
                  <Text style={[s.dayCardTitle, { color: dayColor }]}>Day {group.day + 1}</Text>
                  {group.nm > 0 && (
                    <Text style={[s.dayCardNm, { color: dayColor }]}>{group.nm} nm</Text>
                  )}
                  <Text style={[s.dayCardCount, { color: dayColor + 'AA' }]}>
                    {(() => {
                      const n = group.stops.filter(s => s.type !== 'ALT_END').length
                      return `${n} stop${n !== 1 ? 's' : ''}`
                    })()}
                  </Text>
                </View>

                {/* Stops in this day */}
                {group.stops.map((stop, idx) => {
                  const globalIdx = stops.findIndex((s2) => s2.id === stop.id)
                  const nextInDay = group.stops[idx + 1]
                  const legDist = (stop.lat != null && stop.lng != null && nextInDay?.lat != null && nextInDay?.lng != null)
                    ? legNm(stop.lat, stop.lng, nextInDay.lat, nextInDay.lng) : null
                  const typeColor = stop.type === 'DAY_START' ? '#22C55E'
                    : stop.type === 'DAY_END' ? '#1B6CA8'
                    : stop.type === 'ALT_END' ? '#F97316'
                    : (stop.type && stop.type !== 'CUSTOM' ? TYPE_COLOR[stop.type] : Colors.textMuted)
                  const typeLabel = stop.type === 'DAY_START' ? 'Departure'
                    : stop.type === 'DAY_END' ? 'Destination'
                    : stop.type === 'ALT_END' ? 'Alt. Destination'
                    : (STOP_TYPE_OPTIONS.find((o) => o.type === (stop.type ?? 'CUSTOM'))?.label ?? 'Stop')
                  // Only show leg distance between main route points (not to/from stops or alt)
                  const showLeg = stop.type === 'DAY_START' && nextInDay?.type === 'DAY_END'

                  return (
                    <View key={stop.id} style={s.planStopRow}>
                      {/* Left: sequence dot + connector */}
                      <View style={s.planSeqCol}>
                        <View style={[s.dot, { backgroundColor: STOP_COLORS[globalIdx % STOP_COLORS.length] }]}>
                          <Text style={s.dotText}>{globalIdx + 1}</Text>
                        </View>
                        {idx < group.stops.length - 1 && <View style={s.connector} />}
                      </View>

                      {/* Right: stop info + actions */}
                      <View style={s.planStopCard}>
                        <View style={s.planStopCardRow}>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => openStopEditor(stop, globalIdx)} activeOpacity={0.7}>
                            <Text style={s.stopName} numberOfLines={1}>{stop.name ?? `Stop ${globalIdx + 1}`}</Text>
                            <View style={[s.typeBadge, { backgroundColor: typeColor + '20' }]}>
                              <View style={[s.typeDot, { backgroundColor: typeColor }]} />
                              <Text style={[s.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
                            </View>
                          </TouchableOpacity>
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            <TouchableOpacity
                              style={s.planStopAction}
                              onPress={() => openStopEditor(stop, globalIdx)}
                              activeOpacity={0.75}
                            >
                              <Ionicons name="pencil-outline" size={14} color={Colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={s.planStopAction}
                              onPress={() => {
                                const dayOptions = Array.from({ length: Math.max(...stops.map((s2) => s2.dayIndex ?? 0)) + 2 }, (_, i) => i)
                                  .filter((d) => d !== (stop.dayIndex ?? 0))
                                Alert.alert(
                                  'Move to Day',
                                  `Move "${stop.name ?? `Stop ${globalIdx + 1}`}" to:`,
                                  [
                                    ...dayOptions.map((d) => ({
                                      text: `Day ${d + 1}`,
                                      onPress: () => updateStopDayIndex(stop.id, d),
                                    })),
                                    { text: 'Cancel', style: 'cancel' as const },
                                  ]
                                )
                              }}
                              activeOpacity={0.75}
                            >
                              <Ionicons name="swap-vertical-outline" size={14} color={Colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {showLeg && legDist !== null && (
                          <View style={s.legRow}>
                            <Ionicons name="arrow-down" size={10} color={Colors.textMuted} />
                            <Text style={s.legText}>{legDist} nm</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )
                })}
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* ── Bottom sheet (map mode only) ───────────────────────────── */}
      {builderMode === 'map' && (
      <Animated.View style={[s.sheet, { height: SHEET_MAX_H, transform: [{ translateY: sheetAnim }] }]}>

        {/* ── Collar (drag target + always-visible day context) ── */}
        <View style={s.collar} {...panResponder.panHandlers}>
          <View style={s.handle} />

          {/* ── Day pager — swipe left/right to browse days ──────────
               Each page is one full-collar-width card for day i.
               Dots at top-right are tappable to jump directly.       */}
          {(() => {
            const totalPages = currentDay + 1
            const pageW = SCREEN_W - 28   // collar paddingHorizontal 14 × 2
            return (
              <ScrollView
                ref={dayScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={totalPages > 1}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / pageW)
                  switchToDay(idx)
                }}
                style={{ marginHorizontal: -14 }}
                contentContainerStyle={{ paddingHorizontal: 0 }}
              >
                {Array.from({ length: totalPages }, (_, i) => {
                  const group = dayGroups.find(g => g.day === i)
                  const pgStart = group?.stops.find(s => s.type === 'DAY_START')
                                ?? (i > 0 ? stops.find(s => (s.dayIndex ?? 0) === i - 1 && s.type === 'DAY_END') : undefined)
                  const pgEnd   = group?.stops.find(s => s.type === 'DAY_END')
                  const pgAlt   = group?.stops.find(s => s.type === 'ALT_END')
                  const pgNm    = group?.nm ?? 0
                  const pgDone  = !!(pgStart && pgEnd)
                  const isActive = i === currentDay

                  return (
                    <View key={i} style={{ width: pageW, paddingHorizontal: 14 }}>
                      <View style={s.collarDayCard}>
                        {/* Day header */}
                        <View style={s.collarDayHeader}>
                          <View style={[s.dayCardTag, pgDone && { backgroundColor: '#22C55E18' }]}>
                            <Text style={[s.dayCardTagText, pgDone && { color: '#22C55E' }]}>
                              {pgDone ? `Day ${i + 1} ✓` : `Day ${i + 1}`}
                            </Text>
                          </View>
                          {pgNm > 0 && <Text style={s.dayCardNmText}>{pgNm} nm</Text>}
                          <View style={s.dayDots}>
                            {Array.from({ length: totalPages }, (_, j) => (
                              <TouchableOpacity
                                key={j}
                                hitSlop={8}
                                onPress={() => {
                                  dayScrollRef.current?.scrollTo({ x: j * pageW, animated: true })
                                  switchToDay(j)
                                }}
                              >
                                <View style={[s.dayDot, { backgroundColor: j === currentDay ? Colors.secondary : Colors.border }]} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {/* Leg: departure → destination */}
                        <View style={s.collarLegRow}>
                          <TouchableOpacity
                            style={[s.legBox, i > 0 && s.legBoxDisabled, (isActive && phase === 'define_start') && s.legBoxActive]}
                            onPress={() => {
                              if (i > 0) return
                              switchToDay(0)
                              setPhase('define_start')
                              snapTo(SNAP_COLLAPSED, 'collapsed')
                            }}
                            activeOpacity={i === 0 ? 0.75 : 1}
                          >
                            <View style={[s.legBoxIcon, { backgroundColor: pgStart ? '#22C55E' : Colors.border }]}>
                              <Ionicons name="boat-outline" size={11} color={pgStart ? '#fff' : Colors.textMuted} />
                            </View>
                            <Text style={[s.legBoxText, !pgStart && s.legBoxTextEmpty]} numberOfLines={1}>
                              {pgStart?.name ?? 'Set departure'}
                            </Text>
                          </TouchableOpacity>

                          <View style={s.legArrow}>
                            <View style={s.legArrowLine} />
                            <Ionicons name="chevron-forward" size={10} color={Colors.textMuted} />
                          </View>

                          <TouchableOpacity
                            style={[s.legBox, !pgStart && s.legBoxDisabled, (isActive && phase === 'define_end') && s.legBoxActiveEnd]}
                            onPress={() => {
                              if (!pgStart) return
                              switchToDay(i)
                              setPhase('define_end')
                              snapTo(SNAP_COLLAPSED, 'collapsed')
                            }}
                            activeOpacity={pgStart ? 0.75 : 1}
                          >
                            <View style={[s.legBoxIcon, { backgroundColor: pgEnd ? '#1B6CA8' : Colors.border }]}>
                              <Ionicons name="flag" size={11} color={pgEnd ? '#fff' : Colors.textMuted} />
                            </View>
                            <Text style={[s.legBoxText, !pgEnd && s.legBoxTextEmpty]} numberOfLines={1}>
                              {pgEnd?.name ?? 'Set destination'}
                            </Text>
                            {pgAlt && (
                              <View style={s.legAltPill}>
                                <Text style={s.legAltPillText}>+ALT</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </ScrollView>
            )
          })()}

          {/* ── Phase action zone — below the day card ── */}

          {/* define_start: pan + place departure */}
          {phase === 'define_start' && (
            <View style={[s.phaseActions, { paddingBottom: insets.bottom > 0 ? insets.bottom + 2 : 12 }]}>
              <TouchableOpacity
                style={[s.phaseCTA, { backgroundColor: '#22C55E', opacity: activating ? 0.6 : 1 }]}
                onPress={handleAddAtCenter} disabled={activating} activeOpacity={0.84}
              >
                <Ionicons name="boat-outline" size={17} color="#fff" />
                <Text style={s.phaseCTAText}>{activating ? 'Placing…' : 'Set Departure'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* define_end: type chips + place destination */}
          {phase === 'define_end' && (
            <View style={[s.phaseActions, { paddingBottom: insets.bottom > 0 ? insets.bottom + 2 : 12 }]}>
              {currentDay > 0 && (
                <Text style={s.phaseContinuingFrom}>
                  Continuing from: {stops.filter(s2 => (s2.dayIndex ?? 0) === currentDay - 1 && s2.type !== 'ALT_END').sort((a, b) => b.sequence - a.sequence)[0]?.name ?? 'previous stop'}
                </Text>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeChipScroll} contentContainerStyle={s.typeChipRow}>
                {DEST_TYPES.map((dt) => (
                  <TouchableOpacity key={dt.type}
                    style={[s.typeChip, destType === dt.type && { borderColor: dt.color, backgroundColor: dt.color + '20' }]}
                    onPress={() => setDestType(dt.type)} activeOpacity={0.75}>
                    <View style={[s.typeChipDot, { backgroundColor: dt.color }]} />
                    <Text style={[s.typeChipText, destType === dt.type && { color: dt.color, fontWeight: '700' }]}>{dt.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[s.phaseCTA, { backgroundColor: Colors.primary, opacity: activating ? 0.6 : 1 }]}
                onPress={handleAddAtCenter} disabled={activating} activeOpacity={0.84}
              >
                <Ionicons name="flag" size={17} color="#fff" />
                <Text style={s.phaseCTAText}>{activating ? 'Placing…' : 'Set Destination'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* day_options: enrich or advance */}
          {phase === 'day_options' && (
            <View style={[s.phaseActions, { paddingBottom: insets.bottom > 0 ? insets.bottom + 2 : 12 }]}>
              <View style={s.dayOptionsRow}>
                {/* Backup anchorage */}
                <TouchableOpacity
                  style={[s.dayOptionBtn, currentDayAltEnd && { borderColor: '#F97316' + '60', backgroundColor: '#F97316' + '08' }]}
                  onPress={() => {
                    if (currentDayAltEnd) removeStop(currentDayAltEnd.id, () => null)
                    setPhase('add_alt_end')
                    snapTo(SNAP_COLLAPSED, 'collapsed')
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="git-branch-outline" size={14} color={currentDayAltEnd ? '#F97316' : Colors.textSecondary} />
                  <Text style={[s.dayOptionText, currentDayAltEnd && { color: '#F97316' }]}>
                    {currentDayAltEnd ? '✓ Backup' : '+ Backup'}
                  </Text>
                </TouchableOpacity>

                {/* Add stops / enrich — count intermediate stops only */}
                {(() => {
                  const intermCount = currentDayAllStops.filter(s =>
                    s.type !== 'DAY_START' && s.type !== 'DAY_END' && s.type !== 'ALT_END'
                  ).length
                  return (
                    <TouchableOpacity
                      style={[s.dayOptionBtn, intermCount > 0 && { borderColor: Colors.primary + '60', backgroundColor: Colors.primary + '08' }]}
                      onPress={() => { setPhase('add_stops'); snapTo(SNAP_HALF, 'half') }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add-circle-outline" size={14}
                        color={intermCount > 0 ? Colors.primary : Colors.secondary} />
                      <Text style={[s.dayOptionText, { color: intermCount > 0 ? Colors.primary : Colors.secondary }]}>
                        {intermCount > 0 ? `${intermCount} stop${intermCount !== 1 ? 's' : ''}` : '+ Stops'}
                      </Text>
                    </TouchableOpacity>
                  )
                })()}
              </View>

              <View style={s.dayPrimaryRow}>
                <TouchableOpacity
                  style={s.dayOptionBtnPrimary}
                  onPress={handleStartNextDay}
                  activeOpacity={0.84}
                >
                  <Text style={s.dayOptionPrimaryText}>Day {currentDay + 2}</Text>
                  <Ionicons name="chevron-forward" size={15} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.dayOptionBtnSave, canSave && { backgroundColor: Colors.secondary }]}
                  onPress={handleSave}
                  activeOpacity={0.84}
                  disabled={!canSave}
                >
                  <Ionicons name="checkmark" size={15} color={canSave ? '#fff' : Colors.textMuted} />
                  <Text style={[s.dayOptionPrimaryText, !canSave && { color: Colors.textMuted }]}>Save Route</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* add_alt_end: place backup anchorage */}
          {phase === 'add_alt_end' && (
            <View style={[s.phaseActions, { paddingBottom: insets.bottom > 0 ? insets.bottom + 2 : 12 }]}>
              <View style={s.phaseRow}>
                <TouchableOpacity style={s.phaseCancelBtn} onPress={() => setPhase('day_options')} activeOpacity={0.8}>
                  <Text style={s.phaseCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.phaseCTA, { flex: 1, backgroundColor: '#F97316', opacity: activating ? 0.6 : 1 }]}
                  onPress={handleAddAtCenter} disabled={activating} activeOpacity={0.84}
                >
                  <Ionicons name="git-branch-outline" size={17} color="#fff" />
                  <Text style={s.phaseCTAText}>{activating ? 'Placing…' : 'Set Backup Destination'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* add_stops: enrich with intermediate waypoints */}
          {phase === 'add_stops' && (
            <View style={[s.phaseActions, { paddingBottom: insets.bottom > 0 ? insets.bottom + 2 : 10 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeChipScroll} contentContainerStyle={s.typeChipRow}>
                {ENRICH_TYPES.map((et) => (
                  <TouchableOpacity key={et.type}
                    style={[s.typeChip, enrichType === et.type && { borderColor: et.color, backgroundColor: et.color + '20' }]}
                    onPress={() => setEnrichType(et.type)} activeOpacity={0.75}>
                    <View style={[s.typeChipDot, { backgroundColor: et.color }]} />
                    <Text style={[s.typeChipText, enrichType === et.type && { color: et.color, fontWeight: '700' }]}>{et.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={s.phaseRow}>
                <TouchableOpacity
                  style={[s.phaseCTA, { flex: 1, backgroundColor: Colors.primary, opacity: activating ? 0.6 : 1 }]}
                  onPress={handleAddAtCenter} disabled={activating} activeOpacity={0.84}
                >
                  <Ionicons name="add-circle-outline" size={17} color="#fff" />
                  <Text style={s.phaseCTAText}>{activating ? 'Placing…' : '+ Tap map to add stop'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.phaseDoneBtn}
                  onPress={() => { setPhase('day_options'); snapTo(SNAP_COLLAPSED, 'collapsed') }}
                  activeOpacity={0.8}
                >
                  <Text style={s.phaseDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Expanded content — visible only when pulled up ── */}
        <View style={s.expandedContent}>
          {/* Divider + summary bar */}
          <View style={s.summaryBar}>
            {mapMode === 'route' ? (
              <View style={s.statsRow}>
                {stops.length > 0 && (
                  <View style={s.statPill}>
                    <Ionicons name="location-outline" size={12} color={Colors.secondary} />
                    <Text style={s.statText}>{stops.length} stop{stops.length !== 1 ? 's' : ''}</Text>
                  </View>
                )}
                {(draftRoute.totalNm ?? 0) > 0 && (
                  <View style={s.statPill}>
                    <Ionicons name="navigate-outline" size={12} color={Colors.secondary} />
                    <Text style={s.statText}>{draftRoute.totalNm} nm</Text>
                  </View>
                )}
                {(draftRoute.estimatedDays ?? 0) > 0 && (
                  <View style={s.statPill}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.secondary} />
                    <Text style={s.statText}>{draftRoute.estimatedDays}d</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={s.statsRow}>
                {markers.length > 0 && (
                  <View style={[s.statPill, { backgroundColor: '#0891B2' + '14' }]}>
                    <Ionicons name="bookmark-outline" size={12} color="#0891B2" />
                    <Text style={[s.statText, { color: '#0891B2' }]}>
                      {markers.length} place{markers.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                {/* Category filter chips */}
                {presentCategories.length > 1 && presentCategories.map((cat) => {
                  const def = MARKER_CATEGORIES[cat]
                  const active = filterCategory === cat
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[s.filterChip, active && { borderColor: def.color, backgroundColor: def.color + '20' }]}
                      onPress={() => setFilterCategory(active ? null : cat)}
                    >
                      <View style={[s.filterDot, { backgroundColor: def.color }]} />
                      <Text style={[s.filterChipText, active && { color: def.color, fontWeight: '700' }]}>
                        {def.label}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>

          {/* Suggestions — "Along Day N" section, shown when enriching */}
          {phase === 'add_stops' && (
            <View style={s.suggestionsPanel}>
              {/* Section header */}
              <View style={s.suggestionsSectionHeader}>
                <View style={[s.suggestionsSectionTag, { backgroundColor: Colors.primary + '14' }]}>
                  <Text style={[s.suggestionsSectionTagText, { color: Colors.primary }]}>
                    Day {currentDay + 1}
                  </Text>
                </View>
                <Text style={s.suggestionsTitle}>
                  {suggestions.length > 0
                    ? `${suggestions.length} place${suggestions.length !== 1 ? 's' : ''} along the route`
                    : 'No places found nearby'}
                </Text>
              </View>

              {suggestions.length === 0 ? (
                <Text style={s.suggestionsEmpty}>
                  Pan the map and tap "+ Tap map to add stop" to place a waypoint manually.
                </Text>
              ) : suggestions.map((place) => {
                const typeColor = TYPE_COLOR[place.type?.toUpperCase() ?? 'CUSTOM'] ?? Colors.textMuted
                return (
                  <TouchableOpacity key={place.id} style={s.suggestionRow} onPress={() => handleAddSuggestion(place)} activeOpacity={0.8}>
                    <View style={[s.suggestionIcon, { backgroundColor: typeColor + '20' }]}>
                      <Ionicons name="location-outline" size={16} color={typeColor} />
                    </View>
                    <View style={s.suggestionBody}>
                      <Text style={s.suggestionName} numberOfLines={1}>{place.name}</Text>
                      <Text style={[s.suggestionType, { color: typeColor }]}>{place.type}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.suggestionAddBtn, { backgroundColor: typeColor + '18', borderColor: typeColor + '40' }]}
                      onPress={() => handleAddSuggestion(place)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add" size={16} color={typeColor} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* List */}
          {mapMode === 'route' ? (
            <FlatList
              data={stops}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 16 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={s.emptyList}>
                  <Ionicons name="navigate-circle-outline" size={32} color={Colors.textMuted} />
                  <Text style={s.emptyTitle}>No waypoints yet</Text>
                  <Text style={s.emptySub}>Pan the map to your first stop, then tap Set Departure</Text>
                </View>
              }
              renderItem={({ item: stop, index: i }) => (
                <StopRow
                  stop={stop} index={i} total={stops.length}
                  onEdit={() => openStopEditor(stop, i)}
                  onMoveUp={() => moveStop(i, i - 1, () => null)}
                  onMoveDown={() => moveStop(i, i + 1, () => null)}
                  onRemove={() => removeStop(stop.id, () => null)}
                  nextStop={stops[i + 1]}
                />
              )}
            />
          ) : (
            <FlatList
              data={visibleMarkers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 16 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={s.emptyList}>
                  <Ionicons name="bookmark-outline" size={32} color={Colors.textMuted} />
                  <Text style={s.emptyTitle}>
                    {filterCategory ? `No ${MARKER_CATEGORIES[filterCategory].label} places` : 'No saved places yet'}
                  </Text>
                  <Text style={s.emptySub}>Pan to a spot you want to remember, then tap Add Place</Text>
                </View>
              }
              renderItem={({ item: marker }) => (
                <MarkerRow marker={marker} onPress={() => openMarkerViewer(marker)} />
              )}
            />
          )}
        </View>
      </Animated.View>
      )}

      {/* ── Route stop editor modal ───────────────────────────────── */}
      <Modal visible={editingStopId !== null} transparent animationType="slide" onRequestClose={handleEditStopDone}>
        <KeyboardAvoidingView style={s.modalOuter} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleEditStopDone} />
          <View style={[s.editSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.editHandle} />
            <View style={s.editHeader}>
              <Text style={s.editTitle}>Stop {editingStopIndex >= 0 ? editingStopIndex + 1 : ''}</Text>
              <TouchableOpacity style={s.editDoneBtn} onPress={handleEditStopDone} activeOpacity={0.8}>
                <Text style={s.editDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.editLabel}>Name</Text>
            <TextInput style={s.editInput} value={editName} onChangeText={setEditName}
              placeholder={`Stop ${editingStopIndex + 1}`} placeholderTextColor={Colors.textMuted}
              maxLength={60} returnKeyType="next" />
            <Text style={s.editLabel}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
              {STOP_TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt.type}
                  style={[s.chip, editType === opt.type && { borderColor: opt.color, backgroundColor: opt.color + '18' }]}
                  onPress={() => setEditType(opt.type)} activeOpacity={0.75}>
                  <View style={[s.chipDot, { backgroundColor: opt.color }]} />
                  <Text style={[s.chipText, editType === opt.type && { color: opt.color, fontWeight: '700' }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.editLabel}>Skipper notes <Text style={s.editLabelOpt}>(optional)</Text></Text>
            <TextInput style={s.editNotesInput} value={editNotes} onChangeText={setEditNotes}
              placeholder="Good lunch stop · fuel available · exposed in north wind…"
              placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} maxLength={280} textAlignVertical="top" />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Quick-add place modal ─────────────────────────────────── */}
      <Modal visible={addingMarkerAt !== null} transparent animationType="slide"
        onRequestClose={() => setAddingMarkerAt(null)}>
        <KeyboardAvoidingView style={s.modalOuter} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAddingMarkerAt(null)} />
          <View style={[s.editSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.editHandle} />
            <View style={s.editHeader}>
              <View>
                <Text style={s.editTitle}>Save Place</Text>
                {addingMarkerAt && (
                  <Text style={s.editSubtitle}>
                    {addingMarkerAt.latitude.toFixed(4)}°, {addingMarkerAt.longitude.toFixed(4)}°
                  </Text>
                )}
              </View>
              <TouchableOpacity style={[s.editDoneBtn, { backgroundColor: '#0891B2' }]}
                onPress={handleSaveNewMarker} activeOpacity={0.8}>
                <Text style={s.editDoneText}>Add</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.editLabel}>Name</Text>
            <TextInput style={s.editInput} value={newMarkerTitle} onChangeText={setNewMarkerTitle}
              placeholder="e.g. Great anchorage, Fuel dock…" placeholderTextColor={Colors.textMuted}
              maxLength={60} returnKeyType="next" autoFocus />
            <Text style={s.editLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
              {MARKER_CATEGORY_LIST.map(([cat, def]) => (
                <TouchableOpacity key={cat}
                  style={[s.chip, newMarkerCategory === cat && { borderColor: def.color, backgroundColor: def.color + '18' }]}
                  onPress={() => setNewMarkerCategory(cat)} activeOpacity={0.75}>
                  <View style={[s.chipDot, { backgroundColor: def.color }]} />
                  <Text style={[s.chipText, newMarkerCategory === cat && { color: def.color, fontWeight: '700' }]}>{def.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.editLabel}>Note <Text style={s.editLabelOpt}>(optional)</Text></Text>
            <TextInput style={s.editNotesInput} value={newMarkerNote} onChangeText={setNewMarkerNote}
              placeholder="Depths, hazards, hours, anything worth remembering…"
              placeholderTextColor={Colors.textMuted} multiline numberOfLines={3} maxLength={280} textAlignVertical="top" />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Saved marker detail / edit modal ─────────────────────── */}
      <Modal visible={viewingMarkerId !== null} transparent animationType="slide"
        onRequestClose={() => { setViewingMarkerId(null); setMarkerEditMode(false) }}>
        <KeyboardAvoidingView style={s.modalOuter} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1}
            onPress={() => { setViewingMarkerId(null); setMarkerEditMode(false) }} />
          {viewingMarker && (
            <View style={[s.editSheet, { paddingBottom: insets.bottom + 16 }]}>
              <View style={s.editHandle} />
              {markerEditMode ? (
                <>
                  <View style={s.editHeader}>
                    <Text style={s.editTitle}>Edit Place</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={[s.editDoneBtn, { backgroundColor: Colors.border, paddingHorizontal: 14 }]}
                        onPress={() => setMarkerEditMode(false)} activeOpacity={0.8}>
                        <Text style={[s.editDoneText, { color: Colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.editDoneBtn, { backgroundColor: Colors.primary }]}
                        onPress={handleSaveMarkerEdit} activeOpacity={0.8}>
                        <Text style={s.editDoneText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={s.editLabel}>Name</Text>
                  <TextInput style={s.editInput} value={editMarkerTitle} onChangeText={setEditMarkerTitle}
                    maxLength={60} returnKeyType="next" autoFocus />
                  <Text style={s.editLabel}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
                    {MARKER_CATEGORY_LIST.map(([cat, def]) => (
                      <TouchableOpacity key={cat}
                        style={[s.chip, editMarkerCategory === cat && { borderColor: def.color, backgroundColor: def.color + '18' }]}
                        onPress={() => setEditMarkerCategory(cat)} activeOpacity={0.75}>
                        <View style={[s.chipDot, { backgroundColor: def.color }]} />
                        <Text style={[s.chipText, editMarkerCategory === cat && { color: def.color, fontWeight: '700' }]}>{def.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={s.editLabel}>Note <Text style={s.editLabelOpt}>(optional)</Text></Text>
                  <TextInput style={s.editNotesInput} value={editMarkerNote} onChangeText={setEditMarkerNote}
                    placeholder="Depths, hazards, hours…" placeholderTextColor={Colors.textMuted}
                    multiline numberOfLines={3} maxLength={280} textAlignVertical="top" />
                </>
              ) : (
                <>
                  <View style={s.markerDetailHeader}>
                    <View style={[s.markerDetailIcon, { backgroundColor: MARKER_CATEGORIES[viewingMarker.category].color + '22' }]}>
                      <Ionicons name={MARKER_CATEGORIES[viewingMarker.category].icon as any} size={22}
                        color={MARKER_CATEGORIES[viewingMarker.category].color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.markerDetailTitle}>{viewingMarker.title}</Text>
                      <View style={s.markerDetailBadgeRow}>
                        <View style={[s.markerDetailBadge, { backgroundColor: MARKER_CATEGORIES[viewingMarker.category].color + '20' }]}>
                          <View style={[s.typeDot, { backgroundColor: MARKER_CATEGORIES[viewingMarker.category].color }]} />
                          <Text style={[s.markerDetailBadgeText, { color: MARKER_CATEGORIES[viewingMarker.category].color }]}>
                            {MARKER_CATEGORIES[viewingMarker.category].label}
                          </Text>
                        </View>
                        <Text style={s.markerDetailCoords}>
                          {viewingMarker.latitude.toFixed(4)}°, {viewingMarker.longitude.toFixed(4)}°
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity style={s.markerDetailEditBtn} onPress={() => setMarkerEditMode(true)}>
                      <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  {viewingMarker.note ? (
                    <View style={s.markerDetailNote}>
                      <Text style={s.markerDetailNoteText}>{viewingMarker.note}</Text>
                    </View>
                  ) : null}
                  <View style={s.markerActions}>
                    <TouchableOpacity style={s.markerActionBtn} onPress={handleAddMarkerToRoute} activeOpacity={0.8}>
                      <Ionicons name="add-circle-outline" size={18} color={Colors.secondary} />
                      <Text style={[s.markerActionText, { color: Colors.secondary }]}>Add to Route</Text>
                    </TouchableOpacity>
                    <View style={s.markerActionDivider} />
                    <TouchableOpacity style={s.markerActionBtn} onPress={handleDeleteMarker} activeOpacity={0.8}>
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                      <Text style={[s.markerActionText, { color: Colors.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── CrosshairIndicator ────────────────────────────────────────────────────────

function CrosshairIndicator({ mode, pulse }: { mode: 'route' | 'places'; pulse: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current
  const loop      = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (pulse) {
      loop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 850, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 850, useNativeDriver: true }),
        ])
      )
      loop.current.start()
    } else {
      loop.current?.stop()
      Animated.timing(pulseAnim, { toValue: 1, duration: 160, useNativeDriver: true }).start()
    }
    return () => loop.current?.stop()
  }, [pulse])

  const dotColor = mode === 'route' ? Colors.primary : '#0891B2'

  return (
    <Animated.View style={[ch.wrap, { transform: [{ scale: pulseAnim }] }]}>
      <View style={ch.ring} />
      <View style={ch.tickN} />
      <View style={ch.tickS} />
      <View style={ch.tickW} />
      <View style={ch.tickE} />
      <View style={[ch.dot, { backgroundColor: dotColor }]} />
    </Animated.View>
  )
}

const CH = CROSSHAIR_SIZE
const TICK_LEN = 7
const TICK_GAP = CH / 2 + 4
const ch = StyleSheet.create({
  wrap: { width: CH, height: CH, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: CH, height: CH, borderRadius: CH / 2,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 3,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.45, shadowRadius: 2,
  },
  tickN: { position: 'absolute', width: 1.5, height: TICK_LEN, backgroundColor: 'rgba(255,255,255,0.9)',
    top: CH / 2 - TICK_GAP - TICK_LEN, left: CH / 2 - 0.75,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2 },
  tickS: { position: 'absolute', width: 1.5, height: TICK_LEN, backgroundColor: 'rgba(255,255,255,0.9)',
    top: CH / 2 + TICK_GAP, left: CH / 2 - 0.75,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2 },
  tickW: { position: 'absolute', height: 1.5, width: TICK_LEN, backgroundColor: 'rgba(255,255,255,0.9)',
    left: CH / 2 - TICK_GAP - TICK_LEN, top: CH / 2 - 0.75,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2 },
  tickE: { position: 'absolute', height: 1.5, width: TICK_LEN, backgroundColor: 'rgba(255,255,255,0.9)',
    left: CH / 2 + TICK_GAP, top: CH / 2 - 0.75,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 2 },
})

// ── WaypointActivation ────────────────────────────────────────────────────────

function WaypointActivation({ anim, color }: { anim: Animated.Value; color: string }) {
  // 0 → 0.78 : ring contracts inward + fill grows (charging phase)
  // 0.78 → 1  : everything snaps away (placement moment)
  const ringScale   = anim.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1.5, 0.85, 0.6], extrapolate: 'clamp' })
  const ringOpacity = anim.interpolate({ inputRange: [0, 0.04, 0.78, 1], outputRange: [0, 0.85, 0.85, 0] })
  const fillScale   = anim.interpolate({ inputRange: [0, 0.12, 0.78, 1], outputRange: [0.1, 0.35, 1.0, 1.3], extrapolate: 'clamp' })
  const fillOpacity = anim.interpolate({ inputRange: [0, 0.08, 0.78, 1], outputRange: [0, 0.95, 0.95, 0] })
  return (
    <View style={wa.wrap}>
      <Animated.View style={[wa.ring, { borderColor: color, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
      <Animated.View style={[wa.fill, { backgroundColor: color, opacity: fillOpacity, transform: [{ scale: fillScale }] }]} />
    </View>
  )
}
const wa = StyleSheet.create({
  wrap: { width: CH, height: CH, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: CH, height: CH, borderRadius: CH / 2, borderWidth: 2 },
  fill: { width: 20, height: 20, borderRadius: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3 },
})

// ── SavedMarkerPin ────────────────────────────────────────────────────────────

function SavedMarkerPin({ category }: { category: MapMarkerCategory }) {
  const def = MARKER_CATEGORIES[category]
  return (
    <View style={mp.wrap}>
      <View style={[mp.circle, { backgroundColor: def.color, shadowColor: def.color }]}>
        <Ionicons name={def.icon as any} size={15} color="#fff" />
      </View>
      <View style={[mp.pointer, { borderTopColor: def.color }]} />
    </View>
  )
}
const mp = StyleSheet.create({
  wrap: { alignItems: 'center' },
  circle: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.45, shadowRadius: 4, elevation: 6,
  },
  pointer: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1,
  },
})

// ── StopRow ───────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  DAY_START: '#22C55E', DAY_END: '#1B6CA8', ALT_END: '#F97316',
  MARINA: '#1B6CA8', ANCHORAGE: '#22C55E', BAY: '#00B4D8',
  BEACH: '#FF7043', LAGOON: '#0891B2', CAVE: '#7C3AED', FUEL: '#F59E0B',
}
interface StopRowProps {
  stop: UserRouteStop; index: number; total: number
  onEdit: () => void; onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void
  nextStop?: UserRouteStop
}
function StopRow({ stop, index: i, total, onEdit, onMoveUp, onMoveDown, onRemove, nextStop }: StopRowProps) {
  // Leg distance only meaningful between route endpoints (DAY_START → DAY_END)
  const nm = (stop.type === 'DAY_START' && nextStop?.type === 'DAY_END' &&
    stop.lat != null && stop.lng != null && nextStop?.lat != null && nextStop?.lng != null)
    ? legNm(stop.lat, stop.lng, nextStop.lat, nextStop.lng) : null
  const typeColor = stop.type === 'DAY_START' ? '#22C55E'
    : stop.type === 'DAY_END' ? '#1B6CA8'
    : stop.type === 'ALT_END' ? '#F97316'
    : (stop.type && stop.type !== 'CUSTOM' ? TYPE_COLOR[stop.type] : null)
  const typeLabel = stop.type === 'DAY_START' ? 'Departure'
    : stop.type === 'DAY_END' ? 'Destination'
    : stop.type === 'ALT_END' ? 'Alt. Destination'
    : (stop.type && stop.type !== 'CUSTOM' ? STOP_TYPE_OPTIONS.find((o) => o.type === stop.type)?.label : null)
  return (
    <View style={s.stopRow}>
      <View style={s.seqCol}>
        <View style={[s.dot, { backgroundColor: STOP_COLORS[i % STOP_COLORS.length] }]}>
          <Text style={s.dotText}>{i + 1}</Text>
        </View>
        {i < total - 1 && <View style={s.connector} />}
      </View>
      <View style={s.stopCard}>
        <View style={s.stopCardRow}>
          <TouchableOpacity style={s.stopInfo} onPress={onEdit} activeOpacity={0.7}>
            <View style={s.stopNameRow}>
              <Text style={s.stopName} numberOfLines={1}>{stop.name ?? `Stop ${i + 1}`}</Text>
              <Ionicons name="pencil-outline" size={11} color={Colors.textMuted} style={{ marginLeft: 4 }} />
            </View>
            {typeLabel && typeColor && (
              <View style={[s.typeBadge, { backgroundColor: typeColor + '20' }]}>
                <View style={[s.typeDot, { backgroundColor: typeColor }]} />
                <Text style={[s.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
              </View>
            )}
            {stop.notes
              ? <Text style={s.notePreview} numberOfLines={1}>{stop.notes}</Text>
              : <Text style={s.stopCoord}>{stop.lat?.toFixed(4)}°, {stop.lng?.toFixed(4)}°</Text>}
          </TouchableOpacity>
          <View style={s.stopActions}>
            <TouchableOpacity style={s.actionBtn} onPress={onMoveUp} disabled={i === 0}>
              <Ionicons name="chevron-up" size={16} color={i === 0 ? Colors.border : Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={onMoveDown} disabled={i === total - 1}>
              <Ionicons name="chevron-down" size={16} color={i === total - 1 ? Colors.border : Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={onRemove}>
              <Ionicons name="trash-outline" size={15} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
        {nm !== null && (
          <View style={s.legRow}>
            <Ionicons name="arrow-down" size={10} color={Colors.textMuted} />
            <Text style={s.legText}>{nm} nm to next</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ── MarkerRow ─────────────────────────────────────────────────────────────────

function MarkerRow({ marker, onPress }: { marker: MapMarker; onPress: () => void }) {
  const def = MARKER_CATEGORIES[marker.category]
  return (
    <TouchableOpacity style={s.markerRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[s.markerRowIcon, { backgroundColor: def.color + '20' }]}>
        <Ionicons name={def.icon as any} size={18} color={def.color} />
      </View>
      <View style={s.markerRowBody}>
        <Text style={s.markerRowTitle} numberOfLines={1}>{marker.title}</Text>
        <View style={s.markerRowMeta}>
          <Text style={[s.markerRowCat, { color: def.color }]}>{def.label}</Text>
          {marker.note ? <Text style={s.markerRowNote} numberOfLines={1}> · {marker.note}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
    </TouchableOpacity>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: Colors.background },
  centerText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  backBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  backBtnText: { color: '#fff', fontWeight: '700' },

  // Header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'column', gap: 8,
    paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Builder mode toggle (Map / Plan)
  builderToggle: {
    flexDirection: 'row', backgroundColor: Colors.background,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', alignSelf: 'stretch',
  },
  builderToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 7,
  },
  builderToggleBtnActive: { backgroundColor: Colors.primary },
  builderToggleBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  circleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  titleInput: {
    flex: 1, height: 38, backgroundColor: Colors.background,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, fontSize: 15, color: Colors.text,
  },
  titleInputFocused: { borderColor: Colors.secondary },
  saveBtn: { backgroundColor: Colors.secondary, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 16 },
  saveBtnOff: { backgroundColor: Colors.textMuted },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Route pins
  routePin: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  routePinText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Crosshair overlay
  crosshairWrap: { position: 'absolute', width: CROSSHAIR_SIZE, height: CROSSHAIR_SIZE },

  // First-use hint
  hintWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hintText: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.94)',
    backgroundColor: 'rgba(0,0,0,0.44)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, overflow: 'hidden',
  },

  // ── Sheet ─────────────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 12,
  },

  // Collar — always-visible, contains the CTA
  collar: {
    paddingTop: 10, paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 12,
  },

  // CTA row inside collar
  ctaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 2,
  },
  modePill: {
    flexDirection: 'row', backgroundColor: Colors.background,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 11 },
  modeBtnRoute:  { backgroundColor: Colors.primary },
  modeBtnPlaces: { backgroundColor: '#0891B2' },
  modeBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  badge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeOnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  badgeText: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary },
  fitBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, borderRadius: 12, paddingVertical: 10,
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Expanded content (below collar)
  expandedContent: { flex: 1 },
  summaryBar: {
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.secondary + '12', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
  },
  statText: { fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 16,
    paddingHorizontal: 9, paddingVertical: 4, backgroundColor: Colors.background,
  },
  filterDot: { width: 7, height: 7, borderRadius: 3.5 },
  filterChipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },

  listContent: { paddingHorizontal: 14, paddingTop: 8 },
  emptyList: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },

  // Stop row
  stopRow: { flexDirection: 'row', gap: 10 },
  seqCol: { width: 28, alignItems: 'center', paddingTop: 12 },
  dot: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2,
  },
  dotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  connector: { flex: 1, width: 2, backgroundColor: Colors.border, marginVertical: 2 },
  stopCard: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 12, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  stopCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stopInfo: { flex: 1 },
  stopNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  stopName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  stopCoord: { fontSize: 11, color: Colors.textMuted },
  notePreview: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 3 },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  typeBadgeText: { fontSize: 10, fontWeight: '600' },
  stopActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  legText: { fontSize: 11, color: Colors.textMuted },

  // Marker row
  markerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background, borderRadius: 12, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  markerRowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  markerRowBody: { flex: 1 },
  markerRowTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  markerRowMeta: { flexDirection: 'row', alignItems: 'center' },
  markerRowCat: { fontSize: 11, fontWeight: '600' },
  markerRowNote: { fontSize: 11, color: Colors.textMuted, flex: 1 },

  // Marker detail
  markerDetailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  markerDetailIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  markerDetailTitle: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  markerDetailBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markerDetailBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  markerDetailBadgeText: { fontSize: 11, fontWeight: '600' },
  markerDetailCoords: { fontSize: 11, color: Colors.textMuted },
  markerDetailEditBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  markerDetailNote: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  markerDetailNoteText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  markerActions: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  markerActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
  markerActionText: { fontSize: 14, fontWeight: '600' },
  markerActionDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.border },

  // Modals
  modalOuter: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  editSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  editHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 14 },
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  editTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  editSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  editDoneBtn: { backgroundColor: Colors.secondary, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 18 },
  editDoneText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  editLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  editLabelOpt: { fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: Colors.textMuted },
  editInput: { backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: Colors.text, marginBottom: 18 },
  editNotesInput: { backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: Colors.text, minHeight: 80, textAlignVertical: 'top', marginBottom: 4 },
  chipScroll: { marginBottom: 18 },
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.background, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 7 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  // Quick type chips (collar)
  typeChipScroll: { marginBottom: 8 },
  typeChipRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 2, paddingBottom: 2 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.background, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  typeChipDot: { width: 7, height: 7, borderRadius: 3.5 },
  typeChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

  // Plan mode
  planContainer: { flex: 1, backgroundColor: Colors.background },
  planAutoSplitRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  planAutoSplitLeft: { flex: 1 },
  planAutoSplitLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  planAutoSplitSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  planAutoSplitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.secondary + '14', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.secondary + '30',
  },
  planAutoSplitBtnText: { fontSize: 13, fontWeight: '600', color: Colors.secondary },
  planEmpty: { alignItems: 'center', paddingTop: 40, gap: 10 },
  planGoMapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4,
  },
  planGoMapBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Day cards
  dayCard: { marginBottom: 16 },
  dayCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 6,
  },
  dayCardDot: { width: 9, height: 9, borderRadius: 4.5 },
  dayCardTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  dayCardNm: { fontSize: 13, fontWeight: '600', flex: 1 },
  dayCardCount: { fontSize: 12, fontWeight: '500' },

  // Plan stop rows
  planStopRow: { flexDirection: 'row', gap: 10 },
  planSeqCol: { width: 28, alignItems: 'center', paddingTop: 10 },
  planStopCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  planStopCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  planStopAction: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Persistent Day Card (collar) ─────────────────────────────────────────

  // Collar day card: always-visible context block at top of collar
  collarDayCard: { gap: 6, marginBottom: 8 },
  collarDayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  dayCardTag: {
    backgroundColor: Colors.primary + '14', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  dayCardTagText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  dayCardNmText: { fontSize: 12, fontWeight: '600', color: Colors.secondary },
  dayDots: { flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'flex-end' },
  dayDot: { width: 6, height: 6, borderRadius: 3 },

  // Collar leg row: departure → destination boxes
  collarLegRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 9,
  },
  legBoxActive: { borderColor: '#22C55E', backgroundColor: '#22C55E' + '08' },
  legBoxActiveEnd: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  legBoxDisabled: { opacity: 0.45 },
  legBoxIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  legBoxText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.text },
  legBoxTextEmpty: { color: Colors.textMuted, fontWeight: '500' },
  legArrow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  legArrowLine: { width: 8, height: 1.5, backgroundColor: Colors.border },
  legAltPill: {
    backgroundColor: '#F97316' + '20', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  legAltPillText: { fontSize: 9, fontWeight: '800', color: '#F97316' },

  // Phase action zone
  phaseActions: { gap: 8 },
  phaseContinuingFrom: { fontSize: 12, color: Colors.textMuted, fontStyle: 'italic' },
  phaseCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 13,
  },
  phaseCTAText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  phaseRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  phaseCancelBtn: {
    paddingHorizontal: 16, paddingVertical: 13,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
  },
  phaseCancelText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  phaseDoneBtn: {
    paddingHorizontal: 18, paddingVertical: 13,
    borderRadius: 14, backgroundColor: Colors.secondary + '18',
    borderWidth: 1, borderColor: Colors.secondary + '35',
  },
  phaseDoneBtnText: { fontSize: 14, fontWeight: '700', color: Colors.secondary },

  // Day options (day_options phase)
  dayOptionsRow: { flexDirection: 'row', gap: 6 },
  dayPrimaryRow: { flexDirection: 'row', gap: 6 },
  dayOptionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  dayOptionText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  dayOptionBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderRadius: 12, backgroundColor: Colors.primary,
  },
  dayOptionBtnSave: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderRadius: 12, backgroundColor: Colors.border,
  },
  dayOptionPrimaryText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Suggestions ("Along Day N")
  suggestionsPanel: { paddingHorizontal: 14, paddingTop: 10, gap: 8 },
  suggestionsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  suggestionsSectionTag: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  suggestionsSectionTagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  suggestionsTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1 },
  suggestionsEmpty: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  suggestionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  suggestionBody: { flex: 1 },
  suggestionName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  suggestionType: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  suggestionAddBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  // Legacy — kept for Plan mode day cards (re-used in dayGroups)
  altBadge: {
    backgroundColor: '#F97316' + '20', borderRadius: 6, borderWidth: 1,
    borderColor: '#F97316' + '40', paddingHorizontal: 6, paddingVertical: 2,
  },
  altBadgeText: { fontSize: 10, fontWeight: '800', color: '#F97316' },
})
