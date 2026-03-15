import React, { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Place } from '../types/place'
import { getPlaceTypeMeta } from '../constants/placeTypes'
import { usePlacesStore } from '../store/placesStore'
import { useAuthStore } from '../store/authStore'
import { useCommentsStore } from '../store/commentsStore'
import { Colors } from '../constants/colors'

// ── Screen ─────────────────────────────────────────────────────────────────

export default function MyPlacesScreen() {
  const insets = useSafeAreaInsets()
  const { userPlaces, deletePlace, localUserId } = usePlacesStore()
  const authUser = useAuthStore((s) => s.user)
  const currentUserId = authUser?.id ?? localUserId
  const currentRole   = authUser?.role

  const handleDelete = (place: Place) => {
    Alert.alert(
      'Delete Place',
      `Remove "${place.name}" from your places? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePlace(place.id, currentUserId, currentRole),
        },
      ],
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Places</Text>
          {userPlaces.length > 0 && (
            <Text style={styles.headerCount}>{userPlaces.length} place{userPlaces.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.addHeaderBtn}
          onPress={() => router.push('/create-place')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {userPlaces.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={userPlaces}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PlaceCard
              place={item}
              onPress={() => router.push(`/place/${item.id}`)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* ── FAB ───────────────────────────────────────────────────── */}
      {userPlaces.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 24 }]}
          onPress={() => router.push('/create-place')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color="#fff" />
          <Text style={styles.fabText}>Add Place</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Place card ─────────────────────────────────────────────────────────────

function PlaceCard({
  place, onPress, onDelete,
}: { place: Place; onPress: () => void; onDelete: () => void }) {
  const meta = getPlaceTypeMeta(place.type)
  const [showActions, setShowActions] = useState(false)
  const { getCommentsForPlace } = useCommentsStore()
  const commentCount = getCommentsForPlace(place.id).length
  const createdDate = place.createdAt
    ? new Date(place.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Left accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: meta.color }]} />

      <View style={styles.cardContent}>
        {/* Top row: type badge + kebab */}
        <View style={styles.cardTopRow}>
          <View style={[styles.typeBadge, { backgroundColor: meta.color + '18' }]}>
            <Ionicons name={meta.icon as any} size={12} color={meta.color} />
            <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowActions((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Name */}
        <Text style={styles.cardName} numberOfLines={1}>{place.name}</Text>

        {/* Location */}
        <View style={styles.cardLocationRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.cardLocation}>{place.region} · {place.country}</Text>
        </View>

        {/* Description preview */}
        <Text style={styles.cardDesc} numberOfLines={2}>{place.description}</Text>

        {/* Footer: tags + comment count + date */}
        <View style={styles.cardFooter}>
          <View style={styles.cardTags}>
            {(place.tags ?? []).slice(0, 2).map((tag) => (
              <View key={tag} style={styles.cardTag}>
                <Text style={styles.cardTagText}>#{tag}</Text>
              </View>
            ))}
          </View>
          <View style={styles.cardMeta}>
            {commentCount > 0 && (
              <View style={styles.cardCommentPill}>
                <Ionicons name="chatbubble-outline" size={11} color={Colors.secondary} />
                <Text style={styles.cardCommentText}>{commentCount}</Text>
              </View>
            )}
            {createdDate && <Text style={styles.cardDate}>{createdDate}</Text>}
          </View>
        </View>

        {/* Inline action menu */}
        {showActions && (
          <View style={styles.actionMenu}>
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowActions(false)
                onPress()
              }}
            >
              <Ionicons name="eye-outline" size={16} color={Colors.secondary} />
              <Text style={styles.actionMenuText}>View Details</Text>
            </TouchableOpacity>
            <View style={styles.actionMenuDivider} />
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowActions(false)
                onDelete()
              }}
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

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name="map-outline" size={48} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No places yet</Text>
      <Text style={styles.emptySubtitle}>
        Start adding your favourite anchorages, marinas, and points of interest. They'll appear on the Explore map instantly.
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => router.push('/create-place')}
        activeOpacity={0.85}
      >
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Add Your First Place</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
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

  // List
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
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  typeLabel: { fontSize: 12, fontWeight: '600' },
  cardName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardLocation: { fontSize: 13, color: Colors.textSecondary },
  cardDesc: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardTags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  cardTag: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  cardTagText: { fontSize: 11, color: Colors.secondary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardCommentPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardCommentText: { fontSize: 11, color: Colors.secondary, fontWeight: '600' },
  cardDate: { fontSize: 11, color: Colors.textMuted },

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

  // Empty state
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 14,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptySubtitle: {
    fontSize: 14, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24, marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
