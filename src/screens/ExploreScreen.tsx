import React, { useRef, useState, useMemo, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform, TextInput, FlatList,
  Keyboard, Modal, KeyboardAvoidingView, Image,
  Alert, Animated,
} from 'react-native'
import MapView, { Marker, Region } from 'react-native-maps'
import Supercluster from 'supercluster'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Place } from '../types/place'
import {
  CanonicalPlaceType,
  FilterKey,
  PLACE_TYPE_FILTERS,
  PLACE_TYPE_QUICK,
  getPlaceTypeMeta,
  normalizePlaceType,
} from '../constants/placeTypes'
import { seedPlaces } from '../data/seedPlaces'
import { usePlacesStore } from '../store/placesStore'
import { useAuthStore } from '../store/authStore'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useConditionsStore, SEVERITY_META } from '../store/conditionsStore'
import { PlaceMarker, MARKER_ANCHOR } from '../components/PlaceMarker'
import { PlacePopup } from '../components/PlacePopup'
import { SignalMarker } from '../components/SignalMarker'
import { SignalCard } from '../components/SignalCard'
import { CreateSignalModal } from '../components/CreateSignalModal'
import { Colors } from '../constants/colors'
import { Signal, subscribeToActiveSignals, findUserSignal } from '../lib/signalService'
import { setSharedMapRegion } from '../utils/sharedMapRegion'

// Filter + quick-add config imported from central registry

// ── Layout constants ────────────────────────────────────────────────────────

const SEARCH_TOP  = Platform.OS === 'ios' ? 56  : 36
const FILTER_TOP  = SEARCH_TOP  + 52
const COUNT_TOP   = FILTER_TOP  + 46

// ── Place type emoji map (for add-place chips) ───────────────────────────────

const CHIP_EMOJI: Partial<Record<CanonicalPlaceType, string>> = {
  ANCHORAGE:  '⚓',
  BAY:        '🌊',
  LAGOON:     '🏞️',
  BEACH:      '🏖️',
  SNORKELING: '🤿',
  MARINA:     '⛵',
  CAVE:       '🕳️',
  POI:        '📍',
}

// ── Cluster / bbox constants ────────────────────────────────────────────────

/**
 * Fractional padding applied to the cluster bbox on each side.
 * Without this, markers at the viewport edge are excluded from getClusters()
 * → unmounted by React → remounted on zoom-out → snapshot taken before fonts
 * load → blank marker ("never comes back").
 * 0.25 = 25 % overhang on each side.
 */
const BBOX_PAD = 0.25

// ── Initial map region ──────────────────────────────────────────────────────

