import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Place } from '../types/place'
import { seedPlaces } from '../data/seedPlaces'
import { getPlaceTypeMeta } from '../constants/placeTypes'
import { usePlacesStore } from '../store/placesStore'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { Colors } from '../constants/colors'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PlacePickerScreen() {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const { userPlaces } = usePlacesStore()
  const { draftRoute, addStop } = useRouteBuilderStore()

  const allPlaces = useMemo(() => [...seedPlaces, ...userPlaces], [userPlaces])

  const filtered = useMemo(() => {
    if (!query.trim()) return allPlaces
    const q = query.toLowerCase()
    return allPlaces.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.region.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q),
    )
  }, [allPlaces, query])

  const alreadyAdded = useMemo(
    () => new Set(draftRoute?.stops.map((s) => s.placeId) ?? []),
    [draftRoute],
  )

  const getCoords = (id: string) => {
    const p = allPlaces.find((pl) => pl.id === id)
    return p ? { lat: p.lat, lng: p.lng, region: p.region, country: p.country } : null
  }

  const handleAdd = (place: Place) => {
    addStop(place.id, getCoords)
    router.back()
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Stop</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search places, regions…"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No places found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = getPlaceTypeMeta(item.type)
          const added = alreadyAdded.has(item.id)
          return (
            <TouchableOpacity
              style={[styles.row, added && styles.rowAdded]}
              onPress={() => !added && handleAdd(item)}
              activeOpacity={added ? 1 : 0.75}
            >
              {/* Type icon circle */}
              <View style={[styles.iconCircle, { backgroundColor: meta.color + '18' }]}>
                <Ionicons name={meta.icon as any} size={18} color={meta.color} />
              </View>

              {/* Info */}
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowSub}>{item.region} · {item.country}</Text>
              </View>

              {/* Action */}
              {added ? (
                <View style={styles.addedPill}>
                  <Ionicons name="checkmark" size={12} color={Colors.success} />
                  <Text style={styles.addedText}>Added</Text>
                </View>
              ) : (
                <View style={styles.addBtn}>
                  <Ionicons name="add" size={18} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },

  list: { paddingHorizontal: 16, gap: 8 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  rowAdded: { opacity: 0.6 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  addedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.success + '15', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  addedText: { fontSize: 12, color: Colors.success, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: Colors.textMuted },
})
