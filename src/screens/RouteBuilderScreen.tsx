import React, { useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Animated, PanResponder, FlatList, Dimensions,
} from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { UserRouteStop } from '../types/userRoute'
import { Colors } from '../constants/colors'

// ── Constants ──────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window')
const SHEET_MAX_H = Math.round(SCREEN_H * 0.62)
const SNAP_PEEKED = SHEET_MAX_H - 76   // only handle + stats row visible
const SNAP_HALF   = Math.round(SHEET_MAX_H * 0.42)
const SNAP_FULL   = 0

const STOP_COLORS = ['#1B6CA8', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#00B4D8', '#F97316']

// ── Haversine (screen-local, avoids cross-module import) ──────────────────────

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
    draftRoute,
    addWaypoint,
    removeStop,
    moveStop,
    updateDraftTitle,
    saveDraft,
    discardDraft,
  } = useRouteBuilderStore()

  const [titleFocused, setTitleFocused] = useState(false)
  const [snapState, setSnapState] = useState<'peeked' | 'half' | 'full'>('peeked')

  // ── Bottom sheet animation ────────────────────────────────────────────────

  const sheetAnim  = useRef(new Animated.Value(SNAP_PEEKED)).current
  const lastY      = useRef(SNAP_PEEKED)
  const snapLabel  = useRef<'peeked' | 'half' | 'full'>('peeked')

  const snapTo = useCallback((target: number, label: 'peeked' | 'half' | 'full') => {
    snapLabel.current = label
    lastY.current = target
    setSnapState(label)
    Animated.spring(sheetAnim, { toValue: target, useNativeDriver: true, bounciness: 4 }).start()
  }, [sheetAnim])

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 6,
    onPanResponderGrant: () => sheetAnim.stopAnimation(),
    onPanResponderMove: (_, g) => {
      const next = Math.max(0, Math.min(SNAP_PEEKED, lastY.current + g.dy))
      sheetAnim.setValue(next)
    },
    onPanResponderRelease: (_, g) => {
      const now = lastY.current + g.dy
      if (g.vy > 0.5) {
        if (snapLabel.current === 'full') snapTo(SNAP_HALF, 'half')
        else snapTo(SNAP_PEEKED, 'peeked')
      } else if (g.vy < -0.5) {
        if (snapLabel.current === 'peeked') snapTo(SNAP_HALF, 'half')
        else snapTo(SNAP_FULL, 'full')
      } else {
        const nearest = [
          { t: SNAP_PEEKED, l: 'peeked' as const },
          { t: SNAP_HALF,   l: 'half' as const },
          { t: SNAP_FULL,   l: 'full' as const },
        ].sort((a, b) => Math.abs(a.t - now) - Math.abs(b.t - now))[0]
        snapTo(nearest.t, nearest.l)
      }
    },
  })).current

  // ── Map interaction ───────────────────────────────────────────────────────

  const stops = draftRoute?.stops ?? []

  const handleMapPress = useCallback((e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate
    addWaypoint(latitude, longitude)
    if (stops.length === 0) snapTo(SNAP_HALF, 'half')
  }, [stops.length, addWaypoint, snapTo])

  const polylineCoords = stops.map((s) => ({
    latitude:  s.lat!,
    longitude: s.lng!,
  }))

  const handleFitMap = () => {
    if (polylineCoords.length === 0) return
    mapRef.current?.fitToCoordinates(polylineCoords, {
      edgePadding: { top: 120, right: 48, bottom: 180, left: 48 },
      animated: true,
    })
  }

  // ── Save / discard ────────────────────────────────────────────────────────

  const canSave = !!(draftRoute?.title.trim() && stops.length >= 2)

  const handleSave = () => {
    if (!draftRoute?.title.trim()) {
      Alert.alert('Name required', 'Give your route a name first.')
      return
    }
    if (stops.length < 2) {
      Alert.alert('Too few stops', 'Add at least 2 stops to save a route.')
      return
    }
    const saved = saveDraft(() => null, 'DRAFT')
    if (saved) router.replace(`/user-route/${saved.id}`)
  }

  const handleDiscard = () => {
    Alert.alert('Discard Route?', 'All unsaved changes will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { discardDraft(); router.back() } },
    ])
  }

  // ── No draft guard ────────────────────────────────────────────────────────

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

      {/* ── Full-screen map ─────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: 38.8, longitude: 18.5, latitudeDelta: 16, longitudeDelta: 22 }}
        onPress={handleMapPress}
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
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.lat!, longitude: stop.lng! }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[s.pin, { backgroundColor: STOP_COLORS[i % STOP_COLORS.length] }]}>
              <Text style={s.pinText}>{i + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* ── Floating header ─────────────────────────────────────────── */}
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

      {/* ── Empty-state hint ────────────────────────────────────────── */}
      {stops.length === 0 && (
        <View style={s.hint} pointerEvents="none">
          <Ionicons name="map-outline" size={22} color="rgba(255,255,255,0.9)" />
          <Text style={s.hintText}>Tap the map to add waypoints</Text>
        </View>
      )}

      {/* ── Fit-map FAB ─────────────────────────────────────────────── */}
      {stops.length >= 2 && (
        <TouchableOpacity style={s.fitFab} onPress={handleFitMap} activeOpacity={0.85}>
          <Ionicons name="scan-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      )}

      {/* ── Bottom Sheet ────────────────────────────────────────────── */}
      <Animated.View
        style={[s.sheet, { height: SHEET_MAX_H, transform: [{ translateY: sheetAnim }] }]}
      >
        {/* Drag handle row */}
        <View style={s.handleArea} {...panResponder.panHandlers}>
          <View style={s.handle} />
          <View style={s.statsRow}>
            <View style={s.statPill}>
              <Ionicons name="location-outline" size={13} color={Colors.secondary} />
              <Text style={s.statText}>{stops.length} stop{stops.length !== 1 ? 's' : ''}</Text>
            </View>
            {(draftRoute.totalNm ?? 0) > 0 && (
              <View style={s.statPill}>
                <Ionicons name="navigate-outline" size={13} color={Colors.secondary} />
                <Text style={s.statText}>{draftRoute.totalNm} nm</Text>
              </View>
            )}
            {(draftRoute.estimatedDays ?? 0) > 0 && (
              <View style={s.statPill}>
                <Ionicons name="calendar-outline" size={13} color={Colors.secondary} />
                <Text style={s.statText}>{draftRoute.estimatedDays}d</Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={s.expandBtn}
              onPress={() => snapState === 'peeked' ? snapTo(SNAP_HALF, 'half') : snapTo(SNAP_PEEKED, 'peeked')}
            >
              <Ionicons
                name={snapState === 'peeked' ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stop list */}
        <FlatList
          data={stops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptySheet}>
              <Ionicons name="navigate-circle-outline" size={36} color={Colors.textMuted} />
              <Text style={s.emptyTitle}>No waypoints yet</Text>
              <Text style={s.emptySub}>Tap anywhere on the map to start building your route</Text>
            </View>
          }
          renderItem={({ item: stop, index: i }) => (
            <StopRow
              stop={stop}
              index={i}
              total={stops.length}
              onMoveUp={() => moveStop(i, i - 1, () => null)}
              onMoveDown={() => moveStop(i, i + 1, () => null)}
              onRemove={() => removeStop(stop.id, () => null)}
              nextStop={stops[i + 1]}
            />
          )}
        />
      </Animated.View>
    </View>
  )
}

// ── Stop row component ────────────────────────────────────────────────────────

interface StopRowProps {
  stop: UserRouteStop
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  nextStop?: UserRouteStop
}

function StopRow({ stop, index: i, total, onMoveUp, onMoveDown, onRemove, nextStop }: StopRowProps) {
  const nm = (stop.lat != null && stop.lng != null && nextStop?.lat != null && nextStop?.lng != null)
    ? legNm(stop.lat, stop.lng, nextStop.lat, nextStop.lng)
    : null

  return (
    <View style={s.stopRow}>
      {/* Sequence indicator */}
      <View style={s.seqCol}>
        <View style={[s.dot, { backgroundColor: STOP_COLORS[i % STOP_COLORS.length] }]}>
          <Text style={s.dotText}>{i + 1}</Text>
        </View>
        {i < total - 1 && <View style={s.connector} />}
      </View>

      {/* Card */}
      <View style={s.stopCard}>
        <View style={s.stopCardRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.stopName}>{stop.name ?? `Stop ${i + 1}`}</Text>
            {stop.lat != null && stop.lng != null && (
              <Text style={s.stopCoord}>
                {stop.lat.toFixed(4)}°, {stop.lng.toFixed(4)}°
              </Text>
            )}
          </View>
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

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },

  // No-draft fallback
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: Colors.background },
  centerText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  backBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  backBtnText: { color: '#fff', fontWeight: '700' },

  // Floating header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
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
  saveBtn: {
    backgroundColor: Colors.secondary, borderRadius: 18,
    paddingVertical: 8, paddingHorizontal: 16,
  },
  saveBtnOff: { backgroundColor: Colors.textMuted },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Map markers
  pin: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  pinText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Empty hint (center of map)
  hint: {
    position: 'absolute', bottom: SHEET_MAX_H - SNAP_PEEKED + 24,
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.52)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  hintText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Fit FAB
  fitFab: {
    position: 'absolute', right: 14, bottom: SHEET_MAX_H - SNAP_PEEKED + 14,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 6, elevation: 5,
  },

  // Bottom sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 12,
  },
  handleArea: {
    paddingTop: 10, paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 10,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.secondary + '12', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  statText: { fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  expandBtn: { padding: 4 },

  // List
  listContent: { paddingHorizontal: 14, paddingTop: 8 },

  emptySheet: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },

  // Stop row
  stopRow: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  seqCol: { width: 28, alignItems: 'center', paddingTop: 12 },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2,
  },
  dotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  connector: { flex: 1, width: 2, backgroundColor: Colors.border, marginVertical: 2 },

  stopCard: {
    flex: 1, backgroundColor: Colors.background,
    borderRadius: 12, padding: 10, marginBottom: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  stopCardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stopName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  stopCoord: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  actionBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },

  legRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 6, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  legText: { fontSize: 11, color: Colors.textMuted },
})
