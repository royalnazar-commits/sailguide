import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, Animated,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { RouteCard } from '../components/RouteCard'
import { UserRouteCard } from '../components/UserRouteCard'
import { SEED_ROUTES } from '../data/seedRoutes'
import { Route } from '../types'
import { Colors } from '../constants/colors'
import { useAuthStore } from '../store/authStore'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useRouteInteractionStore } from '../store/routeInteractionStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode            = 'curated' | 'community'
type CommunityFilter = 'all' | 'trending' | 'new'

const COMMUNITY_FILTERS: { key: CommunityFilter; label: string; icon: string }[] = [
  { key: 'all',      label: 'Latest',   icon: 'compass-outline' },
  { key: 'trending', label: 'Trending', icon: 'flame-outline'   },
  { key: 'new',      label: 'New',      icon: 'time-outline'    },
]

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

const ALL = 'All'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const insets = useSafeAreaInsets()

  const [mode,            setMode]            = useState<Mode>('curated')
  const [search,          setSearch]          = useState('')
  const [region,          setRegion]          = useState(ALL)
  const [communityFilter, setCommunityFilter] = useState<CommunityFilter>('all')

  const userId           = useAuthStore((s) => s.user?.id ?? 'anonymous')
  const { savedRoutes }  = useRouteBuilderStore()
  const allInteractions  = useRouteInteractionStore((s) => s.routes)

  // ── Community data ─────────────────────────────────────────────────────────

  const communityRoutes = useMemo(
    () => savedRoutes.filter((r) => r.status === 'PUBLISHED' && r.isPublic !== false),
    [savedRoutes],
  )

  const trendingRoutes = useMemo(() => communityRoutes
    .map((r) => {
      const d = allInteractions[r.id] ?? { ratings: {} as Record<string, number>, saveCount: 0 }
      const ratingVals = Object.values(d.ratings ?? {})
      const ratingScore = ratingVals.length > 0
        ? (ratingVals.reduce((s, v) => s + v, 0) / ratingVals.length) * ratingVals.length
        : 0
      return { route: r, score: ratingScore + (d.saveCount ?? 0) * 2 }
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.route),
    [communityRoutes, allInteractions],
  )

  const newRoutes = useMemo(() =>
    [...communityRoutes].sort((a, b) => {
      const da = new Date((a.publishedAt ?? a.createdAt) || 0).getTime()
      const db = new Date((b.publishedAt ?? b.createdAt) || 0).getTime()
      return db - da
    }),
    [communityRoutes],
  )

  const activeCommunityRoutes = useMemo(() => {
    if (communityFilter === 'trending') return trendingRoutes
    if (communityFilter === 'new')      return newRoutes
    return newRoutes
  }, [communityFilter, trendingRoutes, newRoutes])

  // ── Curated data ───────────────────────────────────────────────────────────

  const regions = useMemo(() => {
    const seen = new Set<string>()
    SEED_ROUTES.forEach((r) => seen.add(r.region))
    return [ALL, ...Array.from(seen).sort()]
  }, [])

  const filteredCurated = useMemo(() => {
    let result: Route[] = SEED_ROUTES
    if (region !== ALL) result = result.filter((r) => r.region === region)
    if (search.trim())  result = result.filter((r) => matchesQuery(r, search.trim()))
    return result
  }, [region, search])

  // ── Mode switch with fade animation ────────────────────────────────────────

  const feedOpacity = useRef(new Animated.Value(1)).current

  const switchMode = (next: Mode) => {
    if (next === mode) return
    Animated.sequence([
      Animated.timing(feedOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(feedOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
    setMode(next)
    // Reset sub-filters when switching
    setSearch('')
    setRegion(ALL)
    setCommunityFilter('all')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ════════════════════ STICKY HEADER ════════════════════ */}
      <View style={styles.stickyHeader}>

        {/* Title row */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Routes</Text>
            <Text style={styles.subtitle}>
              {mode === 'curated'
                ? `${SEED_ROUTES.length} verified routes`
                : `${communityRoutes.length} community route${communityRoutes.length !== 1 ? 's' : ''}`}
            </Text>
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
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Region chips — curated only */}
        {mode === 'curated' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
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
        )}

        {/* ── Mode switcher ── */}
        <View style={styles.modeSwitcher}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'curated' && styles.modeBtnActive]}
            onPress={() => switchMode('curated')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={14}
              color={mode === 'curated' ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.modeBtnText, mode === 'curated' && styles.modeBtnTextActive]}>
              Curated Routes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, mode === 'community' && styles.modeBtnActive]}
            onPress={() => switchMode('community')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="people-outline"
              size={14}
              color={mode === 'community' ? Colors.secondary : Colors.textMuted}
            />
            <Text style={[
              styles.modeBtnText,
              mode === 'community' && styles.modeBtnTextActiveCommunity,
            ]}>
              From the Community
            </Text>
            {communityRoutes.length > 0 && (
              <View style={[
                styles.modeBadge,
                mode === 'community' ? styles.modeBadgeActive : styles.modeBadgeInactive,
              ]}>
                <Text style={[
                  styles.modeBadgeText,
                  mode === 'community' && styles.modeBadgeTextActive,
                ]}>
                  {communityRoutes.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Community sub-filters — only when community mode is active */}
        {mode === 'community' && (
          <View style={styles.communityFilterBar}>
            {COMMUNITY_FILTERS.map(({ key, label, icon }) => {
              const active = communityFilter === key
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.communityFilterTab, active && styles.communityFilterTabActive]}
                  onPress={() => setCommunityFilter(key)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={icon as any}
                    size={13}
                    color={active ? Colors.secondary : Colors.textMuted}
                  />
                  <Text style={[styles.communityFilterText, active && styles.communityFilterTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </View>
      {/* ══════════════════ END STICKY HEADER ══════════════════ */}

      {/* ════════════════════ FEED (scrollable) ════════════════════ */}
      <Animated.ScrollView
        style={[styles.feed, { opacity: feedOpacity }]}
        contentContainerStyle={[styles.feedContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── CURATED FEED ── */}
        {mode === 'curated' && (
          filteredCurated.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No routes found</Text>
              <Text style={styles.emptySub}>Try a different search or region.</Text>
            </View>
          ) : (
            filteredCurated.map((item) => (
              <RouteCard
                key={item.id}
                route={item}
                showSaveIndicator
                onPress={() => router.push(`/route/${item.id}`)}
              />
            ))
          )
        )}

        {/* ── COMMUNITY FEED ── */}
        {mode === 'community' && (
          communityRoutes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No community routes yet</Text>
              <Text style={styles.emptySub}>
                Be the first to publish a route and share it with other sailors.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/route-builder' as any)}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Build a Route</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeCommunityRoutes.map((r, i) => (
              <UserRouteCard
                key={r.id}
                route={r}
                rank={communityFilter === 'trending' ? i + 1 : undefined}
                isSaved={allInteractions[r.id]?.savedBy.includes(userId) ?? false}
                onPress={() => router.push(`/route-view/${r.id}` as any)}
              />
            ))
          )
        )}
      </Animated.ScrollView>
      {/* ═══════════════════ END FEED ═══════════════════════════ */}

    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  // ── Sticky header block ──────────────────────────────────────────────────────
  stickyHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    // subtle shadow so it lifts above the scrolling feed
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 4,
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
  },
  title:    { fontSize: 22, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  myRoutesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary + '12',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  myRoutesBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Search bar
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
    marginHorizontal: 16, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },

  // Region chips
  chipsContent: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // ── Mode switcher ─────────────────────────────────────────────────────────────
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    margin: 12,
    marginTop: 4,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 11,
  },
  modeBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  modeBtnText: {
    fontSize: 13, fontWeight: '600', color: Colors.textMuted,
  },
  modeBtnTextActive: {
    color: Colors.primary, fontWeight: '700',
  },
  modeBtnTextActiveCommunity: {
    color: Colors.secondary, fontWeight: '700',
  },

  // Count badge inside mode button
  modeBadge: {
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1,
    minWidth: 18, alignItems: 'center',
  },
  modeBadgeActive:   { backgroundColor: Colors.secondary + '18' },
  modeBadgeInactive: { backgroundColor: Colors.textMuted + '18' },
  modeBadgeText:     { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  modeBadgeTextActive: { color: Colors.secondary },

  // ── Community sub-filter tabs ─────────────────────────────────────────────────
  communityFilterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12, paddingBottom: 10,
    gap: 6,
  },
  communityFilterTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 7, borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  communityFilterTabActive: {
    backgroundColor: Colors.secondary + '0E',
    borderColor: Colors.secondary + '40',
  },
  communityFilterText:       { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  communityFilterTextActive: { fontSize: 12, fontWeight: '700', color: Colors.secondary },

  // ── Feed ──────────────────────────────────────────────────────────────────────
  feed:        { flex: 1 },
  feedContent: { padding: 16 },

  // Empty states
  emptyState: { alignItems: 'center', paddingTop: 72, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 20, marginTop: 6,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
