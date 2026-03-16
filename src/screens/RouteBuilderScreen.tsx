import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Animated, PanResponder, FlatList, Dimensions,
  Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useMapMarkersStore } from '../store/mapMarkersStore'
import { MapMarker, MapMarkerCategory } from '../types/mapMarker'
import { UserRouteStop } from '../types/userRoute'
import { Colors } from '../constants/colors'

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
const COLLAR_H       = 96   // handle (22) + CTA row (52) + bottom gap (22)
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
  ANCHORAGE:  { label: 'Anchorage',  color: '#22C55E', icon: 'anchor',            stopType: 'ANCHORAGE' },
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

export default function RouteBuilderScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)

  const {
    draftRoute, addWaypoint, removeStop, moveStop,
    updateDraftTitle, updateStopName, updateStopNotes, updateStopType,
    saveDraft, discardDraft,
  } = useRouteBuilderStore()

  const { markers, addMarker, updateMarker, removeMarker, loadMarkers } = useMapMarkersStore()
  useEffect(() => { loadMarkers() }, [])

  const [titleFocused, setTitleFocused] = useState(false)
  const [mapMode, setMapMode] = useState<'route' | 'places'>('route')

  // First-use guidance (resets each session — intentional)
  const [showRouteHint,  setShowRouteHint]  = useState(true)
  const [showPlacesHint, setShowPlacesHint] = useState(true)

  // ── Map centre tracking ───────────────────────────────────────────────────
  // Ref avoids re-renders on every pan frame. Only read on button press.
  const mapCenterRef = useRef({ latitude: 38.8, longitude: 18.5 })

  // ── Crosshair geometry ────────────────────────────────────────────────────
  // True centre of the visible map area (between header and sheet collar).
  const HEADER_H     = insets.top + 58
  const mapAreaH     = SCREEN_H - HEADER_H - COLLAR_H
  const crosshairTop  = HEADER_H + mapAreaH / 2 - CROSSHAIR_SIZE / 2
  const crosshairLeft = SCREEN_W / 2 - CROSSHAIR_SIZE / 2

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

  // ── Route stop editor ─────────────────────────────────────────────────────

  const [editingStopId, setEditingStopId] = useState<string | null>(null)
  const [editName,  setEditName]  = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editType,  setEditType]  = useState('CUSTOM')

  const stops = draftRoute?.stops ?? []
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
    addWaypoint(viewingMarker.latitude, viewingMarker.longitude, viewingMarker.title, def.stopType)
    setViewingMarkerId(null)
    setMapMode('route')
    snapTo(SNAP_COLLAPSED, 'collapsed')
  }, [viewingMarker, addWaypoint, snapTo])

  // ── Primary action — place at crosshair ───────────────────────────────────

  const handleAddAtCenter = useCallback(() => {
    const { latitude, longitude } = mapCenterRef.current

    if (mapMode === 'route') {
      // The activation animation plays at the crosshair first — the pin only
      // materialises once the circle has fully charged and faded, giving the
      // press-to-activate feel of a marine chart plotter.
      setActivating(true)
      placeAnim.setValue(0)
      Animated.timing(placeAnim, { toValue: 1, duration: 500, useNativeDriver: true })
        .start(({ finished }) => {
          setActivating(false)
          if (finished) {
            addWaypoint(latitude, longitude)
            snapTo(SNAP_COLLAPSED, 'collapsed')
            setShowRouteHint(false)
          }
        })
    } else {
      // Places mode: open the quick-add modal; keep sheet where it is
      setAddingMarkerAt({ latitude, longitude })
      setNewMarkerTitle('')
      setNewMarkerNote('')
      setNewMarkerCategory('ANCHORAGE')
      setShowPlacesHint(false)
    }
  }, [mapMode, addWaypoint, snapTo, placeAnim])

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

  const polylineCoords = stops.map((s) => ({ latitude: s.lat!, longitude: s.lng! }))

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

  const canSave = !!(draftRoute?.title.trim() && stops.length >= 2)

  const handleSave = () => {
    if (!draftRoute?.title.trim()) { Alert.alert('Name required', 'Give your route a name first.'); return }
    if (stops.length < 2) { Alert.alert('Too few stops', 'Add at least 2 waypoints to save a route.'); return }
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

  const modeColor     = mapMode === 'route' ? Colors.primary : '#0891B2'
  const isFirstRoute  = showRouteHint  && mapMode === 'route'  && stops.length === 0
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

      {/* ── Map — no onPress; the action bar drives all placement ─── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 38.8, longitude: 18.5, latitudeDelta: 16, longitudeDelta: 22 }}
        onRegionChange={(r) => {
          mapCenterRef.current = { latitude: r.latitude, longitude: r.longitude }
        }}
      >
        {polylineCoords.length >= 2 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={Colors.secondary}
            strokeWidth={3}
            lineDashPattern={[8, 5]}
          />
        )}
        {stops.map((stop, i) => (
          <Marker key={stop.id}
            coordinate={{ latitude: stop.lat!, longitude: stop.lng! }}
            tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.routePin, { backgroundColor: STOP_COLORS[i % STOP_COLORS.length] }]}>
              <Text style={s.routePinText}>{i + 1}</Text>
            </View>
          </Marker>
        ))}
        {visibleMarkers.map((marker) => (
          <Marker key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            tracksViewChanges={false} anchor={{ x: 0.5, y: 1.0 }}
            onPress={() => openMarkerViewer(marker)}>
            <SavedMarkerPin category={marker.category} />
          </Marker>
        ))}
      </MapView>

      {/* ── Crosshair — locked to map centre ─────────────────────── */}
      <View style={[s.crosshairWrap, { top: crosshairTop, left: crosshairLeft }]} pointerEvents="none">
        <CrosshairIndicator mode={mapMode} pulse={isFirstRoute || isFirstPlaces} />
      </View>

      {/* ── First-use hint below the crosshair ───────────────────── */}
      {(isFirstRoute || isFirstPlaces) && (
        <View style={[s.hintWrap, { top: crosshairTop + CROSSHAIR_SIZE + 14 }]} pointerEvents="none">
          <Text style={s.hintText}>
            {isFirstRoute ? 'Pan the map to your first waypoint' : 'Pan to the spot you want to save'}
          </Text>
        </View>
      )}

      {/* ── Activation animation (screen-space, aligns with crosshair) */}
      {activating && (
        <View style={[s.crosshairWrap, { top: crosshairTop, left: crosshairLeft }]} pointerEvents="none">
          <WaypointActivation anim={placeAnim} color={modeColor} />
        </View>
      )}

      {/* ── Floating header ──────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
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

      {/* ── Bottom sheet ──────────────────────────────────────────── */}
      {/*                                                               */}
      {/* The sheet has ONE always-visible collar (COLLAR_H) that       */}
      {/* contains the CTA. Swipe up to review stops; swipe down to     */}
      {/* return to the collar and unblock the map.                     */}
      <Animated.View style={[s.sheet, { height: SHEET_MAX_H, transform: [{ translateY: sheetAnim }] }]}>

        {/* ── Collar (drag target + CTA — always visible) ── */}
        <View style={s.collar} {...panResponder.panHandlers}>
          {/* Drag handle */}
          <View style={s.handle} />

          {/* CTA row */}
          <View style={[s.ctaRow, { paddingBottom: insets.bottom > 0 ? insets.bottom + 4 : 14 }]}>

            {/* Mode toggle */}
            <View style={s.modePill}>
              <TouchableOpacity
                style={[s.modeBtn, mapMode === 'route' && s.modeBtnRoute]}
                onPress={() => handleSetMode('route')}
                activeOpacity={0.8}
              >
                <Ionicons name="navigate" size={13}
                  color={mapMode === 'route' ? '#fff' : Colors.textSecondary} />
                <Text style={[s.modeBtnText, mapMode === 'route' && { color: '#fff' }]}>Route</Text>
                {stops.length > 0 && (
                  <View style={[s.badge, mapMode === 'route' && s.badgeOnActive]}>
                    <Text style={[s.badgeText, mapMode === 'route' && { color: '#fff' }]}>{stops.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modeBtn, mapMode === 'places' && s.modeBtnPlaces]}
                onPress={() => handleSetMode('places')}
                activeOpacity={0.8}
              >
                <Ionicons name="bookmark" size={13}
                  color={mapMode === 'places' ? '#fff' : Colors.textSecondary} />
                <Text style={[s.modeBtnText, mapMode === 'places' && { color: '#fff' }]}>Places</Text>
                {markers.length > 0 && (
                  <View style={[s.badge, mapMode === 'places' && s.badgeOnActive]}>
                    <Text style={[s.badgeText, mapMode === 'places' && { color: '#fff' }]}>{markers.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Fit — secondary, only when relevant */}
            {(stops.length >= 2 || markers.length > 0) && (
              <TouchableOpacity style={s.fitBtn} onPress={handleFitMap} activeOpacity={0.8}>
                <Ionicons name="scan-outline" size={17} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Primary action — flex-1 so it dominates the row */}
            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: modeColor, opacity: activating ? 0.65 : 1 }]}
              onPress={handleAddAtCenter}
              disabled={activating}
              activeOpacity={0.82}
            >
              <Ionicons
                name={activating ? 'radio-button-on-outline' : (mapMode === 'route' ? 'add-circle-outline' : 'bookmark-outline')}
                size={17} color="#fff"
              />
              <Text style={s.addBtnText}>
                {activating ? 'Placing…' : (mapMode === 'route' ? 'Add Waypoint' : 'Add Place')}
              </Text>
            </TouchableOpacity>
          </View>
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
                  <Text style={s.emptySub}>Pan the map to your first stop, then tap Add Waypoint</Text>
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
  MARINA: '#1B6CA8', ANCHORAGE: '#22C55E', BAY: '#00B4D8',
  BEACH: '#FF7043', LAGOON: '#0891B2', CAVE: '#7C3AED', FUEL: '#F59E0B',
}
interface StopRowProps {
  stop: UserRouteStop; index: number; total: number
  onEdit: () => void; onMoveUp: () => void; onMoveDown: () => void; onRemove: () => void
  nextStop?: UserRouteStop
}
function StopRow({ stop, index: i, total, onEdit, onMoveUp, onMoveDown, onRemove, nextStop }: StopRowProps) {
  const nm = (stop.lat != null && stop.lng != null && nextStop?.lat != null && nextStop?.lng != null)
    ? legNm(stop.lat, stop.lng, nextStop.lat, nextStop.lng) : null
  const typeColor = stop.type && stop.type !== 'CUSTOM' ? TYPE_COLOR[stop.type] : null
  const typeLabel = stop.type && stop.type !== 'CUSTOM'
    ? STOP_TYPE_OPTIONS.find((o) => o.type === stop.type)?.label : null
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 6,
  },
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
})