const INITIAL_REGION: Region = {
  latitude: 43.2, longitude: 16.5,
  latitudeDelta: 5, longitudeDelta: 6,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function rankResults(places: Place[], query: string): Place[] {
  const q = query.toLowerCase().trim()
  const score = (p: Place) => {
    const name    = p.name.toLowerCase()
    const region  = p.region.toLowerCase()
    const country = p.country.toLowerCase()
    if (name.startsWith(q))           return 3
    if (name.includes(q))             return 2
    if (region.includes(q) || country.includes(q)) return 1
    return 0
  }
  return places
    .map((p) => ({ p, s: score(p) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .map(({ p }) => p)
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const mapRef           = useRef<MapView>(null)
  const searchRef        = useRef<TextInput>(null)
  const currentRegionRef = useRef(INITIAL_REGION)
  // Last zoom integer committed to region state. Used to trigger an IMMEDIATE
  // setRegion when the integer changes (cluster arrangement changes).
  const lastCommittedZoom = useRef(-1)
  // Debounce timer for within-zoom-level bbox drift.
  // Supercluster zoom level N covers a 2× latitudeDelta range. Within that
  // range the zoom integer never changes, so the zoom-integer check alone
  // never fires setRegion. The bbox can drift by up to half a viewport width,
  // pushing signals outside the stale padded bbox → they unmount.
  // The debounce fires setRegion at most every 100 ms during a gesture so the
  // bbox stays fresh without rendering at 60 fps.
  const regionDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeFilter,   setActiveFilter]   = useState<FilterKey>('ALL')
  const [selectedPlace,  setSelectedPlace]  = useState<Place | null>(null)
  const [locating,       setLocating]       = useState(false)
  const [searchQuery,    setSearchQuery]    = useState('')
  const [searchFocused,  setSearchFocused]  = useState(false)

  // ── Add Place sheet state ─────────────────────────────────────────────────
  const [longPressCoord, setLongPressCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [quickName,      setQuickName]      = useState('')
  const [quickType,      setQuickType]      = useState<CanonicalPlaceType>('ANCHORAGE')
  const [quickDesc,      setQuickDesc]      = useState('')
  const [quickPhotos,    setQuickPhotos]    = useState<string[]>([])

  // ── Add-place mode state ──────────────────────────────────────────────────
  /** True while user is panning the map to pick a location for a new place */
  const [addPlaceMode, setAddPlaceMode] = useState(false)

  // ── Signal state ──────────────────────────────────────────────────────────
  const [signals,          setSignals]          = useState<Signal[]>([])
  const [selectedSignal,   setSelectedSignal]   = useState<Signal | null>(null)
  const [signalMode,       setSignalMode]        = useState(false)
  const [signalCoord,      setSignalCoord]       = useState<{ lat: number; lng: number } | null>(null)
  const [createSignalOpen, setCreateSignalOpen]  = useState(false)
  const [userLocation,     setUserLocation]      = useState<{ lat: number; lng: number } | null>(null)
  const [toastVisible,     setToastVisible]      = useState(false)
  const signalToastAnim = useRef(new Animated.Value(0)).current
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard')

  // ── Reposition mode state ─────────────────────────────────────────────────
  /** The place currently being repositioned (drag mode active) */
  const [repositioningPlace, setRepositioningPlace] = useState<Place | null>(null)
  /** Tracks the dragged coord before the user saves */
  const [repositionCoord, setRepositionCoord] = useState<{ lat: number; lng: number } | null>(null)

  const { userPlaces, addPlace, repositionPlace, localUserId } = usePlacesStore()

  // Subscribe to live signals on mount
  React.useEffect(() => {
    const unsub = subscribeToActiveSignals(setSignals)
    return unsub
  }, [])

  // Silently fetch user location once for nearby filter (no prompt if not granted)
  React.useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low })
        .then((loc) => setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude }))
        .catch(() => {})
    })
  }, [])
  const authUser = useAuthStore((s) => s.user)
  const { getActiveReportsForPlace, getHighestSeverityForPlace } = useConditionsStore()

  const currentUserId = authUser?.id ?? localUserId
  const currentRole   = authUser?.role

  const allPlaces = useMemo(() => [...seedPlaces, ...userPlaces], [userPlaces])

  const isSearching = searchFocused || searchQuery.length > 0

  const searchResults = useMemo(
    () => (searchQuery.trim().length > 0 ? rankResults(allPlaces, searchQuery) : allPlaces),
    [allPlaces, searchQuery],
  )

  const visiblePlaces = useMemo(
    () => activeFilter === 'ALL'
      ? allPlaces
      : allPlaces.filter((p) => normalizePlaceType(p.type) === activeFilter),
    [allPlaces, activeFilter],
  )

  // ── Clustering ────────────────────────────────────────────────────────────
  const [region, setRegion] = useState<Region>(INITIAL_REGION)

  const clusterIndex = useMemo(() => {
    const index = new Supercluster<{ placeId: string }>({ radius: 50, maxZoom: 7 })
    index.load(
      visiblePlaces.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { placeId: p.id },
      }))
    )
    return index
  }, [visiblePlaces])

  const clusters = useMemo(() => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region
    // Math.floor instead of Math.round: avoids flip-flopping at zoom boundaries
    // (e.g. 6.5 rounds to 7 then back to 6 on tiny region change → clusters
    // constantly reform with new internal IDs → unmount/remount flash).
    const zoom = Math.min(20, Math.max(0, Math.floor(Math.log2(360 / latitudeDelta))))
    const bbox: [number, number, number, number] = [
      longitude - longitudeDelta / 2 * (1 + BBOX_PAD),
      latitude  - latitudeDelta  / 2 * (1 + BBOX_PAD),
      longitude + longitudeDelta / 2 * (1 + BBOX_PAD),
      latitude  + latitudeDelta  / 2 * (1 + BBOX_PAD),
    ]
    return clusterIndex.getClusters(bbox, zoom)
  }, [clusterIndex, region])


  // ── Actions ───────────────────────────────────────────────────────────────

  const flyToPlace = useCallback((place: Place) => {
    // Zoom to a city-region scale and offset the center slightly south of the
    // place so the teardrop tip appears in the upper portion of the screen,
    // comfortably above the bottom popup.
    const delta = 0.38
    mapRef.current?.animateToRegion(
      { latitude: place.lat + delta * 0.13, longitude: place.lng, latitudeDelta: delta, longitudeDelta: delta * 1.3 },
      420,
    )
  }, [])

  const handleMarkerPress = useCallback((place: Place) => {
    if (repositioningPlace) return    // ignore taps while dragging
    setSelectedPlace(place)
    // Pan so the teardrop tip (the coordinate) appears in the upper ~35% of screen,
    // well above the bottom-anchored popup. Shift center NORTH of place so place
    // appears below center = higher on screen, further from the popup.
    const { latitudeDelta, longitudeDelta } = currentRegionRef.current
    mapRef.current?.animateToRegion(
      {
        latitude:  place.lat + latitudeDelta * 0.13,
        longitude: place.lng,
        latitudeDelta,
        longitudeDelta,
      },
      280,
    )
  }, [repositioningPlace])

  const handleSearchSelect = (place: Place) => {
    Keyboard.dismiss()
    setSearchQuery('')
    setSearchFocused(false)
    setSelectedPlace(place)
    flyToPlace(place)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    searchRef.current?.focus()
  }

  const handleDismissSearch = () => {
    Keyboard.dismiss()
    setSearchQuery('')
    setSearchFocused(false)
  }

  const handleMapPress = () => {
    if (isSearching) { handleDismissSearch(); return }
    if (selectedPlace) { setSelectedPlace(null); return }
    if (selectedSignal) { setSelectedSignal(null); return }
  }

  const handleBuildRoute = () => {
    // Flush the live map center into sharedMapRegion right now (don't rely on
    // the last onRegionChangeComplete — user may have been mid-pan).
    const liveRegion = currentRegionRef.current
    setSharedMapRegion(liveRegion)
    console.log('[ExploreScreen] handleBuildRoute — live region:', liveRegion)

    // Reset and create synchronously so draftRoute is non-null on first render.
    const { resetRouteBuilder, createNewRouteDraft } = useRouteBuilderStore.getState()
    resetRouteBuilder()
    createNewRouteDraft()
    router.push('/route-builder')
  }

  const openAddPlaceAt = useCallback((lat: number, lng: number) => {
    setLongPressCoord({ lat, lng })
    setQuickName('')
    setQuickType('ANCHORAGE')
    setQuickDesc('')
    setQuickPhotos([])
  }, [])

  const handleConfirmAddPlaceMode = useCallback(() => {
    const { latitude, longitude } = currentRegionRef.current
    setAddPlaceMode(false)
    openAddPlaceAt(latitude, longitude)
  }, [openAddPlaceAt])

  const handleConfirmSignalMode = useCallback(() => {
    const { latitude, longitude } = currentRegionRef.current
    setSignalMode(false)
    setSignalCoord({ lat: latitude, lng: longitude })
    setCreateSignalOpen(true)
  }, [])

  const showSignalToast = useCallback(() => {
    setToastVisible(true)
    Animated.sequence([
      Animated.timing(signalToastAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(signalToastAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => setToastVisible(false))
  }, [signalToastAnim])

  // ── Photo picker ──────────────────────────────────────────────────────────

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach photos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      allowsMultipleSelection: false,
    })
    if (!result.canceled && result.assets.length > 0) {
      setQuickPhotos((prev) => [...prev, result.assets[0].uri])
    }
  }

  const handleRemovePhoto = (uri: string) => {
    setQuickPhotos((prev) => prev.filter((p) => p !== uri))
  }

  // ── Add Place save ────────────────────────────────────────────────────────

  const handleQuickSave = () => {
    if (!quickName.trim() || !longPressCoord) return
    addPlace(
      {
        name:        quickName.trim(),
        type:        normalizePlaceType(quickType),
        lat:         longPressCoord.lat,
        lng:         longPressCoord.lng,
        description: quickDesc.trim(),
        country:     '',
        region:      '',
        photos:      quickPhotos,
      },
      currentUserId,
      currentRole,
    )
    setLongPressCoord(null)
  }

  // ── Reposition handlers ───────────────────────────────────────────────────

  const handleStartReposition = useCallback((place: Place) => {
    setSelectedPlace(null)
    setRepositioningPlace(place)
    setRepositionCoord({ lat: place.lat, lng: place.lng })
    // Zoom in close to the marker so the user can position precisely
    mapRef.current?.animateToRegion(
      { latitude: place.lat, longitude: place.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      400,
    )
  }, [])

  const handleRepositionSave = () => {
    if (!repositioningPlace || !repositionCoord) return
    repositionPlace(
      repositioningPlace.id,
      repositionCoord.lat,
      repositionCoord.lng,
      currentUserId,
      currentRole,
    )
    setRepositioningPlace(null)
    setRepositionCoord(null)
  }

  const handleRepositionCancel = () => {
    setRepositioningPlace(null)
    setRepositionCoord(null)
  }

  const handleLocateMe = async () => {
    if (locating) return
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      mapRef.current?.animateToRegion(
        { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 },
        500,
      )
    } catch {
      // permission denied or unavailable
    } finally {
      setLocating(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isRepositioning = !!repositioningPlace
  const isAddingPlace   = addPlaceMode
  const isSignalMode    = signalMode

  return (
    <View style={styles.container}>

      {/* ── Full-screen map ─────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={INITIAL_REGION}
        onRegionChange={(r) => {
          // Always keep the ref current — used elsewhere for live center reads.
          currentRegionRef.current = r
          const z = Math.min(20, Math.max(0, Math.floor(Math.log2(360 / r.latitudeDelta))))

          if (z !== lastCommittedZoom.current) {
            // ── Zoom integer changed ──────────────────────────────────────────
            // Cluster arrangement changes at this boundary → commit immediately.
            // Cancel any pending debounce (superseded by this update).
            lastCommittedZoom.current = z
            if (regionDebounce.current) { clearTimeout(regionDebounce.current); regionDebounce.current = null }
            setRegion(r)
          } else {
            // ── Same zoom integer, bbox drifting ─────────────────────────────
            // Zoom level N covers a 2× latitudeDelta range. Within that range
            // the integer check above never fires, but the bbox can shrink or
            // shift enough to push signals outside it → markers unmount.
            // Fix: debounce a setRegion to keep the bbox fresh (≤10 renders/sec).
            // Use currentRegionRef at timeout time, not the captured r, so we
            // always commit the freshest position even if the gesture continued.
            if (regionDebounce.current) clearTimeout(regionDebounce.current)
            regionDebounce.current = setTimeout(() => {
              regionDebounce.current = null
              setRegion(currentRegionRef.current)
            }, 100)
          }
        }}
        onRegionChangeComplete={(r) => {
          // Gesture + animation fully settled. Cancel any pending debounce —
          // this call supersedes it with the precise final region.
          if (regionDebounce.current) { clearTimeout(regionDebounce.current); regionDebounce.current = null }
          currentRegionRef.current = r
          lastCommittedZoom.current = Math.min(20, Math.max(0, Math.floor(Math.log2(360 / r.latitudeDelta))))
          setRegion(r)
          setSharedMapRegion(r)
        }}
        onPress={handleMapPress}
        showsUserLocation
        showsCompass={false}
        showsScale={false}
        mapType={mapType}
      >
        {/* During reposition mode skip clustering — show all individual markers */}
        {repositioningPlace
          ? visiblePlaces.map((place) => {
              const isBeingRepositioned = repositioningPlace.id === place.id
              const lat = isBeingRepositioned ? (repositionCoord?.lat ?? place.lat) : place.lat
              const lng = isBeingRepositioned ? (repositionCoord?.lng ?? place.lng) : place.lng
              return (
                <Marker
                  key={place.id}
                  coordinate={{ latitude: lat, longitude: lng }}
                  onPress={() => handleMarkerPress(place)}
                  draggable={isBeingRepositioned}
                  onDragEnd={isBeingRepositioned
                    ? (e) => setRepositionCoord({
                        lat: e.nativeEvent.coordinate.latitude,
                        lng: e.nativeEvent.coordinate.longitude,
                      })
                    : undefined}
                  tracksViewChanges={isBeingRepositioned}
                  anchor={MARKER_ANCHOR}
                >
                  <PlaceMarker type={place.type} selected={isBeingRepositioned} isPremium={place.isPremium} />
                </Marker>
              )
            })
          : clusters.map((cluster) => {
              const [lng, lat] = cluster.geometry.coordinates
              const props = cluster.properties as any

              if (props.cluster) {
                // ── Cluster bubble ──────────────────────────────────────
                // Key: position-based, not cluster.id — supercluster reassigns
                // internal IDs whenever clusters reform at a new zoom level,
                // causing React to unmount+remount on every zoom gesture.
                return (
                  <StableMarker
                    key={`cluster-${Math.round(lat * 1e4)}-${Math.round(lng * 1e4)}`}
                    coordinate={{ latitude: lat, longitude: lng }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    onPress={() => {
                      const expansion = clusterIndex.getClusterExpansionZoom(cluster.id as number)
                      const newDelta = 360 / Math.pow(2, expansion)
                      mapRef.current?.animateToRegion(
                        { latitude: lat, longitude: lng, latitudeDelta: newDelta, longitudeDelta: newDelta },
                        350,
                      )
                    }}
                  >
                    <ClusterBubble count={props.point_count} />
                  </StableMarker>
                )
              }

              // ── Individual place marker ──────────────────────────────
              const place = visiblePlaces.find((p) => p.id === props.placeId)
              if (!place) return null
              return (
                <Marker
                  key={place.id}
                  coordinate={{ latitude: lat, longitude: lng }}
                  onPress={() => handleMarkerPress(place)}
                  tracksViewChanges={selectedPlace?.id === place.id}
                  anchor={MARKER_ANCHOR}
                >
                  <PlaceMarker type={place.type} selected={selectedPlace?.id === place.id} isPremium={place.isPremium} />
                </Marker>
              )
            })
        }
        {/* ── Signal markers — stable persistent layer, no clustering, no bbox ── */}
        {signals.map((signal) => (
          <PersistentSignalMarker
            key={signal.id}
            signal={signal}
            isSelected={selectedSignal?.id === signal.id}
            onPress={() => { setSelectedPlace(null); setSelectedSignal(signal) }}
          />
        ))}
      </MapView>

      {/* ── Search bar (hidden while repositioning) ──────────────────────── */}
      {!isRepositioning && (
        <View style={styles.searchBarWrapper} pointerEvents="box-none">
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <Ionicons name="search-outline" size={17} color={searchFocused ? Colors.primary : Colors.textMuted} />
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              placeholder="Search places, regions, countries…"
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              returnKeyType="search"
              clearButtonMode="never"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            {isSearching && searchQuery.length === 0 && (
              <TouchableOpacity onPress={handleDismissSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Filter chips (hidden while searching or repositioning) ──────── */}
      {!isSearching && !isRepositioning && (
        <View style={styles.filterBarWrapper} pointerEvents="box-none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterBarContent}
            style={styles.filterBar}
            keyboardShouldPersistTaps="handled"
          >
            {PLACE_TYPE_FILTERS.map((f) => {
              const isActive = activeFilter === f.key
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, isActive && { backgroundColor: f.activeColor, borderColor: f.activeColor }]}
                  onPress={() => setActiveFilter(f.key)}
                  activeOpacity={0.82}
                >
                  <Ionicons name={f.icon as any} size={14} color={isActive ? '#fff' : Colors.textSecondary} />
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>{f.label}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Search results panel ─────────────────────────────────────────── */}
      {isSearching && !isRepositioning && (
        <View style={styles.resultsPanel}>
          {searchQuery.trim().length === 0 ? (
            <View style={styles.resultsHint}>
              <Ionicons name="compass-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.resultsHintTitle}>Search places</Text>
              <Text style={styles.resultsHintSub}>
                Try a place name, region, or country — e.g. "Hydra", "Croatia", "Marina"
              </Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.resultsHint}>
              <Ionicons name="search-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.resultsHintTitle}>No places found</Text>
              <Text style={styles.resultsHintSub}>Try a different name, region, or country</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.resultsList}
              ItemSeparatorComponent={() => <View style={styles.resultsDivider} />}
              renderItem={({ item }) => {
                const tm = getPlaceTypeMeta(item.type)
                const severity = getHighestSeverityForPlace(item.id)
                const sevMeta  = severity ? SEVERITY_META[severity] : null
                return (
                  <TouchableOpacity
                    style={styles.resultRow}
                    onPress={() => handleSearchSelect(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.resultIcon, { backgroundColor: tm.color + '18' }]}>
                      <Ionicons name={tm.icon as any} size={18} color={tm.color} />
                    </View>
                    <View style={styles.resultInfo}>
                      <View style={styles.resultNameRow}>
                        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                        {item.isVerified && (
                          <Ionicons name="checkmark-circle" size={13} color={Colors.verified} />
                        )}
                        {sevMeta && (
                          <View style={[styles.resultSevBadge, { backgroundColor: sevMeta.bg }]}>
                            <Text style={[styles.resultSevText, { color: sevMeta.color }]}>{severity}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.resultSub}>{item.region} · {item.country}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.border} />
                  </TouchableOpacity>
                )
              }}
            />
          )}
        </View>
      )}

      {/* ── Map type toggle pill ──────────────────────────────────────────── */}
      {!isSearching && !isRepositioning && !isAddingPlace && !isSignalMode && (
        <View style={styles.mapTypePill} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.mapTypeBtn, mapType === 'standard' && styles.mapTypeBtnActive]}
            onPress={() => setMapType('standard')}
            activeOpacity={0.8}
          >
            <Text style={[styles.mapTypeText, mapType === 'standard' && styles.mapTypeTextActive]}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mapTypeBtn, mapType === 'satellite' && styles.mapTypeBtnActive]}
            onPress={() => setMapType('satellite')}
            activeOpacity={0.8}
          >
            <Text style={[styles.mapTypeText, mapType === 'satellite' && styles.mapTypeTextActive]}>Satellite</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom controls ──────────────────────────────────────────────── */}
      {!isSearching && !isRepositioning && !isAddingPlace && !isSignalMode && (
        <>
          <TouchableOpacity style={styles.buildRouteBtn} onPress={handleBuildRoute} activeOpacity={0.85}>
            <Ionicons name="git-branch-outline" size={16} color="#fff" />
            <Text style={styles.buildRouteBtnText}>
              Build Route
            </Text>
          </TouchableOpacity>

          {/* Signal FAB */}
          <TouchableOpacity
            style={styles.signalFab}
            onPress={() => setSignalMode(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="radio-outline" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Add Place FAB */}
          <TouchableOpacity
            style={styles.addPlaceFab}
            onPress={() => setAddPlaceMode(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.locateBtn, locating && styles.locateBtnActive]}
            onPress={handleLocateMe}
            activeOpacity={0.85}
          >
            <Ionicons
              name={locating ? 'locate' : 'locate-outline'}
              size={22}
              color={locating ? Colors.accent : Colors.primary}
            />
          </TouchableOpacity>
        </>
      )}

      {/* ── Add-place mode: crosshair + confirm banner ────────────────────── */}
      {isAddingPlace && (
        <>
          {/* Crosshair centered on screen */}
          <View style={styles.crosshairWrap} pointerEvents="none">
            <View style={styles.crosshairH} />
            <View style={styles.crosshairV} />
            <View style={styles.crosshairRing} />
            <View style={styles.crosshairDot} />
          </View>

          {/* Instruction + confirm banner */}
          <View style={styles.addPlaceBanner}>
            <View style={styles.addPlaceBannerTop}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addPlaceBannerTitle}>Move the map to place your pin</Text>
                <Text style={styles.addPlaceBannerSub}>The crosshair marks the exact location</Text>
              </View>
            </View>
            <View style={styles.addPlaceBannerActions}>
              <TouchableOpacity style={styles.addPlaceCancel} onPress={() => setAddPlaceMode(false)}>
                <Text style={styles.addPlaceCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPlaceConfirm} onPress={handleConfirmAddPlaceMode} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.addPlaceConfirmText}>Set Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ── Signal mode: crosshair + confirm banner ──────────────────────── */}
      {isSignalMode && (
        <>
          <View style={styles.crosshairWrap} pointerEvents="none">
            <View style={styles.crosshairH} />
            <View style={styles.crosshairV} />
            <View style={styles.crosshairRing} />
            <View style={styles.crosshairDot} />
          </View>
          <View style={styles.addPlaceBanner}>
            <View style={styles.addPlaceBannerTop}>
              <Ionicons name="radio-outline" size={18} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addPlaceBannerTitle}>Move the map to place your signal</Text>
                <Text style={styles.addPlaceBannerSub}>Signal expires automatically in 24h</Text>
              </View>
            </View>
            <View style={styles.addPlaceBannerActions}>
              <TouchableOpacity style={styles.addPlaceCancel} onPress={() => setSignalMode(false)}>
                <Text style={styles.addPlaceCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPlaceConfirm} onPress={handleConfirmSignalMode} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.addPlaceConfirmText}>Set Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ── Signal card ───────────────────────────────────────────────────── */}
      {selectedSignal && !isSearching && !isRepositioning && (
        <SignalCard
          signal={selectedSignal}
          currentUserId={currentUserId}
          onClose={() => setSelectedSignal(null)}
        />
      )}

      {/* ── Create signal modal ───────────────────────────────────────────── */}
      {signalCoord && (
        <CreateSignalModal
          visible={createSignalOpen}
          lat={signalCoord.lat}
          lng={signalCoord.lng}
          userId={currentUserId}
          userName={authUser?.name ?? 'Sailor'}
          existingSignal={findUserSignal(signals, currentUserId)}
          onClose={() => { setCreateSignalOpen(false); setSignalCoord(null) }}
          onPosted={() => { setCreateSignalOpen(false); setSignalCoord(null); showSignalToast() }}
        />
      )}

      {/* ── Place popup ─────────────────────────────────────────────────── */}
      {selectedPlace && !isSearching && !isRepositioning && (
        <PlacePopup
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
          onReposition={handleStartReposition}
        />
      )}

      {/* ── Reposition mode overlay ──────────────────────────────────────── */}
      {isRepositioning && repositioningPlace && (
        <View style={styles.repositionBanner}>
          <View style={styles.repositionInfo}>
            <Ionicons name="move-outline" size={18} color={Colors.primary} />
            <View>
              <Text style={styles.repositionTitle}>Reposition "{repositioningPlace.name}"</Text>
              <Text style={styles.repositionSub}>Drag the marker to the correct position</Text>
            </View>
          </View>
          <View style={styles.repositionActions}>
            <TouchableOpacity style={styles.repositionCancel} onPress={handleRepositionCancel}>
              <Text style={styles.repositionCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.repositionSave} onPress={handleRepositionSave}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.repositionSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Signal posted toast ─────────────────────────────────────────── */}
      {toastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.signalToast,
            {
              opacity: signalToastAnim,
              transform: [{
                translateY: signalToastAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }),
              }],
            },
          ]}
        >
          <Text style={styles.signalToastText}>Your signal is live 🔥</Text>
        </Animated.View>
      )}

      {/* ── Long-press add place modal ───────────────────────────────────── */}
      <Modal
        visible={longPressCoord !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLongPressCoord(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Tap-to-dismiss backdrop */}
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => { Keyboard.dismiss(); setLongPressCoord(null) }}
          />

          {/* Sheet */}
          <View style={styles.quickSheet}>
            <View style={styles.quickHandle} />

            <Text style={styles.quickTitle}>Add Place</Text>
            {longPressCoord && (
              <Text style={styles.quickCoords}>
                {longPressCoord.lat.toFixed(5)}° N,  {longPressCoord.lng.toFixed(5)}° E
              </Text>
            )}

            <ScrollView
              style={styles.quickScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.quickScrollContent}
            >
              {/* Name */}
              <TextInput
                style={styles.quickInput}
                placeholder="Place name…"
                placeholderTextColor={Colors.textMuted}
                value={quickName}
                onChangeText={setQuickName}
                returnKeyType="next"
              />

              {/* Type chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickTypes}
                keyboardShouldPersistTaps="handled"
              >
                {PLACE_TYPE_QUICK.map(({ type, label, color }) => {
                  const active = quickType === type
                  const emoji  = CHIP_EMOJI[type]
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.quickTypeChip, active && { backgroundColor: color, borderColor: color }]}
                      onPress={() => setQuickType(type)}
                    >
                      {emoji ? <Text style={styles.quickTypeEmoji}>{emoji}</Text> : null}
                      <Text style={[styles.quickTypeText, active && styles.quickTypeTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              {/* Description */}
              <TextInput
                style={[styles.quickInput, styles.quickDescInput]}
                placeholder="Description (optional)…"
                placeholderTextColor={Colors.textMuted}
                value={quickDesc}
                onChangeText={setQuickDesc}
                multiline
                numberOfLines={3}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              {/* Photos section */}
              <View style={styles.photosSection}>
                <Text style={styles.photosSectionLabel}>Photos</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.photosRow}
                >
                  {/* Add photo button */}
                  <TouchableOpacity style={styles.photoAddBtn} onPress={handlePickPhoto} activeOpacity={0.75}>
                    <Ionicons name="camera-outline" size={22} color={Colors.primary} />
                    <Text style={styles.photoAddText}>Add</Text>
                  </TouchableOpacity>

                  {/* Photo thumbnails */}
                  {quickPhotos.map((uri) => (
                    <View key={uri} style={styles.photoThumb}>
                      <Image source={{ uri }} style={styles.photoThumbImg} />
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={() => handleRemovePhoto(uri)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Ionicons name="close-circle" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickCancel}
                onPress={() => { Keyboard.dismiss(); setLongPressCoord(null) }}
              >
                <Text style={styles.quickCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickSave, !quickName.trim() && styles.quickSaveDisabled]}
                onPress={handleQuickSave}
                disabled={!quickName.trim()}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.quickSaveText}>Add Place</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── Cluster bubble component ──────────────────────────────────────────────────

function ClusterBubble({ count }: { count: number }) {
  const size     = count < 10 ? 34 : count < 50 ? 40 : 46
  const ringSize = size + 12
  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[clusterStyles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]} />
      <View style={[clusterStyles.bubble, { width: size, height: size, borderRadius: size / 2, position: 'absolute' }]}>
        <Text style={clusterStyles.count}>{count < 100 ? count : '99+'}</Text>
      </View>
    </View>
  )
}

