/**
 * UserRouteDetailScreen — full-screen map route view + editor.
 *
 * Owned routes: loaded into draftRoute, fully editable.
 * Community routes: read-only beautiful experience with social interactions.
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Animated, PanResponder, ScrollView, Dimensions,
  Platform, Modal, KeyboardAvoidingView, Share, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useAuthStore } from '../store/authStore'
import { usePlacesStore } from '../store/placesStore'
import { useCaptainStore } from '../store/captainStore'
import { seedPlaces } from '../data/seedPlaces'
import { Colors } from '../constants/colors'
import { PurchaseModal } from '../components/PurchaseModal'
import { UserRoute, UserRouteDayDetail, UserRouteStop, StayType } from '../types/userRoute'

// ── Layout ────────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window')

const SNAP_FULL = Math.round(SCREEN_H * 0.16)
const SNAP_HALF = Math.round(SCREEN_H * 0.52)
const SNAP_MINI = Math.round(SCREEN_H * 0.78)

// ── Color maps ────────────────────────────────────────────────────────────────

const DAY_PALETTE = ['#1B6CA8', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#00B4D8', '#F97316']

const STOP_TYPE_COLORS: Record<string, string> = {
  MARINA: '#1B6CA8', ANCHORAGE: '#22C55E', BAY: '#00B4D8',
  BEACH: '#FF7043', LAGOON: '#0891B2', CAVE: '#7C3AED', FUEL: '#F59E0B', CUSTOM: '#64748B',
  DAY_START: '#22C55E', DAY_END: '#1B6CA8', ALT_END: '#F97316',
}

const STOP_TYPE_OPTIONS = [
  { type: 'MARINA',    label: 'Marina',    color: '#1B6CA8' },
  { type: 'ANCHORAGE', label: 'Anchorage', color: '#22C55E' },
  { type: 'BAY',       label: 'Bay',       color: '#00B4D8' },
  { type: 'BEACH',     label: 'Beach',     color: '#FF7043' },
  { type: 'CAVE',      label: 'Cave',      color: '#7C3AED' },
  { type: 'FUEL',      label: 'Fuel',      color: '#F59E0B' },
  { type: 'CUSTOM',    label: 'Custom',    color: '#64748B' },
]

const STAY_TYPE_OPTIONS: { type: StayType; label: string; icon: string }[] = [
  { type: 'marina',    label: 'Marina',    icon: 'boat-outline'     },
  { type: 'anchorage', label: 'Anchorage', icon: 'anchor'           },
  { type: 'custom',    label: 'Custom',    icon: 'location-outline' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function nmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

// ── Day group type ─────────────────────────────────────────────────────────────

interface DayGroup {
  day: number
  departure:    UserRouteStop | undefined
  destination:  UserRouteStop | undefined
  intermediate: UserRouteStop[]
  alt:          UserRouteStop | undefined
  nm:           number
  isInherited:  boolean
}

function buildDayGroups(stops: UserRouteStop[]): DayGroup[] {
  if (stops.length === 0) return []
  const hasDayTypes = stops.some((s) => s.type === 'DAY_START' || s.type === 'DAY_END')

  // Flat routes: synthesise a single group so the new UI always renders
  if (!hasDayTypes) {
    const sorted = [...stops].sort((a, b) => a.sequence - b.sequence)
    const departure    = sorted[0]
    const destination  = sorted.length > 1 ? sorted[sorted.length - 1] : undefined
    const intermediate = sorted.slice(1, sorted.length > 1 ? sorted.length - 1 : 1)
    const nm = (departure?.lat && departure?.lng && destination?.lat && destination?.lng)
      ? nmBetween(departure.lat, departure.lng, destination.lat, destination.lng)
      : 0
    return [{ day: 0, departure, destination, intermediate, alt: undefined, nm, isInherited: false }]
  }

  const maxDay = Math.max(...stops.map((s) => s.dayIndex ?? 0))
  const groups: DayGroup[] = []

  for (let d = 0; d <= maxDay; d++) {
    const dayStops = stops
      .filter((s) => (s.dayIndex ?? 0) === d)
      .sort((a, b) => a.sequence - b.sequence)
    if (dayStops.length === 0) continue

    const departure    = dayStops.find((s) => s.type === 'DAY_START')
    const destination  = dayStops.find((s) => s.type === 'DAY_END')
    const intermediate = dayStops.filter((s) =>
      s.type !== 'DAY_START' && s.type !== 'DAY_END' && s.type !== 'ALT_END')
    const alt          = dayStops.find((s) => s.type === 'ALT_END')

    const inherited = !departure && d > 0
      ? stops.find((s) => (s.dayIndex ?? 0) === d - 1 && s.type === 'DAY_END')
      : undefined
    const effective = departure ?? inherited

    const nm = (effective?.lat && effective?.lng && destination?.lat && destination?.lng)
      ? nmBetween(effective.lat, effective.lng, destination.lat, destination.lng)
      : 0

    groups.push({ day: d, departure: effective, destination, intermediate, alt, nm, isInherited: !!inherited })
  }

  return groups
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function UserRouteDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>()
  const insets    = useSafeAreaInsets()
  const mapRef    = useRef<MapView>(null)

  // ── Store ──
  const {
    getRoute, savedRoutes, draftRoute,
    loadRouteAsDraft, deleteRoute, publishRoute, unpublishRoute,
    addWaypointToDay, removeStop, updateStopName, updateStopType,
    updateStopNotes, updateStopDescription, updateStopCoords, saveDraft,
    updateDayDetail, updateDraftDescription, updateRouteImages,
  } = useRouteBuilderStore()
  const { user }  = useAuthStore()
  const { userPlaces } = usePlacesStore()
  const { hasAccessToRoute, purchaseItem } = useCaptainStore()

  // ── Derived ──
  const allPlaces    = useMemo(() => [...seedPlaces, ...userPlaces], [userPlaces])
  const sourceRoute  = getRoute(id)
  const isOwned      = savedRoutes.some((r) => r.id === id)
  const route        = (isOwned && draftRoute?.id === id) ? draftRoute : sourceRoute

  // ── UI state ──
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [activeDay,         setActiveDay]         = useState<number | null>(null)
  const [addStopMode,       setAddStopMode]       = useState(false)

  // Stop edit modal
  const [editingStop,   setEditingStop]   = useState<UserRouteStop | null>(null)
  const [editStopName,  setEditStopName]  = useState('')
  const [editStopType,  setEditStopType]  = useState('CUSTOM')
  const [editStopDesc,  setEditStopDesc]  = useState('')
  const [editStopNotes, setEditStopNotes] = useState('')

  // Route description inline edit
  const [editingRouteDesc, setEditingRouteDesc] = useState(false)
  const [localRouteDesc,   setLocalRouteDesc]   = useState('')

  // Day detail editor open/closed per day
  const [openDayDetails, setOpenDayDetails] = useState<Record<number, boolean>>({})

  // Social state (local-only for now)
  const [liked,     setLiked]     = useState(false)
  const [likeCount, setLikeCount] = useState(0)

  // Publish flow
  const [showPublishModal,   setShowPublishModal]   = useState(false)
  const [showPublishSuccess, setShowPublishSuccess] = useState(false)

  // ── Load into draft when owner opens ──
  useEffect(() => {
    if (isOwned && id) loadRouteAsDraft(id)
  }, [id, isOwned])

  useEffect(() => {
    setLocalRouteDesc(route?.description ?? '')
  }, [route?.description])

  // ── Coords resolver ──
  const getCoords = useCallback((placeId: string) => {
    const p = allPlaces.find((pl) => pl.id === placeId)
    return p ? { lat: p.lat, lng: p.lng, region: p.region, country: p.country } : null
  }, [allPlaces])

  // ── Resolved stop items (coords from place or inline) ──
  const stopItems = useMemo(() => {
    if (!route) return []
    return route.stops
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((stop, i) => {
        const place = allPlaces.find((p) => p.id === stop.placeId)
        const lat   = place?.lat ?? stop.lat
        const lng   = place?.lng ?? stop.lng
        if (lat == null || lng == null) return null
        return { stop, place, lat, lng, name: place?.name ?? stop.name ?? `Stop ${i + 1}` }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [route, allPlaces])

  // ── Day groups ──
  const dayGroups = useMemo(() => buildDayGroups(route?.stops ?? []), [route?.stops])
  const dayCount  = dayGroups.length

  // ── Visible map items (filtered by selected day tab) ──
  const visibleItems = useMemo(() => {
    if (activeDay === null) return stopItems
    return stopItems.filter((item) => (item.stop.dayIndex ?? 0) === activeDay)
  }, [stopItems, activeDay])

  const polylineCoords = useMemo(
    () => visibleItems.map((item) => ({ latitude: item.lat, longitude: item.lng })),
    [visibleItems],
  )

  // ── Premium gate ──
  const captainId = sourceRoute?.captainId ?? sourceRoute?.createdBy ?? ''
  const isLocked  = !!(
    sourceRoute?.isPremium &&
    !isOwned &&
    !hasAccessToRoute(sourceRoute.id, captainId, user?.id)
  )

  // ── Sheet animation ──
  const sheetAnim = useRef(new Animated.Value(SNAP_HALF)).current
  const sheetVal  = useRef(SNAP_HALF)
  useEffect(() => {
    const sub = sheetAnim.addListener(({ value }) => { sheetVal.current = value })
    return () => sheetAnim.removeListener(sub)
  }, [sheetAnim])

  const snapSheet = useCallback((target: number) => {
    Animated.spring(sheetAnim, {
      toValue: target, useNativeDriver: false, tension: 68, friction: 12,
    }).start()
  }, [sheetAnim])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder:  (_, gs) =>
        Math.abs(gs.dy) > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderGrant: () => { sheetAnim.extractOffset() },
      onPanResponderMove:  Animated.event([null, { dy: sheetAnim }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gs) => {
        sheetAnim.flattenOffset()
        sheetAnim.stopAnimation((val) => {
          const vy = gs.vy
          let target = SNAP_HALF
          if (vy > 0.4 || val > (SNAP_HALF + SNAP_MINI) / 2) target = SNAP_MINI
          else if (vy < -0.4 || val < (SNAP_FULL + SNAP_HALF) / 2) target = SNAP_FULL
          Animated.spring(sheetAnim, {
            toValue: target, useNativeDriver: false, tension: 68, friction: 12,
          }).start()
        })
      },
    }),
  ).current

  // ── Map fit ──
  const hasFitted = useRef(false)
  const fitMap = useCallback((coords = polylineCoords) => {
    if (coords.length === 0) return
    const safe = coords.length === 1
      ? [{ latitude: coords[0].latitude - 0.03, longitude: coords[0].longitude - 0.03 }, coords[0]]
      : coords
    mapRef.current?.fitToCoordinates(safe, {
      edgePadding: { top: 80, right: 40, bottom: SCREEN_H * 0.5, left: 40 },
      animated: true,
    })
  }, [polylineCoords])

  const handleMapLayout = useCallback(() => {
    if (!hasFitted.current && polylineCoords.length > 0) {
      hasFitted.current = true
      setTimeout(() => fitMap(), 200)
    }
  }, [fitMap, polylineCoords.length])

  useEffect(() => {
    if (hasFitted.current) {
      const t = setTimeout(() => fitMap(), 250)
      return () => clearTimeout(t)
    }
  }, [activeDay, fitMap])

  const centerOnStop = useCallback((lat: number, lng: number) => {
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: 0.18, longitudeDelta: 0.18 },
      400,
    )
    snapSheet(SNAP_HALF)
  }, [snapSheet])

  // ── Map tap → add stop ──
  const handleMapPress = useCallback((e: any) => {
    if (!isOwned || !addStopMode) return
    const { latitude, longitude } = e.nativeEvent.coordinate
    const day = activeDay ?? 0
    addWaypointToDay(latitude, longitude, day, undefined, 'CUSTOM')
    setAddStopMode(false)
    snapSheet(SNAP_HALF)
  }, [isOwned, addStopMode, activeDay, addWaypointToDay, snapSheet])

  // ── Stop editing ──
  const openStopEdit = useCallback((stop: UserRouteStop) => {
    if (!isOwned) return
    setEditingStop(stop)
    setEditStopName(stop.name ?? '')
    setEditStopType(stop.type ?? 'CUSTOM')
    setEditStopDesc(stop.description ?? '')
    setEditStopNotes(stop.notes ?? '')
    snapSheet(SNAP_FULL)
  }, [isOwned, snapSheet])

  const commitStopEdit = useCallback(() => {
    if (!editingStop) return
    if (editStopName.trim()) updateStopName(editingStop.id, editStopName.trim())
    updateStopType(editingStop.id, editStopType)
    updateStopDescription(editingStop.id, editStopDesc.trim())
    updateStopNotes(editingStop.id, editStopNotes.trim())
    setEditingStop(null)
  }, [editingStop, editStopName, editStopType, editStopDesc, editStopNotes,
      updateStopName, updateStopType, updateStopDescription, updateStopNotes])

  // ── Save ──
  const handleSave = () => {
    if (!draftRoute?.title?.trim()) {
      Alert.alert('Name required', 'Give your route a name before saving.')
      return
    }
    saveDraft(getCoords)
    router.back()
  }

  // ── Delete ──
  const handleDelete = () => {
    Alert.alert('Delete Route', `Delete "${route?.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { deleteRoute(id); router.replace('/my-routes') },
      },
    ])
  }

  // ── Publish ──
  const handlePublish = () => setShowPublishModal(true)

  const confirmPublish = useCallback(() => {
    const name = user?.name ?? user?.email?.split('@')[0] ?? 'Sailor'
    publishRoute(id, name)
    setShowPublishModal(false)
    setTimeout(() => setShowPublishSuccess(true), 300)
  }, [user, id, publishRoute])

  // ── Route images ──
  const pickRouteImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to add route images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.75,
    })
    if (!result.canceled && result.assets[0]) {
      const current = draftRoute?.images ?? []
      updateRouteImages([...current, result.assets[0].uri])
    }
  }, [draftRoute?.images, updateRouteImages])

  const removeRouteImage = useCallback((index: number) => {
    const current = draftRoute?.images ?? []
    updateRouteImages(current.filter((_, i) => i !== index))
  }, [draftRoute?.images, updateRouteImages])

  // ── Share ──
  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: `Check out this sailing route: ${route?.title ?? 'Skipperway Route'}` })
    } catch {}
  }, [route?.title])

  // ── Not found ──
  if (!sourceRoute) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={s.centerTitle}>Route not found</Text>
        <TouchableOpacity style={s.goBackBtn} onPress={() => router.back()}>
          <Text style={s.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Premium locked gate ──
  if (isLocked) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={[s.floatingHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={s.headerBackBtn} onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{sourceRoute.title}</Text>
        </View>
        <View style={s.lockedGate}>
          <View style={s.lockedIconWrap}>
            <Ionicons name="lock-closed" size={32} color={Colors.warning} />
          </View>
          <Text style={s.lockedTitle}>Premium Route</Text>
          <Text style={s.lockedSub}>
            {sourceRoute.description || `A premium route by ${sourceRoute.createdByName ?? 'a captain'}.`}
          </Text>
          {sourceRoute.region && (
            <View style={s.lockedMeta}>
              <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
              <Text style={s.lockedMetaText}>{sourceRoute.region} · {sourceRoute.totalNm} nm</Text>
            </View>
          )}
          <TouchableOpacity style={s.lockedBtn} onPress={() => setShowPurchaseModal(true)} activeOpacity={0.85}>
            <Ionicons name="lock-open-outline" size={18} color="#fff" />
            <Text style={s.lockedBtnText}>
              {sourceRoute.priceUsd ? `Unlock for $${sourceRoute.priceUsd.toFixed(2)}` : 'Get Access'}
            </Text>
          </TouchableOpacity>
        </View>
        <PurchaseModal
          visible={showPurchaseModal} onClose={() => setShowPurchaseModal(false)}
          title={`Unlock "${sourceRoute.title}"`}
          subtitle={sourceRoute.description ?? `Premium route · ${sourceRoute.totalNm} nm`}
          priceUsd={sourceRoute.priceUsd ?? 0}
          confirmLabel={sourceRoute.priceUsd ? `Buy for $${sourceRoute.priceUsd.toFixed(2)}` : 'Get Free Access'}
          onConfirm={() => purchaseItem({ type: 'ROUTE', itemId: sourceRoute.id, captainId, priceUsd: sourceRoute.priceUsd ?? 0 })}
        />
      </View>
    )
  }

  const displayRoute = route ?? sourceRoute
  const publishedDate = displayRoute.publishedAt
    ? new Date(displayRoute.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const createdDate = new Date(displayRoute.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <View style={s.container}>

      {/* ── Full-screen map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        onLayout={handleMapLayout}
        onPress={handleMapPress}
        mapPadding={{ top: 0, right: 0, bottom: SCREEN_H * 0.5, left: 0 }}
      >
        {polylineCoords.length >= 2 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={Colors.primary}
            strokeWidth={2.5}
            lineDashPattern={[6, 4]}
          />
        )}
        {visibleItems.map((item) => {
          const gi = stopItems.indexOf(item)
          return (
            <Marker
              key={item.stop.id}
              coordinate={{ latitude: item.lat, longitude: item.lng }}
              draggable={isOwned}
              onDragEnd={isOwned
                ? (e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate
                    updateStopCoords(item.stop.id, latitude, longitude)
                  }
                : undefined}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[s.mapPin, { backgroundColor: DAY_PALETTE[gi % DAY_PALETTE.length] }]}>
                <Text style={s.mapPinText}>{gi + 1}</Text>
              </View>
            </Marker>
          )
        })}
      </MapView>

      {/* ── Floating header ── */}
      <View style={[s.floatingHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={s.headerBackBtn} onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>
          {displayRoute.title || 'Untitled Route'}
        </Text>
        {isOwned && (
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={s.saveBtnText}>Save</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Add-stop mode banner ── */}
      {addStopMode && (
        <View style={[s.addStopOverlay, { top: insets.top + 62 }]}>
          <Ionicons name="add-circle-outline" size={15} color="#fff" />
          <Text style={s.addStopOverlayText}>Tap the map to place a stop</Text>
          <TouchableOpacity onPress={() => setAddStopMode(false)}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom sheet ── */}
      <Animated.View style={[s.sheet, { top: sheetAnim }]}>

        {/* Handle + stats + day tabs — drag zone */}
        <View style={s.handleArea} {...panResponder.panHandlers}>
          <View style={s.handle} />

          {/* Stats pills */}
          <View style={s.statsRow}>
            {stopItems.length > 0 && (
              <View style={s.statPill}>
                <Ionicons name="location-outline" size={12} color={Colors.primary} />
                <Text style={s.statPillText}>{stopItems.length} stops</Text>
              </View>
            )}
            {displayRoute.totalNm > 0 && (
              <View style={s.statPill}>
                <Ionicons name="navigate-outline" size={12} color={Colors.primary} />
                <Text style={s.statPillText}>{displayRoute.totalNm} nm</Text>
              </View>
            )}
            {(displayRoute.estimatedDays ?? 0) > 0 && (
              <View style={s.statPill}>
                <Ionicons name="calendar-outline" size={12} color={Colors.primary} />
                <Text style={s.statPillText}>{displayRoute.estimatedDays} days</Text>
              </View>
            )}
            <View style={[s.statusPill, {
              backgroundColor: displayRoute.status === 'PUBLISHED'
                ? Colors.success + '18' : Colors.secondary + '18',
            }]}>
              {displayRoute.status === 'PUBLISHED' && (
                <Ionicons name="earth-outline" size={11} color={Colors.success} />
              )}
              <Text style={[s.statusPillText, {
                color: displayRoute.status === 'PUBLISHED' ? Colors.success : Colors.secondary,
              }]}>
                {displayRoute.status === 'PUBLISHED' ? 'Published' : 'Draft'}
              </Text>
            </View>
          </View>

          {/* Day tabs */}
          {dayCount > 1 && (
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={s.dayTabsScroll} contentContainerStyle={s.dayTabsContent}
            >
              <TouchableOpacity
                style={[s.dayTab, activeDay === null && s.dayTabActiveAll]}
                onPress={() => setActiveDay(null)}
              >
                <Text style={[s.dayTabText, activeDay === null && s.dayTabTextActive]}>All days</Text>
              </TouchableOpacity>
              {dayGroups.map((g) => {
                const c = DAY_PALETTE[g.day % DAY_PALETTE.length]
                const active = activeDay === g.day
                return (
                  <TouchableOpacity
                    key={g.day}
                    style={[s.dayTab, active && s.dayTabActive,
                      active && { backgroundColor: c + '20', borderColor: c }]}
                    onPress={() => setActiveDay(g.day)}
                  >
                    <View style={[s.dayTabDot, { backgroundColor: c }, !active && { opacity: 0.35 }]} />
                    <Text style={[s.dayTabText, active && s.dayTabTextActive, active && { color: c }]}>
                      Day {g.day + 1}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </View>

        {/* ── Sheet scrollable content ── */}
        <ScrollView
          style={s.sheetScroll}
          contentContainerStyle={[s.sheetContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Community route creator banner */}
          {!isOwned && displayRoute.createdByName && (
            <TouchableOpacity
              style={s.creatorBanner}
              onPress={() => displayRoute.createdBy && router.push(`/user/${displayRoute.createdBy}` as any)}
              activeOpacity={0.75}
            >
              <View style={s.creatorAvatarPlaceholder}>
                <Ionicons name="person-outline" size={16} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.creatorName}>by {displayRoute.createdByName}</Text>
                {publishedDate && (
                  <Text style={s.creatorDate}>Published {publishedDate}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Route description + images */}
          {(isOwned || displayRoute.description || (displayRoute.images?.length ?? 0) > 0) && (
            <View style={s.descCard}>

              {/* Cover image gallery */}
              {((displayRoute.images?.length ?? 0) > 0 || isOwned) && (
                <View style={s.imageGalleryRow}>
                  {(displayRoute.images ?? []).map((uri, idx) => (
                    <View key={idx} style={s.imageThumbnailWrap}>
                      <Image source={{ uri }} style={s.imageThumbnail} />
                      {isOwned && (
                        <TouchableOpacity
                          style={s.imageRemoveBtn}
                          onPress={() => removeRouteImage(idx)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="close-circle" size={18} color="#fff" />
                        </TouchableOpacity>
                      )}
                      {idx === 0 && (
                        <View style={s.coverBadge}>
                          <Text style={s.coverBadgeText}>Cover</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  {isOwned && (
                    <TouchableOpacity style={s.imageAddBtn} onPress={pickRouteImage} activeOpacity={0.75}>
                      <Ionicons name="camera-outline" size={20} color={Colors.secondary} />
                      <Text style={s.imageAddBtnText}>
                        {(displayRoute.images?.length ?? 0) === 0 ? 'Add Cover' : 'Add Photo'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Description text */}
              {isOwned && editingRouteDesc ? (
                <TextInput
                  style={s.descInput}
                  value={localRouteDesc}
                  onChangeText={(t) => { setLocalRouteDesc(t); updateDraftDescription(t) }}
                  onBlur={() => setEditingRouteDesc(false)}
                  multiline
                  scrollEnabled={false}
                  placeholder="Describe this route — sailing conditions, best season, must-see spots…"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                  textAlignVertical="top"
                />
              ) : (
                <TouchableOpacity
                  onPress={() => isOwned && setEditingRouteDesc(true)}
                  activeOpacity={isOwned ? 0.7 : 1}
                >
                  {displayRoute.description ? (
                    <Text style={s.descText}>{displayRoute.description}</Text>
                  ) : isOwned ? (
                    <Text style={s.descPlaceholder}>
                      Add a route description — best season, difficulty, what to expect…
                    </Text>
                  ) : null}
                  {isOwned && (
                    <View style={s.descEditHint}>
                      <Ionicons name="pencil-outline" size={11} color={Colors.textMuted} />
                      <Text style={s.descEditHintText}>Tap to edit description</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Day content cards */}
          {(activeDay === null ? dayGroups : dayGroups.filter((g) => g.day === activeDay)).map((group) => (
            <DayContentCard
              key={group.day}
              group={group}
              dayDetail={displayRoute.dayDetails?.[group.day]}
              isOwned={isOwned}
              detailsOpen={openDayDetails[group.day] ?? false}
              onToggleDetails={() =>
                setOpenDayDetails((prev) => ({ ...prev, [group.day]: !prev[group.day] }))
              }
              onEditStop={openStopEdit}
              onCenterMap={centerOnStop}
              onDeleteStop={(stopId) => removeStop(stopId, getCoords)}
              onUpdateDayDetail={(detail) => updateDayDetail(group.day, detail)}
            />
          ))}

          {/* Empty state when no stops at all */}
          {stopItems.length === 0 && (
            <View style={s.emptyState}>
              <Ionicons name="map-outline" size={36} color={Colors.textMuted} />
              <Text style={s.emptyStateTitle}>
                {isOwned ? 'Tap the map to add your first stop' : 'No stops for this route'}
              </Text>
            </View>
          )}

          {/* Add stop (owned) */}
          {isOwned && (
            <TouchableOpacity
              style={s.addStopBtn}
              onPress={() => { setAddStopMode(true); snapSheet(SNAP_MINI) }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={s.addStopBtnText}>Add Stop on Map</Text>
            </TouchableOpacity>
          )}

          {/* Social row (community routes) */}
          {!isOwned && displayRoute.status === 'PUBLISHED' && (
            <View style={s.socialRow}>
              <TouchableOpacity
                style={[s.socialBtn, liked && s.socialBtnLiked]}
                onPress={() => { setLiked((v) => !v); setLikeCount((v) => liked ? v - 1 : v + 1) }}
                activeOpacity={0.75}
              >
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18}
                  color={liked ? '#EF4444' : Colors.textSecondary} />
                <Text style={[s.socialBtnText, liked && { color: '#EF4444' }]}>
                  {likeCount > 0 ? String(likeCount) : 'Like'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.socialBtn}
                onPress={() => Alert.alert('Comments', 'Comments coming soon!')}
                activeOpacity={0.75}
              >
                <Ionicons name="chatbubble-outline" size={18} color={Colors.textSecondary} />
                <Text style={s.socialBtnText}>Comment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.socialBtn} onPress={handleShare} activeOpacity={0.75}>
                <Ionicons name="share-outline" size={18} color={Colors.textSecondary} />
                <Text style={s.socialBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Owned route actions */}
          {isOwned && (
            <View style={s.actionBlock}>
              {displayRoute.status === 'DRAFT' ? (
                <TouchableOpacity style={s.publishBtn} onPress={handlePublish} activeOpacity={0.85}>
                  <Ionicons name="earth-outline" size={16} color="#fff" />
                  <Text style={s.publishBtnText}>Publish to Community</Text>
                </TouchableOpacity>
              ) : (
                <View style={s.publishedRow}>
                  <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                  <Text style={s.publishedText}>Live · {publishedDate}</Text>
                  <TouchableOpacity onPress={() => unpublishRoute(id)} style={s.unpublishBtn}>
                    <Text style={s.unpublishBtnText}>Unpublish</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
                <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                <Text style={s.deleteBtnText}>Delete Route</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={s.metaDate}>Created {createdDate}</Text>
        </ScrollView>
      </Animated.View>

      {/* ── Publish confirmation modal ── */}
      <Modal
        visible={showPublishModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPublishModal(false)}
      >
        <View style={s.publishOverlay}>
          <View style={[s.publishSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={s.publishIconRow}>
              <View style={s.publishIconCircle}>
                <Ionicons name="earth" size={32} color={Colors.secondary} />
              </View>
            </View>
            <Text style={s.publishModalTitle}>Ready to set sail?</Text>
            <Text style={s.publishModalBody}>
              Your route will be visible to sailors worldwide and may be featured in Routes.
              Every like, save, and comment earns you points towards your captain ranking.
            </Text>
            <View style={s.publishFeatureRow}>
              <View style={s.publishFeatureItem}>
                <Ionicons name="compass-outline" size={18} color={Colors.secondary} />
                <Text style={s.publishFeatureText}>Discoverable by all sailors</Text>
              </View>
              <View style={s.publishFeatureItem}>
                <Ionicons name="trophy-outline" size={18} color='#F59E0B' />
                <Text style={s.publishFeatureText}>Earn points from engagement</Text>
              </View>
              <View style={s.publishFeatureItem}>
                <Ionicons name="arrow-undo-outline" size={18} color={Colors.textMuted} />
                <Text style={s.publishFeatureText}>Unpublish at any time</Text>
              </View>
            </View>
            <TouchableOpacity style={s.publishConfirmBtn} onPress={confirmPublish} activeOpacity={0.85}>
              <Ionicons name="earth-outline" size={17} color="#fff" />
              <Text style={s.publishConfirmBtnText}>Publish Route</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.publishCancelBtn} onPress={() => setShowPublishModal(false)}>
              <Text style={s.publishCancelBtnText}>Not yet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Publish success modal ── */}
      <Modal
        visible={showPublishSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPublishSuccess(false)}
      >
        <TouchableOpacity
          style={s.successOverlay}
          activeOpacity={1}
          onPress={() => setShowPublishSuccess(false)}
        >
          <View style={s.successSheet}>
            <View style={s.successIconCircle}>
              <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
            </View>
            <Text style={s.successTitle}>Your route is live ⚓</Text>
            <Text style={s.successBody}>
              Other captains can now discover it. The more sailors engage with your route, the more points you earn — and the higher you climb in the captain rankings.
            </Text>
            <TouchableOpacity style={s.successDismissBtn} onPress={() => setShowPublishSuccess(false)}>
              <Text style={s.successDismissBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Stop edit modal ── */}
      <Modal
        visible={editingStop !== null}
        transparent
        animationType="slide"
        onRequestClose={commitStopEdit}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={commitStopEdit} />
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.editHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Stop</Text>
              <TouchableOpacity style={s.modalDoneBtn} onPress={commitStopEdit} activeOpacity={0.8}>
                <Text style={s.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.fieldLabel}>Name</Text>
              <TextInput
                style={s.fieldInput}
                value={editStopName}
                onChangeText={setEditStopName}
                placeholder="Stop name…"
                placeholderTextColor={Colors.textMuted}
                returnKeyType="next"
                maxLength={60}
              />

              <Text style={s.fieldLabel}>Type</Text>
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 18 }}
                contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingBottom: 2 }}
              >
                {STOP_TYPE_OPTIONS.map((opt) => {
                  const active = editStopType === opt.type
                  return (
                    <TouchableOpacity
                      key={opt.type}
                      style={[s.typeChip, active && { backgroundColor: opt.color, borderColor: opt.color }]}
                      onPress={() => setEditStopType(opt.type)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.typeChipText, active && { color: '#fff' }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              <Text style={s.fieldLabel}>
                Description{' '}
                <Text style={s.fieldLabelOpt}>(shown to others)</Text>
              </Text>
              <TextInput
                style={s.fieldTextarea}
                value={editStopDesc}
                onChangeText={setEditStopDesc}
                placeholder="What makes this spot special?"
                placeholderTextColor={Colors.textMuted}
                multiline
                scrollEnabled={false}
                numberOfLines={3}
                maxLength={200}
                textAlignVertical="top"
              />

              <Text style={s.fieldLabel}>
                Skipper notes{' '}
                <Text style={s.fieldLabelOpt}>(private)</Text>
              </Text>
              <TextInput
                style={s.fieldTextarea}
                value={editStopNotes}
                onChangeText={setEditStopNotes}
                placeholder="Depths, hazards, good lunch spot…"
                placeholderTextColor={Colors.textMuted}
                multiline
                scrollEnabled={false}
                numberOfLines={3}
                maxLength={280}
                textAlignVertical="top"
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  )
}

// ── DayContentCard ────────────────────────────────────────────────────────────

interface DayContentCardProps {
  group:           DayGroup
  dayDetail?:      UserRouteDayDetail
  isOwned:         boolean
  detailsOpen:     boolean
  onToggleDetails: () => void
  onEditStop:      (stop: UserRouteStop) => void
  onCenterMap:     (lat: number, lng: number) => void
  onDeleteStop:    (stopId: string) => void
  onUpdateDayDetail: (detail: Partial<UserRouteDayDetail>) => void
}

function DayContentCard({
  group, dayDetail, isOwned, detailsOpen, onToggleDetails,
  onEditStop, onCenterMap, onDeleteStop, onUpdateDayDetail,
}: DayContentCardProps) {
  const { day, departure, destination, intermediate, alt, nm, isInherited } = group
  const dayColor = DAY_PALETTE[day % DAY_PALETTE.length]

  const [newHighlight, setNewHighlight] = useState('')
  const [newWarning,   setNewWarning]   = useState('')

  const depName = departure?.name ?? 'Departure'
  const dstName = destination?.name ?? 'Destination'

  const hasTimeline = !!(departure || destination || intermediate.length > 0)

  return (
    <View style={dc.card}>

      {/* Day header: Day badge · A → B · nm */}
      <View style={[dc.header, { borderLeftColor: dayColor }]}>
        <View style={[dc.dayBadge, { backgroundColor: dayColor + '18' }]}>
          <Text style={[dc.dayBadgeText, { color: dayColor }]}>Day {day + 1}</Text>
        </View>
        <View style={dc.legRow}>
          <Text style={dc.legText} numberOfLines={1}>{depName}</Text>
          {destination && (
            <>
              <Ionicons name="arrow-forward" size={10} color={Colors.textMuted} />
              <Text style={dc.legText} numberOfLines={1}>{dstName}</Text>
            </>
          )}
        </View>
        {nm > 0 && (
          <View style={dc.nmPill}>
            <Text style={dc.nmPillText}>{nm} nm</Text>
          </View>
        )}
      </View>

      {/* Day description (read-only view) */}
      {dayDetail?.description ? (
        <View style={dc.descBlock}>
          <Text style={dc.descText}>{dayDetail.description}</Text>
        </View>
      ) : null}

      {/* Along the way */}
      {hasTimeline && (
        <View style={dc.timelineSection}>
          <Text style={dc.sectionLabel}>Along the way</Text>

          {departure && (
            <TimelineRow
              stop={departure}
              role={isInherited ? 'inherited' : 'departure'}
              dayColor={dayColor}
              isOwned={isOwned}
              hasLine={!!(intermediate.length > 0 || destination)}
              onTap={() => isOwned
                ? onEditStop(departure)
                : departure.lat && departure.lng && onCenterMap(departure.lat, departure.lng)}
              onDelete={() => onDeleteStop(departure.id)}
            />
          )}

          {intermediate.map((stop, i) => (
            <TimelineRow
              key={stop.id}
              stop={stop}
              role="intermediate"
              dayColor={dayColor}
              isOwned={isOwned}
              hasLine={i < intermediate.length - 1 || !!destination}
              onTap={() => isOwned
                ? onEditStop(stop)
                : stop.lat && stop.lng && onCenterMap(stop.lat, stop.lng)}
              onDelete={() => onDeleteStop(stop.id)}
            />
          ))}

          {destination && (
            <TimelineRow
              stop={destination}
              role="destination"
              dayColor={dayColor}
              isOwned={isOwned}
              hasLine={!!alt}
              onTap={() => isOwned
                ? onEditStop(destination)
                : destination.lat && destination.lng && onCenterMap(destination.lat, destination.lng)}
              onDelete={() => onDeleteStop(destination.id)}
            />
          )}

          {alt && (
            <TimelineRow
              stop={alt}
              role="alt"
              dayColor={dayColor}
              isOwned={isOwned}
              hasLine={false}
              onTap={() => isOwned
                ? onEditStop(alt)
                : alt.lat && alt.lng && onCenterMap(alt.lat, alt.lng)}
              onDelete={() => onDeleteStop(alt.id)}
            />
          )}
        </View>
      )}

      {/* Highlights */}
      {(dayDetail?.highlights ?? []).length > 0 && (
        <View style={dc.hlSection}>
          <Text style={dc.sectionLabel}>Highlights</Text>
          {(dayDetail!.highlights!).map((h, i) => (
            <View key={i} style={dc.hlRow}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={dc.hlText}>{h}</Text>
              {isOwned && (
                <TouchableOpacity
                  onPress={() => {
                    const next = [...(dayDetail?.highlights ?? [])]
                    next.splice(i, 1)
                    onUpdateDayDetail({ highlights: next })
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={13} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Warnings */}
      {(dayDetail?.warnings ?? []).length > 0 && (
        <View style={dc.warnSection}>
          <Text style={dc.sectionLabel}>Heads up</Text>
          {(dayDetail!.warnings!).map((w, i) => (
            <View key={i} style={dc.warnRow}>
              <Ionicons name="warning-outline" size={14} color={Colors.warning} />
              <Text style={dc.warnText}>{w}</Text>
              {isOwned && (
                <TouchableOpacity
                  onPress={() => {
                    const next = [...(dayDetail?.warnings ?? [])]
                    next.splice(i, 1)
                    onUpdateDayDetail({ warnings: next })
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={13} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Day details editor (owned only, collapsible) */}
      {isOwned && (
        <>
          <TouchableOpacity
            style={dc.detailsToggle}
            onPress={onToggleDetails}
            activeOpacity={0.7}
          >
            <View style={dc.detailsToggleIcon}>
              <Ionicons name="create-outline" size={13} color={Colors.secondary} />
            </View>
            <Text style={dc.detailsToggleText}>Edit day details</Text>
            <Ionicons
              name={detailsOpen ? 'chevron-up' : 'chevron-down'}
              size={14} color={Colors.secondary}
            />
          </TouchableOpacity>

          {detailsOpen && (
            <View style={dc.detailsPanel}>
              {/* Description */}
              <Text style={dc.detailLabel}>Description</Text>
              <TextInput
                style={dc.detailInput}
                value={dayDetail?.description ?? ''}
                onChangeText={(t) => onUpdateDayDetail({ description: t })}
                placeholder="What makes this day special?"
                placeholderTextColor={Colors.textMuted}
                multiline
                scrollEnabled={false}
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Stay type */}
              <Text style={[dc.detailLabel, { marginTop: 12 }]}>Stay type</Text>
              <View style={dc.stayRow}>
                {STAY_TYPE_OPTIONS.map(({ type, label, icon }) => {
                  const active = dayDetail?.stayType === type
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[dc.stayChip,
                        active && { backgroundColor: dayColor + '22', borderColor: dayColor }]}
                      onPress={() => onUpdateDayDetail({ stayType: active ? undefined : type })}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={icon as any} size={12}
                        color={active ? dayColor : Colors.textMuted} />
                      <Text style={[dc.stayChipText, active && { color: dayColor }]}>{label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Highlights adder */}
              <Text style={[dc.detailLabel, { marginTop: 12 }]}>Highlights</Text>
              <View style={dc.addRow}>
                <TextInput
                  style={dc.addInput}
                  value={newHighlight}
                  onChangeText={setNewHighlight}
                  placeholder="Add highlight…"
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (!newHighlight.trim()) return
                    onUpdateDayDetail({ highlights: [...(dayDetail?.highlights ?? []), newHighlight.trim()] })
                    setNewHighlight('')
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (!newHighlight.trim()) return
                    onUpdateDayDetail({ highlights: [...(dayDetail?.highlights ?? []), newHighlight.trim()] })
                    setNewHighlight('')
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add-circle" size={22} color={Colors.success} />
                </TouchableOpacity>
              </View>

              {/* Warnings adder */}
              <Text style={[dc.detailLabel, { marginTop: 12 }]}>Heads up</Text>
              <View style={dc.addRow}>
                <TextInput
                  style={dc.addInput}
                  value={newWarning}
                  onChangeText={setNewWarning}
                  placeholder="Add heads up…"
                  placeholderTextColor={Colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (!newWarning.trim()) return
                    onUpdateDayDetail({ warnings: [...(dayDetail?.warnings ?? []), newWarning.trim()] })
                    setNewWarning('')
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (!newWarning.trim()) return
                    onUpdateDayDetail({ warnings: [...(dayDetail?.warnings ?? []), newWarning.trim()] })
                    setNewWarning('')
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add-circle" size={22} color={Colors.warning} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  )
}

// ── TimelineRow ───────────────────────────────────────────────────────────────

type TimelineRole = 'departure' | 'inherited' | 'intermediate' | 'destination' | 'alt'

interface TimelineRowProps {
  stop:     UserRouteStop
  role:     TimelineRole
  dayColor: string
  isOwned:  boolean
  hasLine:  boolean
  onTap:    () => void
  onDelete: () => void
}

function TimelineRow({ stop, role, dayColor, isOwned, hasLine, onTap, onDelete }: TimelineRowProps) {
  const isAnchor = role === 'departure' || role === 'inherited' || role === 'destination'
  const isAlt    = role === 'alt'

  const dotColor =
    role === 'departure' || role === 'inherited' ? '#22C55E' :
    role === 'destination'                       ? '#1B6CA8' :
    role === 'alt'                               ? '#F97316' :
    STOP_TYPE_COLORS[stop.type ?? 'CUSTOM'] ?? Colors.textMuted

  const roleLabel =
    role === 'departure'    ? 'Departure' :
    role === 'inherited'    ? 'Overnight arrival' :
    role === 'destination'  ? 'Destination' :
    role === 'alt'          ? 'Alt. Destination' :
    STOP_TYPE_OPTIONS.find((o) => o.type === (stop.type ?? 'CUSTOM'))?.label ?? 'Stop'

  const dotIcon =
    role === 'departure' || role === 'inherited' ? 'boat-outline' :
    role === 'destination'                       ? 'flag' :
    role === 'alt'                               ? 'git-branch-outline' :
    null

  return (
    <View style={tl.row}>
      {/* Timeline column */}
      <View style={tl.col}>
        {isAnchor || isAlt ? (
          <View style={[tl.anchorDot, { backgroundColor: dotColor, borderColor: dotColor + '30' }]}>
            {dotIcon && <Ionicons name={dotIcon as any} size={11} color="#fff" />}
          </View>
        ) : (
          <View style={[tl.stopDot, { backgroundColor: dotColor }]} />
        )}
        {hasLine && (
          <View style={[tl.line, { backgroundColor: isAlt ? '#F9731638' : dayColor + '30' }]} />
        )}
      </View>

      {/* Body */}
      <TouchableOpacity style={tl.body} onPress={onTap} activeOpacity={0.75}>
        <View style={tl.nameRow}>
          <Text style={[tl.name, isAnchor && tl.anchorName]} numberOfLines={1}>
            {stop.name ?? roleLabel}
          </Text>
        </View>

        <View style={[tl.roleBadge, { backgroundColor: dotColor + '14' }]}>
          <Text style={[tl.roleBadgeText, { color: dotColor }]}>{roleLabel}</Text>
        </View>

        {stop.description ? (
          <Text style={tl.desc} numberOfLines={2}>{stop.description}</Text>
        ) : null}

        {stop.notes ? (
          <View style={tl.notesRow}>
            <Ionicons name="document-text-outline" size={11} color={Colors.warning} />
            <Text style={tl.notesText} numberOfLines={1}>{stop.notes}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* Actions (owned only) */}
      {isOwned && (
        <View style={tl.actionsCol}>
          <TouchableOpacity
            style={tl.editActionBtn}
            onPress={onTap}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name="pencil-outline" size={14} color={Colors.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={tl.deleteActionBtn}
            onPress={() =>
              Alert.alert(
                'Remove Stop',
                `Remove "${stop.name ?? 'this stop'}" from the route?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: onDelete },
                ],
              )
            }
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name="trash-outline" size={14} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ── Main screen styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8EEF4' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  goBackBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24, marginTop: 8 },
  goBackBtnText: { color: '#fff', fontWeight: '700' },

  // Premium locked gate
  lockedGate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  lockedIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  lockedTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  lockedSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  lockedMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedMetaText: { fontSize: 13, color: Colors.textMuted },
  lockedBtn: { marginTop: 12, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Floating header
  floatingHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 6 },
  headerBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.secondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Map pins
  mapPin: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  mapPinText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Add stop mode overlay
  addStopOverlay: { position: 'absolute', left: 20, right: 20, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(27,108,168,0.88)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  addStopOverlayText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },

  // Bottom sheet
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 20, overflow: 'hidden' },
  handleArea: { paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 8 },

  // Stats row
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary + '12', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statPillText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontSize: 12, fontWeight: '600' },

  // Day tabs
  dayTabsScroll: { maxHeight: 44 },
  dayTabsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  dayTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  dayTabActiveAll: { borderColor: Colors.primary + '50', backgroundColor: Colors.primary + '10' },
  dayTabActive: { borderWidth: 1.5 },
  dayTabDot: { width: 7, height: 7, borderRadius: 3.5 },
  dayTabText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  dayTabTextActive: { fontWeight: '700' },

  // Sheet scroll
  sheetScroll: { flex: 1 },
  sheetContent: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },

  // Creator banner
  creatorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.primary + '08', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.primary + '20' },
  creatorAvatarPlaceholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center' },
  creatorName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  creatorDate: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },

  // Route description
  descCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  descText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, padding: 14 },
  descPlaceholder: { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 21, padding: 14 },
  descInput: { fontSize: 14, color: Colors.text, lineHeight: 21, minHeight: 64, padding: 14 },
  descEditHint: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingBottom: 10, marginTop: -4 },
  descEditHintText: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

  // Image gallery
  imageGalleryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  imageThumbnailWrap: { width: 100, height: 72, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  imageThumbnail: { width: '100%', height: '100%' },
  imageRemoveBtn: { position: 'absolute', top: 4, right: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3 },
  coverBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  coverBadgeText: { fontSize: 9, color: '#fff', fontWeight: '700' },
  imageAddBtn: { width: 100, height: 72, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.secondary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: Colors.secondary + '06' },
  imageAddBtnText: { fontSize: 11, fontWeight: '600', color: Colors.secondary },

  // Publish modal
  publishOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  publishSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 24 },
  publishIconRow: { alignItems: 'center', marginBottom: 16 },
  publishIconCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.secondary + '15', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.secondary + '30' },
  publishModalTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 10 },
  publishModalBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  publishFeatureRow: { gap: 10, marginBottom: 24 },
  publishFeatureItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  publishFeatureText: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  publishConfirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.secondary, borderRadius: 16, paddingVertical: 15, shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6, marginBottom: 12 },
  publishConfirmBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  publishCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  publishCancelBtnText: { fontSize: 14, color: Colors.textMuted },

  // Success modal
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  successSheet: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', maxWidth: 340, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 16 },
  successIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.success + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1.5, borderColor: Colors.success + '30' },
  successTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 10 },
  successBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successDismissBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 40 },
  successDismissBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyStateTitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },

  // Add stop button
  addStopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12, backgroundColor: Colors.primary + '06' },
  addStopBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },

  // Social row
  socialRow: { flexDirection: 'row', gap: 8 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.background, borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: Colors.border },
  socialBtnLiked: { backgroundColor: '#EF444410', borderColor: '#EF444430' },
  socialBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  // Action block
  actionBlock: { gap: 8, marginTop: 4 },
  publishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.secondary, borderRadius: 14, paddingVertical: 13, shadowColor: Colors.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 5 },
  publishBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  publishedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.success + '10', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.success + '30' },
  publishedText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.success },
  unpublishBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  unpublishBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: Colors.danger + '40', borderRadius: 12, paddingVertical: 11 },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: Colors.danger },

  metaDate: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },

  // Stop edit modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%' },
  editHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 14 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  modalDoneBtn: { backgroundColor: Colors.secondary, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 18 },
  modalDoneText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  fieldLabelOpt: { fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: Colors.textMuted },
  fieldInput: { backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: Colors.text, marginBottom: 18 },
  fieldTextarea: { backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: Colors.text, minHeight: 72, textAlignVertical: 'top', marginBottom: 18 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
})

// ── DayContentCard styles ─────────────────────────────────────────────────────

const dc = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, borderLeftWidth: 3 },
  dayBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, flexShrink: 0 },
  dayBadgeText: { fontSize: 12, fontWeight: '800' },
  legRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' },
  legText: { fontSize: 12, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  nmPill: { backgroundColor: Colors.primary + '10', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  nmPillText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  descBlock: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2 },
  descText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, fontStyle: 'italic' },

  timelineSection: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },

  hlSection: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, backgroundColor: '#F8FFFA' },
  hlRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 },
  hlText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 18 },

  warnSection: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, backgroundColor: '#FFFBF5' },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 },
  warnText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 18 },

  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, backgroundColor: Colors.secondary + '06' },
  detailsToggleIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.secondary + '18', alignItems: 'center', justifyContent: 'center' },
  detailsToggleText: { fontSize: 13, fontWeight: '600', color: Colors.secondary, flex: 1 },

  detailsPanel: { paddingHorizontal: 14, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, backgroundColor: '#FAFBFC' },
  detailLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginTop: 12, marginBottom: 6 },
  detailInput: { borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.text, backgroundColor: '#fff', textAlignVertical: 'top', minHeight: 72 },
  stayRow: { flexDirection: 'row', gap: 8 },
  stayChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff' },
  stayChipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  addInput: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: Colors.text, backgroundColor: '#fff' },
})

// ── TimelineRow styles ────────────────────────────────────────────────────────

const tl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 2 },
  col: { width: 26, alignItems: 'center', flexShrink: 0 },
  anchorDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 2 },
  stopDot: { width: 11, height: 11, borderRadius: 5.5, marginTop: 7, flexShrink: 0 },
  line: { width: 1.5, flex: 1, minHeight: 14, marginTop: 3, borderRadius: 1 },
  body: { flex: 1, paddingTop: 2, paddingBottom: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  name: { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1 },
  anchorName: { fontSize: 14, fontWeight: '700' },
  roleBadge: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  desc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, marginBottom: 3 },
  notesRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  notesText: { fontSize: 11, color: Colors.warning, flex: 1, fontStyle: 'italic' },
  actionsCol: { flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 4, paddingLeft: 2 },
  editActionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.secondary + '12', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.secondary + '25' },
  deleteActionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.danger + '08', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.danger + '25' },
})
