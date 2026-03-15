import React, { useRef, useState, useMemo, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform, TextInput, FlatList,
  Keyboard, Modal, KeyboardAvoidingView, Image,
  Alert,
} from 'react-native'
import MapView, { Marker, Region } from 'react-native-maps'
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
import { PlaceMarker } from '../components/PlaceMarker'
import { PlacePopup } from '../components/PlacePopup'
import { Colors } from '../constants/colors'

// Filter + quick-add config imported from central registry

// ── Layout constants ────────────────────────────────────────────────────────

const SEARCH_TOP  = Platform.OS === 'ios' ? 56  : 36
const FILTER_TOP  = SEARCH_TOP  + 52
const COUNT_TOP   = FILTER_TOP  + 46

// ── Initial map region ──────────────────────────────────────────────────────

const INITIAL_REGION: Region = {
  latitude: 43.2, longitude: 16.5,
  latitudeDelta: 5, longitudeDelta: 6,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  const mapRef          = useRef<MapView>(null)
  const searchRef       = useRef<TextInput>(null)
  const currentRegionRef = useRef(INITIAL_REGION)

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

  // ── Reposition mode state ─────────────────────────────────────────────────
  /** The place currently being repositioned (drag mode active) */
  const [repositioningPlace, setRepositioningPlace] = useState<Place | null>(null)
  /** Tracks the dragged coord before the user saves */
  const [repositionCoord, setRepositionCoord] = useState<{ lat: number; lng: number } | null>(null)

  const { userPlaces, addPlace, repositionPlace, localUserId } = usePlacesStore()
  const authUser = useAuthStore((s) => s.user)
  const { draftRoute, startNewRoute }    = useRouteBuilderStore()
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

  // ── Actions ───────────────────────────────────────────────────────────────

  const flyToPlace = useCallback((place: Place) => {
    mapRef.current?.animateToRegion(
      { latitude: place.lat - 1.2, longitude: place.lng, latitudeDelta: 4, longitudeDelta: 5 },
      380,
    )
  }, [])

  const handleMarkerPress = useCallback((place: Place) => {
    if (repositioningPlace) return    // ignore taps while dragging
    setSelectedPlace(place)
    // Pan so the marker appears above the bottom popup, preserving current zoom
    const { latitudeDelta, longitudeDelta } = currentRegionRef.current
    mapRef.current?.animateToRegion(
      {
        latitude: place.lat + latitudeDelta * 0.18,
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
    if (selectedPlace) setSelectedPlace(null)
  }

  const handleBuildRoute = () => {
    if (!draftRoute) startNewRoute()
    router.push('/route-builder')
  }

  const handleLongPress = useCallback((e: any) => {
    if (repositioningPlace) return   // no new-place sheet while dragging
    const { latitude, longitude } = e.nativeEvent.coordinate
    setLongPressCoord({ lat: latitude, lng: longitude })
    setQuickName('')
    setQuickType('ANCHORAGE')
    setQuickDesc('')
    setQuickPhotos([])
  }, [repositioningPlace])

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

  return (
    <View style={styles.container}>

      {/* ── Full-screen map ─────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={(region) => { currentRegionRef.current = region }}
        onPress={handleMapPress}
        onLongPress={handleLongPress}
        showsUserLocation
        showsCompass={false}
        showsScale={false}
        mapType="standard"
      >
        {visiblePlaces.map((place) => {
          const isBeingRepositioned = repositioningPlace?.id === place.id
          const currentLat = isBeingRepositioned ? (repositionCoord?.lat ?? place.lat) : place.lat
          const currentLng = isBeingRepositioned ? (repositionCoord?.lng ?? place.lng) : place.lng

          return (
            <Marker
              key={place.id}
              coordinate={{ latitude: currentLat, longitude: currentLng }}
              onPress={() => handleMarkerPress(place)}
              draggable={isBeingRepositioned}
              onDragEnd={isBeingRepositioned
                ? (e) => setRepositionCoord({
                    lat: e.nativeEvent.coordinate.latitude,
                    lng: e.nativeEvent.coordinate.longitude,
                  })
                : undefined
              }
              tracksViewChanges={isBeingRepositioned}
              anchor={{ x: 0.5, y: 1 }}
            >
              <PlaceMarker type={place.type} selected={selectedPlace?.id === place.id || isBeingRepositioned} isPremium={place.isPremium} />
            </Marker>
          )
        })}
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

      {/* ── Place count pill ─────────────────────────────────────────────── */}
      {!isSearching && !isRepositioning && (
        <View style={styles.countPill} pointerEvents="none">
          <Text style={styles.countText}>
            {visiblePlaces.length} place{visiblePlaces.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* ── Bottom controls ──────────────────────────────────────────────── */}
      {!isSearching && !isRepositioning && (
        <>
          <TouchableOpacity style={styles.buildRouteBtn} onPress={handleBuildRoute} activeOpacity={0.85}>
            <Ionicons name="git-branch-outline" size={16} color="#fff" />
            <Text style={styles.buildRouteBtnText}>
              {draftRoute ? 'Continue Route' : 'Build Route'}
            </Text>
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
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[styles.quickTypeChip, active && { backgroundColor: color, borderColor: color }]}
                      onPress={() => setQuickType(type)}
                    >
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

  // Count pill
  countPill: {
    position: 'absolute',
    top: COUNT_TOP,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },

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
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginRight: 8,
  },
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
})