// ── StableMarker ──────────────────────────────────────────────────────────────
//
// react-native-maps captures a native bitmap snapshot of a Marker's React view
// tree when tracksViewChanges transitions to false. If the snapshot is taken
// before text/emoji fonts have painted (a race on mount + remount), the result
// is a blank/invisible marker.
//
// This wrapper starts with tracksViewChanges=true — keeping the native layer in
// sync with the JS view — then disables it after 500 ms. 500 ms is one full
// bridge-render cycle: enough for fonts to load and text to paint.
//
// Because the key drives identity, every fresh mount (due to bbox exclusion or
// cluster reformation) resets the timer and guarantees a correct snapshot.
//
// PlaceMarker does NOT need this wrapper because it uses pure Views/borders
// with no font-dependent content. ClusterBubble uses StableMarker.
// Signal markers use PersistentSignalMarker instead (see below).

function StableMarker({ children, ...rest }: React.ComponentProps<typeof Marker>) {
  const [tracks, setTracks] = useState(true)
  React.useEffect(() => {
    const t = setTimeout(() => setTracks(false), 500)
    return () => clearTimeout(t)
  }, [])
  return <Marker {...rest} tracksViewChanges={tracks}>{children}</Marker>
}

// ── PersistentSignalMarker ────────────────────────────────────────────────────
//
// Signals are a static overlay: mounted once per signal from the Firestore
// subscription, never unmounted due to zoom, bbox, or region changes.
//
// tracksViewChanges lifecycle:
//   true  on mount → lets the layout pass complete and the snapshot settle
//   false after 500 ms → frozen native bitmap; no bridge work during zoom
//
// This is safe because SignalMarker uses pure Views (no Text / emoji / fonts).
// Pure Views render synchronously in a single layout pass, so the 500 ms window
// always captures a correct image.  tracksViewChanges=false then keeps it stable
// across all zoom levels — nothing can blank it out.
//
// When isSelected changes, briefly re-enable to capture the updated visual.

