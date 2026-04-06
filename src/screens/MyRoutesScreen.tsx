import React from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useAuthStore } from '../store/authStore'
import { usePlacesStore } from '../store/placesStore'
import { useProfileStore } from '../store/profileStore'
import { seedPlaces } from '../data/seedPlaces'
import { UserRoute } from '../types/userRoute'
import { Colors } from '../constants/colors'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MyRoutesScreen() {
  const insets = useSafeAreaInsets()
  const { savedRoutes, deleteRoute, startNewRoute, draftRoute, publishRoute, unpublishRoute, setRouteVisibility } = useRouteBuilderStore()
  const { user } = useAuthStore()
  const { userPlaces } = usePlacesStore()
  const allPlaces = [...seedPlaces, ...userPlaces]

  const handleNewRoute = () => {
    if (draftRoute) {
      Alert.alert(
        'Draft in progress',
        'You have an unsaved route draft. Continue editing it?',
        [
          { text: 'Continue Draft', onPress: () => router.push('/route-builder') },
          {
            text: 'Start Fresh',
            style: 'destructive',
            onPress: () => { startNewRoute(); router.push('/route-builder') },
          },
        ],
      )
    } else {
      startNewRoute()
      router.push('/route-builder')
    }
  }

  const handleDelete = (route: UserRoute) => {
    Alert.alert(
      'Delete Route',
      `Delete "${route.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteRoute(route.id) },
      ],
    )
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
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Routes</Text>
          {savedRoutes.length > 0 && (
            <Text style={styles.headerCount}>{savedRoutes.length} route{savedRoutes.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.addHeaderBtn}
          onPress={handleNewRoute}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Draft banner */}
      {draftRoute && (
        <TouchableOpacity style={styles.draftBanner} onPress={() => router.push('/route-builder')} activeOpacity={0.85}>
          <Ionicons name="pencil" size={16} color={Colors.warning} />
          <Text style={styles.draftBannerText}>
            Draft: {draftRoute.title || 'Untitled Route'} — {draftRoute.stops.length} stop{draftRoute.stops.length !== 1 ? 's' : ''}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.warning} />
        </TouchableOpacity>
      )}

      {savedRoutes.length === 0 ? (
        <EmptyState onNew={handleNewRoute} />
      ) : (
        <FlatList
          data={savedRoutes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <RouteCard
              route={item}
              allPlaces={allPlaces}
              onPress={() => router.push(`/user-route/${item.id}`)}
              onDelete={() => handleDelete(item)}
              onPublish={() => {
                const name = user?.name ?? user?.email?.split('@')[0] ?? 'Anonymous Sailor'
                publishRoute(item.id, name)
              }}
              onUnpublish={() => unpublishRoute(item.id)}
              onToggleVisibility={() => setRouteVisibility(item.id, item.isPublic === false)}
            />
          )}
        />
      )}

      {/* FAB */}
      {savedRoutes.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          onPress={handleNewRoute}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>New Route</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Route card ────────────────────────────────────────────────────────────────

function RouteCard({
  route, allPlaces, onPress, onDelete, onPublish, onUnpublish, onToggleVisibility,
}: {
  route: UserRoute
  allPlaces: { id: string; name: string; region?: string }[]
  onPress: () => void
  onDelete: () => void
  onPublish: () => void
  onUnpublish: () => void
  onToggleVisibility: () => void
}) {
  const [showActions, setShowActions] = React.useState(false)
  const { preferences } = useProfileStore()
  const distLabel = preferences.distanceUnit === 'km'
    ? `${Math.round(route.totalNm * 1.852)} km`
    : `${route.totalNm} nm`

  const firstPlace = allPlaces.find((p) => p.id === route.stops[0]?.placeId)
  const lastPlace  = allPlaces.find((p) => p.id === route.stops[route.stops.length - 1]?.placeId)
  const createdDate = new Date(route.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Status accent */}
      <View style={[styles.cardAccent, { backgroundColor: route.status === 'PUBLISHED' ? Colors.success : Colors.secondary }]} />

      <View style={styles.cardContent}>
        {/* Top row */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardTopLeft}>
            <View style={[styles.statusBadge, { backgroundColor: route.status === 'PUBLISHED' ? Colors.success + '18' : Colors.secondary + '18' }]}>
              <Text style={[styles.statusText, { color: route.status === 'PUBLISHED' ? Colors.success : Colors.secondary }]}>
                {route.status === 'PUBLISHED' ? 'Published' : 'Draft'}
              </Text>
            </View>
            {route.isPublic === false && (
              <View style={styles.privateBadge}>
                <Ionicons name="eye-off-outline" size={11} color={Colors.textMuted} />
                <Text style={styles.privateBadgeText}>Private</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowActions((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.cardTitle} numberOfLines={1}>{route.title}</Text>

        {/* From → To */}
        {firstPlace && lastPlace && firstPlace.id !== lastPlace.id && (
          <View style={styles.routeRow}>
            <Text style={styles.routeFrom} numberOfLines={1}>{firstPlace.name}</Text>
            <Ionicons name="arrow-forward" size={12} color={Colors.textMuted} />
            <Text style={styles.routeTo} numberOfLines={1}>{lastPlace.name}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="location-outline" size={13} color={Colors.primary} />
            <Text style={styles.statText}>{route.stops.length} stops</Text>
          </View>
          {route.totalNm > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="navigate-outline" size={13} color={Colors.primary} />
              <Text style={styles.statText}>{distLabel}</Text>
            </View>
          )}
          {(route.estimatedDays ?? 0) > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
              <Text style={styles.statText}>{route.estimatedDays} days</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          {route.region && <Text style={styles.cardRegion}>{route.region}</Text>}
          <Text style={styles.cardDate}>{createdDate}</Text>
        </View>

        {/* Action menu */}
        {showActions && (
          <View style={styles.actionMenu}>
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => { setShowActions(false); onPress() }}
            >
              <Ionicons name="eye-outline" size={16} color={Colors.secondary} />
              <Text style={styles.actionMenuText}>View Route</Text>
            </TouchableOpacity>
            <View style={styles.actionMenuDivider} />
            {route.status === 'DRAFT' ? (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => { setShowActions(false); onPublish() }}
              >
                <Ionicons name="earth-outline" size={16} color={Colors.success} />
                <Text style={[styles.actionMenuText, { color: Colors.success }]}>Publish to Community</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => { setShowActions(false); onUnpublish() }}
              >
                <Ionicons name="arrow-down-circle-outline" size={16} color={Colors.textSecondary} />
                <Text style={[styles.actionMenuText, { color: Colors.textSecondary }]}>Unpublish</Text>
              </TouchableOpacity>
            )}
            {route.status === 'PUBLISHED' && (
              <>
                <View style={styles.actionMenuDivider} />
                <TouchableOpacity
                  style={styles.actionMenuItem}
                  onPress={() => { setShowActions(false); onToggleVisibility() }}
                >
                  <Ionicons
                    name={route.isPublic === false ? 'eye-outline' : 'eye-off-outline'}
                    size={16}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.actionMenuText}>
                    {route.isPublic === false ? 'Make Public' : 'Make Private'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            <View style={styles.actionMenuDivider} />
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => { setShowActions(false); onDelete() }}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.danger} />
              <Text style={[styles.actionMenuText, { color: Colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="map-outline" size={48} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No routes yet</Text>
      <Text style={styles.emptySubtitle}>
        Plan your next sailing adventure by building a custom route from your favourite places.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onNew} activeOpacity={0.85}>
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Build Your First Route</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  headerCount: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },
  addHeaderBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + '12', alignItems: 'center', justifyContent: 'center',
  },

  draftBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.warning + '15', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.warning + '30',
  },
  draftBannerText: { flex: 1, fontSize: 14, color: Colors.warning, fontWeight: '600' },

  list: { padding: 16, gap: 12 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16, flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: 14, gap: 6 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  privateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.border, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  privateBadgeText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeFrom: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  routeTo: { fontSize: 13, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: Colors.textSecondary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  cardRegion: { fontSize: 12, color: Colors.textMuted },
  cardDate: { fontSize: 12, color: Colors.textMuted },

  // Action menu
  actionMenu: {
    marginTop: 8, backgroundColor: Colors.background,
    borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  actionMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  actionMenuText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  actionMenuDivider: { height: 1, backgroundColor: Colors.border },

  // FAB
  fab: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 28,
    paddingVertical: 14, paddingHorizontal: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border, marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24, marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
