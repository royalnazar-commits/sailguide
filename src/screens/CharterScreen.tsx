import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ScrollView, Image, Dimensions, ActivityIndicator,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BoatCard } from '../components/charter/BoatCard'
import { CharterFilters } from '../components/charter/CharterFilters'
import { useCharterStore, Destination } from '../store/charterStore'
import {
  Yacht, CharterFilters as FilterState,
  BOAT_TYPE_LABELS, BoatType, DEFAULT_FILTERS,
} from '../types/charter'
import { Colors } from '../constants/colors'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

// ── Type tab config ───────────────────────────────────────────────────────────

const TYPE_TABS: Array<{ key: BoatType | 'ALL'; label: string; icon?: any; emoji?: string }> = [
  { key: 'ALL',         label: 'All',       icon: 'grid-outline' },
  { key: 'SAILBOAT',    label: 'Sailboat',  emoji: '⛵' },
  { key: 'CATAMARAN',   label: 'Catamaran', emoji: '⛴' },
  { key: 'MOTOR_YACHT', label: 'Motor',     emoji: '🛥' },
  { key: 'GULET',       label: 'Gulet',     emoji: '⚓' },
]

const TYPE_COLORS: Record<string, string> = {
  SAILBOAT:    '#1B6CA8',
  CATAMARAN:   '#22C55E',
  MOTOR_YACHT: '#C9963A',
  GULET:       '#8B5CF6',
  ALL:         Colors.primary,
}

const INITIAL_REGION = {
  latitude: 38.5,
  longitude: 19.5,
  latitudeDelta: 20,
  longitudeDelta: 28,
}

// ── Screen ────────────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'map'