function PersistentSignalMarker({
  signal, isSelected, onPress,
}: {
  signal: Signal
  isSelected: boolean
  onPress: () => void
}) {
  const [tracks, setTracks] = useState(true)
  const prevSelected = useRef(isSelected)

  // Initial mount: freeze snapshot after one layout pass (pure Views → instant)
  React.useEffect(() => {
    const t = setTimeout(() => setTracks(false), 500)
    return () => clearTimeout(t)
  }, [])

  // Selection toggle: briefly re-enable to capture selected/deselected visual
  React.useEffect(() => {
    if (prevSelected.current === isSelected) return
    prevSelected.current = isSelected
    setTracks(true)
    const t = setTimeout(() => setTracks(false), 300)
    return () => clearTimeout(t)
  }, [isSelected])

  return (
    <Marker
      coordinate={{ latitude: signal.lat, longitude: signal.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      onPress={onPress}
    >
      <SignalMarker signal={signal} selected={isSelected} />
    </Marker>
  )
}

const clusterStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    backgroundColor: Colors.primary + '1A',
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
  },
  bubble: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 6,
  },
  count: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
})

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Search bar
  searchBarWrapper: {
    position: 'absolute',
    top: SEARCH_TOP,
    left: 12,
    right: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  searchBarFocused: { borderColor: Colors.primary },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  cancelText: { fontSize: 14, color: Colors.secondary, fontWeight: '600' },

  // Filter bar
  filterBarWrapper: {
    position: 'absolute',
    top: FILTER_TOP,
    left: 0,
    right: 0,
  },
  filterBar: { flexGrow: 0 },
  filterBarContent: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  filterLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterLabelActive: { color: '#fff' },

  // Results panel
  resultsPanel: {
    position: 'absolute',
    top: FILTER_TOP,
    left: 12,
    right: 12,
    maxHeight: '60%',
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  resultsList: { paddingVertical: 4 },
  resultsDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 60 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  resultIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  resultInfo: { flex: 1 },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  resultName: { fontSize: 15, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  resultSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  resultSevBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  resultSevText: { fontSize: 10, fontWeight: '700' },

  resultsHint: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 8,
  },
  resultsHintTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  resultsHintSub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Map type toggle pill
  mapTypePill: {
    position: 'absolute',
    top: COUNT_TOP,
    right: 14,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  mapTypeBtn: {
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  mapTypeBtnActive: {
    backgroundColor: Colors.primary,
  },
  mapTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  mapTypeTextActive: {
    color: '#fff',
  },

  // Build Route button
  buildRouteBtn: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  buildRouteBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Signal FAB (stacked above Add Place FAB)
  signalFab: {
    position: 'absolute',
    bottom: 140,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },

  // Add Place FAB
  addPlaceFab: {
    position: 'absolute',
    bottom: 84,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },

  // Add-place mode: crosshair
  crosshairWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 30,
    height: 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 3,
    elevation: 4,
  },
  crosshairV: {
    position: 'absolute',
    width: 2,
    height: 30,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 3,
    elevation: 4,
  },
  crosshairRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  crosshairDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    borderWidth: 2.5,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.7,
    shadowRadius: 3,
    elevation: 6,
  },

  // Add-place mode: confirm banner
  addPlaceBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    gap: 14,
  },
  addPlaceBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addPlaceBannerTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  addPlaceBannerSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  addPlaceBannerActions: { flexDirection: 'row', gap: 10 },
  addPlaceCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addPlaceCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  addPlaceConfirm: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  addPlaceConfirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Locate FAB
  locateBtn: {
    position: 'absolute',
    bottom: 28,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  locateBtnActive: { backgroundColor: Colors.primary + '15' },

  // Reposition banner
  repositionBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    gap: 14,
  },
  repositionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  repositionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  repositionSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  repositionActions: { flexDirection: 'row', gap: 10 },
  repositionCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  repositionCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  repositionSave: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  repositionSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Add Place modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  quickSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  quickHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 12,
  },
  quickTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  quickCoords: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  quickScroll: { flexGrow: 0 },
  quickScrollContent: { gap: 12, paddingBottom: 4 },
  quickInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  quickDescInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  quickTypes: { flexGrow: 0 },
  quickTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginRight: 8,
  },
  quickTypeEmoji: { fontSize: 13 },
  quickTypeText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  quickTypeTextActive: { color: '#fff' },

  // Photos
  photosSection: { gap: 8 },
  photosSectionLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  photosRow: { gap: 8, alignItems: 'center' },
  photoAddBtn: {
    width: 70,
    height: 70,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary + '60',
    borderStyle: 'dashed',
    backgroundColor: Colors.primary + '08',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  photoThumb: { width: 70, height: 70, borderRadius: 10, overflow: 'hidden' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoRemoveBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // Actions row
  quickActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  quickCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickCancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  quickSave: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  quickSaveDisabled: { opacity: 0.45 },
  quickSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Signal posted toast
  signalToast: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  signalToastText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
