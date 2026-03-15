import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { RouteCard } from '../components/RouteCard'
import { SEED_ROUTES } from '../data/seedRoutes'
import { Route } from '../types'
import { Colors } from '../constants/colors'

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesQuery(route: Route, q: string): boolean {
  const s = q.toLowerCase()
  return (
    route.title.toLowerCase().includes(s) ||
    route.description.toLowerCase().includes(s) ||
    route.region.toLowerCase().includes(s) ||
    route.country.toLowerCase().includes(s) ||
    route.tags.some((t) => t.toLowerCase().includes(s))
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

const ALL = 'All'

export default function CatalogScreen() {
  const insets = useSafeAreaInsets()
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState(ALL)

  // Derive regions from available routes
  const regions = useMemo(() => {
    const seen = new Set<string>()
    SEED_ROUTES.forEach((r) => seen.add(r.region))
    return [ALL, ...Array.from(seen).sort()]
  }, [])

  // Filter + search
  const filtered = useMemo(() => {
    let result: Route[] = SEED_ROUTES
    if (region !== ALL) result = result.filter((r) => r.region === region)
    if (search.trim()) result = result.filter((r) => matchesQuery(r, search.trim()))
    return result
  }, [region, search])

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Routes</Text>
            <Text style={styles.subtitle}>{SEED_ROUTES.length} verified sailing routes</Text>
          </View>
          <TouchableOpacity style={styles.myRoutesBtn} onPress={() => router.push('/my-routes')}>
            <Ionicons name="map-outline" size={16} color={Colors.primary} />
            <Text style={styles.myRoutesBtnText}>My Routes</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search routes, regions…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Region chips */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {regions.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, region === r && styles.chipActive]}
              onPress={() => setRegion(r)}
            >
              <Text style={[styles.chipText, region === r && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Route list */}
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          filtered.length > 0 ? (
            <Text style={styles.resultCount}>
              {filtered.length} route{filtered.length !== 1 ? 's' : ''}
              {region !== ALL ? ` in ${region}` : ''}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <RouteCard
            route={item}
            showSaveIndicator
            onPress={() => router.push(`/route/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No routes found</Text>
            <Text style={styles.emptySub}>Try a different search term or region.</Text>
          </View>
        }
      />
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  myRoutesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '12',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  myRoutesBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },

  filterBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  list: { padding: 16 },
  resultCount: { fontSize: 13, color: Colors.textMuted, marginBottom: 4 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
})
