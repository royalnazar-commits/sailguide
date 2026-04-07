/**
 * SavedRoutesScreen — routes the current user has bookmarked.
 *
 * Shows two groups:
 *   1. Community routes saved via the heart/bookmark in RouteViewScreen
 *   2. Curated seed routes saved via the save button on route cards
 */

import React, { useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useRouteInteractionStore } from '../store/routeInteractionStore'
import { SEED_ROUTES } from '../data/seedRoutes'
import { Route } from '../types'
import { UserRoute } from '../types/userRoute'
import { Colors } from '../constants/colors'
import { RouteCard } from '../components/RouteCard'
import { UserRouteCard } from '../components/UserRouteCard'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SavedRoutesScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const userId = user?.id ?? 'anonymous'

  const { savedRoutes: profileSavedIds } = useProfileStore()
  const { getAllPublishedRoutes } = useRouteBuilderStore()
  const allInteractions = useRouteInteractionStore((s) => s.routes)

  // Community routes the user has bookmarked via routeInteractionStore
  const savedCommunityRoutes = useMemo<UserRoute[]>(() => {
    const publishedRoutes = getAllPublishedRoutes()
    return Object.entries(allInteractions)
      .filter(([, data]) => data.savedBy.includes(userId))
      .map(([routeId]) => publishedRoutes.find((r) => r.id === routeId))
      .filter((r): r is UserRoute => r != null)
  }, [allInteractions, userId, getAllPublishedRoutes])

  // Curated seed routes saved via profileStore
  const savedSeedRoutes = useMemo<Route[]>(() => {
    const idSet = new Set(profileSavedIds)
    return SEED_ROUTES.filter((r) => idSet.has(r.id))
  }, [profileSavedIds])

  const totalCount = savedCommunityRoutes.length + savedSeedRoutes.length

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title}>Saved Routes</Text>
          {totalCount > 0 && (
            <Text style={s.subtitle}>{totalCount} saved</Text>
          )}
        </View>
      </View>

      {totalCount === 0 ? (
        <View style={s.empty}>
          <Ionicons name="bookmark-outline" size={52} color={Colors.textMuted} />
          <Text style={s.emptyTitle}>No saved routes</Text>
          <Text style={s.emptySub}>
            Tap the bookmark icon on any route to save it here.
          </Text>
          <TouchableOpacity style={s.exploreBtn} onPress={() => router.push('/(tabs)/catalog' as any)}>
            <Ionicons name="compass-outline" size={16} color="#fff" />
            <Text style={s.exploreBtnText}>Browse Routes</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={() => null}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Community saved routes */}
              {savedCommunityRoutes.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Ionicons name="people-outline" size={15} color={Colors.secondary} />
                    <Text style={s.sectionTitle}>Community Routes</Text>
                    <Text style={s.sectionCount}>{savedCommunityRoutes.length}</Text>
                  </View>
                  {savedCommunityRoutes.map((r) => (
                    <UserRouteCard
                      key={r.id}
                      route={r}
                      isSaved
                      onPress={() => router.push(`/route-view/${r.id}` as any)}
                    />
                  ))}
                </View>
              )}

              {/* Curated seed routes */}
              {savedSeedRoutes.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Ionicons name="shield-checkmark-outline" size={15} color={Colors.primary} />
                    <Text style={s.sectionTitle}>Curated Routes</Text>
                    <Text style={s.sectionCount}>{savedSeedRoutes.length}</Text>
                  </View>
                  {savedSeedRoutes.map((r) => (
                    <RouteCard
                      key={r.id}
                      route={r}
                      showSaveIndicator
                      onPress={() => router.push(`/route/${r.id}`)}
                    />
                  ))}
                </View>
              )}
            </>
          }
        />
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title:    { fontSize: 20, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },

  list: { padding: 16 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.text },
  sectionCount: { fontSize: 12, fontWeight: '700', color: Colors.secondary, backgroundColor: Colors.secondary + '14', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, marginTop: 8 },
  exploreBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
})