export default function CharterScreen() {
  const insets = useSafeAreaInsets()

  // ── Store ───────────────────────────────────────────────────────────────────
  const {
    yachts, yachtsLoading, yachtsError, destinations,
    filters, activeType, setFilters, setActiveType,
    getFilteredYachts, loadYachts,
  } = useCharterStore()

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [viewMode, setViewMode]           = useState<ViewMode>('list')
  const [searchText, setSearchText]       = useState('')
  const [filtersOpen, setFiltersOpen]     = useState(false)
  const [selectedMapYacht, setSelectedMapYacht] = useState<Yacht | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)

  // Load fleet on mount
  useEffect(() => { loadYachts() }, [])

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredYachts = useMemo(
    () => getFilteredYachts(searchText),
    [searchText, activeType, filters, yachts],
  )

  // Count active filters (excl. type which is shown separately)
  const activeFilterCount = [
    filters.minCabins > 0,
    filters.maxPricePerWeek < 20000,
    filters.minYear > 2010,
    filters.minRating > 0,
    filters.minLengthM > 0,
  ].filter(Boolean).length

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDestinationPress = (dest: Destination) => {
    setSearchText(dest.country)
    setSearchFocused(false)
  }

  const handleYachtPress = useCallback((id: string) => {
    router.push(`/boat/${id}`)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Yacht Charter</Text>
            <Text style={styles.headerSub}>
              {filteredYachts.length} boat{filteredYachts.length !== 1 ? 's' : ''} available
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.viewToggle, viewMode === 'map' && styles.viewToggleActive]}
              onPress={() => setViewMode((v) => v === 'list' ? 'map' : 'list')}
            >
              <Ionicons
                name={viewMode === 'list' ? 'map-outline' : 'list-outline'}
                size={18}
                color={viewMode === 'map' ? '#fff' : Colors.primary}
              />
              <Text style={[styles.viewToggleText, viewMode === 'map' && { color: '#fff' }]}>
                {viewMode === 'list' ? 'Map' : 'List'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Where do you want to sail?"
              placeholderTextColor={Colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={() => setFiltersOpen(true)}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeFilterCount > 0 ? '#fff' : Colors.primary}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Type filter chips ── */}
      <View style={styles.typeBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeBarContent}
        >
          {TYPE_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.typeChip,
                activeType === tab.key && {
                  backgroundColor: TYPE_COLORS[tab.key],
                  borderColor: TYPE_COLORS[tab.key],
                },
              ]}
              onPress={() => setActiveType(tab.key)}
            >
              {tab.emoji ? (
                <Text style={styles.typeChipEmoji}>{tab.emoji}</Text>
              ) : (
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={activeType === tab.key ? '#fff' : Colors.textSecondary}
                />
              )}
              <Text
                style={[styles.typeChipText, activeType === tab.key && styles.typeChipTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Loading / error ── */}
      {yachtsLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading yachts…</Text>
        </View>
      )}

      {/* ── Main content ── */}
      {viewMode === 'list' ? (
        <FlatList
          data={filteredYachts}
          keyExtractor={(y) => y.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            !searchText ? (
              <DiscoveryHeader
                yachtCount={yachts.length}
                destinations={destinations}
                onDestinationPress={handleDestinationPress}
              />
            ) : (
              <Text style={styles.resultLabel}>
                {filteredYachts.length} boat{filteredYachts.length !== 1 ? 's' : ''} in "{searchText}"
              </Text>
            )
          }
          renderItem={({ item }) => (
            <BoatCard yacht={item} onPress={() => handleYachtPress(item.id)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="boat-outline" size={52} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No yachts found</Text>
              <Text style={styles.emptySub}>Try a different destination or adjust your filters.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => { setSearchText(''); setFilters(DEFAULT_FILTERS); setActiveType('ALL') }}
              >
                <Text style={styles.emptyBtnText}>Clear all filters</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <MapView
          style={styles.map}
          initialRegion={INITIAL_REGION}
          showsUserLocation={false}
        >
          {filteredYachts.map((yacht) => (
            <Marker
              key={yacht.id}
              coordinate={{ latitude: yacht.lat, longitude: yacht.lng }}
              onPress={() => setSelectedMapYacht(yacht)}
            >
              <PriceMarker
                price={yacht.pricePerWeekEur}
                selected={selectedMapYacht?.id === yacht.id}
                type={yacht.type}
              />
            </Marker>
          ))}
        </MapView>
      )}

      {/* ── Map bottom sheet ── */}
      {viewMode === 'map' && selectedMapYacht && (
        <View style={[styles.mapBottomSheet, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.mapSheetClose}
            onPress={() => setSelectedMapYacht(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {filteredYachts.filter((y) => y.id === selectedMapYacht.id || (
              Math.abs(y.lat - selectedMapYacht.lat) < 0.5 &&
              Math.abs(y.lng - selectedMapYacht.lng) < 0.5
            )).map((y) => (
              <BoatCard key={y.id} yacht={y} onPress={() => handleYachtPress(y.id)} compact />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filter panel */}
      <CharterFilters
        visible={filtersOpen}
        filters={filters}
        onApply={(f) => setFilters(f)}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  )
}

// ── Discovery header (shown when search is empty) ─────────────────────────────

function DiscoveryHeader({
  yachtCount,
  destinations,
  onDestinationPress,
}: {
  yachtCount: number
  destinations: Destination[]
  onDestinationPress: (d: Destination) => void
}) {
  return (
    <View style={discovery_styles.container}>
      {/* Banner */}
      <View style={discovery_styles.banner}>
        <Text style={discovery_styles.bannerTag}>✦ SAILING SEASON 2026</Text>
        <Text style={discovery_styles.bannerTitle}>Sail Anywhere,{'\n'}Your Way</Text>
        <Text style={discovery_styles.bannerSub}>
          {yachtCount > 0 ? `${yachtCount} verified yachts · ${destinations.length} destinations` : 'Explore the Mediterranean'}
        </Text>
      </View>

      {/* Featured destinations */}
      <Text style={discovery_styles.sectionTitle}>Popular Destinations</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={discovery_styles.destRow}
      >
        {destinations.map((dest) => (
          <TouchableOpacity
            key={dest.id}
            style={discovery_styles.destCard}
            onPress={() => onDestinationPress(dest)}
            activeOpacity={0.88}
          >
            <Image source={{ uri: dest.image }} style={discovery_styles.destImage} />
            <View style={discovery_styles.destScrim} />
            <View style={discovery_styles.destText}>
              <Text style={discovery_styles.destName}>{dest.name}</Text>
              <Text style={discovery_styles.destSub}>{dest.tagline}</Text>
              <Text style={discovery_styles.destCount}>{dest.boatCount} yachts</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* All yachts label */}
      <Text style={discovery_styles.allLabel}>All Yachts</Text>
    </View>
  )
}

// ── Price marker for map ──────────────────────────────────────────────────────

function PriceMarker({ price, selected, type }: { price: number; selected: boolean; type: string }) {
  const color = TYPE_COLORS[type] ?? Colors.primary
  return (
    <View style={[
      marker_styles.wrapper,
      selected && { transform: [{ scale: 1.15 }] },
    ]}>
      <View style={[marker_styles.pill, { backgroundColor: selected ? Colors.primary : '#fff', borderColor: selected ? Colors.primary : color }]}>
        <Text style={[marker_styles.text, { color: selected ? '#fff' : color }]}>
          €{(price / 1000).toFixed(0)}k
        </Text>
      </View>
      <View style={[marker_styles.tip, { borderTopColor: selected ? Colors.primary : '#fff' }]} />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },

  viewToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
  },
  viewToggleActive: { backgroundColor: Colors.primary },
  viewToggleText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  searchRow: { flexDirection: 'row', gap: 8 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  searchBarFocused: { borderColor: Colors.primary },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },

  filterBtn: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: Colors.primary },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#EF4444', borderRadius: 8,
    width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  typeBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  typeBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 24, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  typeChipEmoji: { fontSize: 14, lineHeight: 18 },
  typeChipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  typeChipTextActive: { color: '#fff' },

  listContent: { paddingHorizontal: 16, paddingTop: 0 },
  resultLabel: { fontSize: 13, color: Colors.textMuted, marginVertical: 10 },

  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: Colors.primary + '10',
  },
  loadingText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8, backgroundColor: Colors.primary + '12',
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10,
  },
  emptyBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },

  map: { flex: 1 },

  mapBottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
  },
  mapSheetClose: {
    position: 'absolute', top: 8, right: 12, zIndex: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
})

const discovery_styles = StyleSheet.create({
  container: { paddingBottom: 4 },
  banner: {
    marginHorizontal: 0,
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: Colors.primary,
    borderRadius: 18, padding: 22,
  },
  bannerTag: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  bannerTitle: { fontSize: 28, fontWeight: '900', color: '#fff', lineHeight: 34, marginBottom: 6 },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 12 },

  destRow: { gap: 12, paddingBottom: 4 },
  destCard: { width: 160, height: 200, borderRadius: 16, overflow: 'hidden' },
  destImage: { width: '100%', height: '100%' },
  destScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, backgroundColor: 'rgba(0,0,0,0.55)' },
  destText: { position: 'absolute', bottom: 12, left: 12, right: 8 },
  destName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  destSub: { fontSize: 11, color: 'rgba(255,255,255,0.80)', marginTop: 2 },
  destCount: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  allLabel: { fontSize: 16, fontWeight: '800', color: Colors.text, marginTop: 20, marginBottom: 4 },
})

const marker_styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  pill: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 4, elevation: 4,
  },
  text: { fontSize: 12, fontWeight: '800' },
  tip: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
})
