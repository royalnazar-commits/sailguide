import React, { useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useRouteInteractionStore } from '../store/routeInteractionStore'
import { RouteCard } from '../components/RouteCard'
import { UserRouteCard } from '../components/UserRouteCard'
import { SEED_ROUTES } from '../data/seedRoutes'
import { UserRoute } from '../types/userRoute'
import { Colors } from '../constants/colors'

export default function MyTripsScreen() {
  const insets  = useSafeAreaInsets()
  const { user } = useAuthStore()
  const userId   = user?.id ?? 'anonymous'

  // Curated routes saved via profileStore (seed route IDs)
  const { savedRoutes: profileSavedIds } = useProfileStore()
  const savedSeedRoutes = useMemo(
    () => SEED_ROUTES.filter((r) => profileSavedIds.includes(r.id)),
    [profileSavedIds],
  )

  // Community routes saved via routeInteractionStore
  const { getAllPublishedRoutes } = useRouteBuilderStore()
  const allInteractions           = useRouteInteractionStore((s) => s.routes)

  const savedCommunityRoutes = useMemo<UserRoute[]>(() => {
    const published = getAllPublishedRoutes()
    return Object.entries(allInteractions)
      .filter(([, data]) => data.savedBy.includes(userId))
      .map(([routeId]) => published.find((r) => r.id === routeId))
      .filter((r): r is UserRoute => r != null)
  }, [allInteractions, userId, getAllPublishedRoutes])

  const totalCount = savedSeedRoutes.length + savedCommunityRoutes.length

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Trips</Text>
          <Text style={styles.subtitle}>
            {totalCount} saved route{totalCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)/catalog')}>
          <Ionicons name="search-outline" size={16} color={Colors.primary} />
          <Text style={styles.browseBtnText}>Browse Routes</Text>
        </TouchableOpacity>
      </View>

      {totalCount === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bookmark-outline" size={48} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No saved routes yet</Text>
          <Text style={styles.emptySub}>
            Browse routes and tap the bookmark icon to save them here.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/catalog')}>
            <Ionicons name="list-outline" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>Browse Routes</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Community saved routes */}
          {savedCommunityRoutes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="people-outline" size={15} color={Colors.secondary} />
                <Text style={styles.sectionTitle}>Community Routes</Text>
                <View style={styles.sectionBadge}>
                  <Text style={styles.sectionBadgeText}>{savedCommunityRoutes.length}</Text>
                </View>
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

          {/* Curated (seed) saved routes */}
          {savedSeedRoutes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="shield-checkmark-outline" size={15} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Curated Routes</Text>
                <View style={[styles.sectionBadge, styles.sectionBadgePrimary]}>
                  <Text style={[styles.sectionBadgeText, styles.sectionBadgeTextPrimary]}>
                    {savedSeedRoutes.length}
                  </Text>
                </View>
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
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title:    { fontSize: 24, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  browseBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary + '12',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  browseBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  list: { padding: 16 },

  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12,
  },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.text },
  sectionBadge: {
    backgroundColor: Colors.secondary + '14',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  sectionBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.secondary },
  sectionBadgePrimary: { backgroundColor: Colors.primary + '12' },
  sectionBadgeTextPrimary: { color: Colors.primary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptySub:   { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24, marginTop: 4,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
