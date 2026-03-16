/**
 * UserRouteDetailScreen — detail view for any UserRoute.
 *
 * Stage 10 changes:
 *  - Uses getRoute(id) to look in both savedRoutes AND SEED_ROUTES
 *  - isOwned = route exists in savedRoutes (user can edit/publish/delete)
 *  - Publish / Unpublish button shown for owned routes
 *  - Creator attribution shown for community routes
 */

import React, { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useAuthStore } from '../store/authStore'
import { usePlacesStore } from '../store/placesStore'
import { useCaptainStore } from '../store/captainStore'
import { seedPlaces } from '../data/seedPlaces'
import { Place } from '../types/place'
import { Colors } from '../constants/colors'
import { PurchaseModal } from '../components/PurchaseModal'
import { SuggestedYachts } from '../components/SuggestedYachts'

const STOP_COLORS = ['#1B6CA8', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#00B4D8', '#F97316']

const STOP_TYPE_COLORS: Record<string, string> = {
  MARINA: '#1B6CA8', ANCHORAGE: '#22C55E', BAY: '#00B4D8',
  BEACH: '#FF7043', LAGOON: '#0891B2', CAVE: '#7C3AED', FUEL: '#F59E0B', CUSTOM: '#64748B',
}

const STOP_TYPE_LABELS: Record<string, string> = {
  MARINA: 'Marina', ANCHORAGE: 'Anchorage', BAY: 'Bay',
  BEACH: 'Beach', LAGOON: 'Lagoon', CAVE: 'Cave', FUEL: 'Fuel stop', CUSTOM: '',
}

export default function UserRouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)

  const { getRoute, savedRoutes, deleteRoute, publishRoute, unpublishRoute, loadRouteAsDraft } = useRouteBuilderStore()
  const { user } = useAuthStore()
  const { userPlaces } = usePlacesStore()
  const { hasAccessToRoute, purchaseItem } = useCaptainStore()
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const allPlaces = [...seedPlaces, ...userPlaces]

  const route = getRoute(id)
  // User owns this route if it's in their savedRoutes
  const isOwned = savedRoutes.some((r) => r.id === id)

  if (!route) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={styles.centerTitle}>Route not found</Text>
        <TouchableOpacity style={styles.backBtn2} onPress={() => router.back()}>
          <Text style={styles.backBtn2Text}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Premium access check — captain's route that the viewer hasn't purchased
  const captainId = route.captainId ?? route.createdBy ?? ''
  const isLocked = !!(route.isPremium && !isOwned && !hasAccessToRoute(route.id, captainId, user?.id))

  // Support both place-backed stops and custom map-tap waypoints (stop.lat / stop.lng)
  const stopItems = route.stops
    .map((stop, i) => {
      const place = allPlaces.find((p) => p.id === stop.placeId)
      const lat = place?.lat ?? stop.lat
      const lng = place?.lng ?? stop.lng
      if (lat == null || lng == null) return null
      return {
        stop,
        place,
        lat,
        lng,
        name: place?.name ?? stop.name ?? `Stop ${i + 1}`,
        location: place
          ? `${place.region} · ${place.country}`
          : `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const polylineCoords = stopItems.map((item) => ({
    latitude: item.lat,
    longitude: item.lng,
  }))

  const handleFitMap = () => {
    if (polylineCoords.length === 0) return
    mapRef.current?.fitToCoordinates(polylineCoords, {
      edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
      animated: true,
    })
  }

  // Edit: load this route as draft and return to the builder
  const handleEdit = () => {
    loadRouteAsDraft(route.id)
    router.replace('/route-builder')
  }

  // Confirm / save: route is already persisted as draft — just go back to routes list
  const handleSave = () => {
    router.replace('/my-routes')
  }

  const handleDelete = () => {
    Alert.alert('Delete Route', `Delete "${route.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { deleteRoute(route.id); router.replace('/my-routes') },
      },
    ])
  }

  const handlePublish = () => {
    Alert.alert(
      'Publish Route',
      'This will make your route visible to all sailors in the community catalog.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: () => {
            const name = user?.name ?? user?.email?.split('@')[0] ?? 'Anonymous Sailor'
            publishRoute(route.id, name)
            Alert.alert('Route Published!', 'Your route is now live in the community catalog.')
          },
        },
      ],
    )
  }

  const handleUnpublish = () => {
    Alert.alert(
      'Unpublish Route',
      'Your route will be removed from the community catalog and reverted to draft.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpublish',
          style: 'destructive',
          onPress: () => { unpublishRoute(route.id) },
        },
      ],
    )
  }

  const createdDate = new Date(route.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const publishedDate = route.publishedAt
    ? new Date(route.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  // Show locked state for premium routes
  if (isLocked) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBackBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{route.title}</Text>
        </View>
        <View style={styles.lockedGate}>
          <View style={styles.lockedIconWrap}>
            <Ionicons name="lock-closed" size={32} color={Colors.warning} />
          </View>
          <Text style={styles.lockedTitle}>Premium Route</Text>
          <Text style={styles.lockedSub}>
            {route.description || `This is a premium route by ${route.createdByName ?? 'a captain'}.`}
          </Text>
          {route.region && (
            <View style={styles.lockedMeta}>
              <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.lockedMetaText}>{route.region} · {route.totalNm} nm</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.lockedBtn}
            onPress={() => setShowPurchaseModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-open-outline" size={18} color="#fff" />
            <Text style={styles.lockedBtnText}>
              {route.priceUsd ? `Unlock for $${route.priceUsd.toFixed(2)}` : 'Get Access'}
            </Text>
          </TouchableOpacity>
        </View>
        <PurchaseModal
          visible={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
          title={`Unlock "${route.title}"`}
          subtitle={route.description ?? `Premium route · ${route.totalNm} nm`}
          priceUsd={route.priceUsd ?? 0}
          confirmLabel={route.priceUsd ? `Buy for $${route.priceUsd.toFixed(2)}` : 'Get Free Access'}
          onConfirm={() => {
            purchaseItem({
              type: 'ROUTE',
              itemId: route.id,
              captainId,
              priceUsd: route.priceUsd ?? 0,
            })
          }}
        />
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{route.title}</Text>
        {isOwned && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleEdit}
              style={styles.editBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="create-outline" size={20} color={Colors.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={styles.confirmBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="checkmark" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Map */}
        <View style={styles.mapWrapper}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={
              polylineCoords.length > 0
                ? {
                    latitude: polylineCoords[0].latitude,
                    longitude: polylineCoords[0].longitude,
                    latitudeDelta: 8,
                    longitudeDelta: 10,
                  }
                : { latitude: 38.8, longitude: 18.5, latitudeDelta: 16, longitudeDelta: 22 }
            }
            onLayout={handleFitMap}
          >
            {polylineCoords.length >= 2 && (
              <Polyline
                coordinates={polylineCoords}
                strokeColor={Colors.primary}
                strokeWidth={2.5}
                lineDashPattern={[6, 4]}
              />
            )}
            {stopItems.map((item, i) => (
              <Marker
                key={item.stop.id}
                coordinate={{ latitude: item.lat, longitude: item.lng }}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[styles.mapPin, { backgroundColor: STOP_COLORS[i % STOP_COLORS.length] }]}>
                  <Text style={styles.mapPinText}>{i + 1}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
          <TouchableOpacity style={styles.fitBtn} onPress={handleFitMap}>
            <Ionicons name="scan-outline" size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill icon="location-outline" value={`${route.stops.length} stops`} />
          {route.totalNm > 0 && <StatPill icon="navigate-outline" value={`${route.totalNm} nm`} />}
          {(route.estimatedDays ?? 0) > 0 && <StatPill icon="calendar-outline" value={`${route.estimatedDays} days`} />}
          <View style={[styles.statusPill, {
            backgroundColor: route.status === 'PUBLISHED' ? Colors.success + '18' : Colors.secondary + '18',
          }]}>
            {route.status === 'PUBLISHED' && (
              <Ionicons name="earth-outline" size={12} color={Colors.success} />
            )}
            <Text style={[styles.statusPillText, {
              color: route.status === 'PUBLISHED' ? Colors.success : Colors.secondary,
            }]}>
              {route.status === 'PUBLISHED' ? 'Published' : 'Draft'}
            </Text>
          </View>
        </View>

        {/* Publish / Unpublish banner (owned routes only) */}
        {isOwned && route.status === 'DRAFT' && (
          <TouchableOpacity style={styles.publishBanner} onPress={handlePublish} activeOpacity={0.85}>
            <Ionicons name="earth-outline" size={20} color="#fff" />
            <View style={styles.publishBannerBody}>
              <Text style={styles.publishBannerTitle}>Publish this route</Text>
              <Text style={styles.publishBannerSub}>Share with the community so other sailors can discover it</Text>
            </View>
            <View style={styles.publishBannerBtn}>
              <Text style={styles.publishBannerBtnText}>Publish</Text>
            </View>
          </TouchableOpacity>
        )}

        {isOwned && route.status === 'PUBLISHED' && (
          <View style={styles.publishedBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.publishedBannerTitle}>Live in the community catalog</Text>
              {publishedDate && (
                <Text style={styles.publishedBannerSub}>Published {publishedDate}</Text>
              )}
            </View>
            <TouchableOpacity onPress={handleUnpublish}>
              <Text style={styles.unpublishLink}>Unpublish</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Creator attribution (community routes) */}
        {!isOwned && route.createdByName && (
          <View style={styles.creatorBanner}>
            <Ionicons name="person-circle-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.creatorText}>Route by {route.createdByName}</Text>
          </View>
        )}

        {/* Description */}
        {route.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About this route</Text>
            <View style={styles.descCard}>
              <Text style={styles.descText}>{route.description}</Text>
            </View>
          </View>
        ) : null}

        {/* Stops */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Stops ({stopItems.length})</Text>
          <View style={styles.stopsList}>
            {stopItems.map((item, i) => {
              const next = stopItems[i + 1]
              let legNm: number | null = null
              if (next) {
                const R = 3440.065
                const dLat = ((next.lat - item.lat) * Math.PI) / 180
                const dLng = ((next.lng - item.lng) * Math.PI) / 180
                const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos((item.lat * Math.PI) / 180) *
                  Math.cos((next.lat * Math.PI) / 180) *
                  Math.sin(dLng / 2) ** 2
                legNm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
              }
              const stopColor = STOP_TYPE_COLORS[item.stop.type ?? 'CUSTOM'] ?? STOP_TYPE_COLORS.CUSTOM
              const stopTypeLabel = STOP_TYPE_LABELS[item.stop.type ?? 'CUSTOM']
              return (
                <View key={item.stop.id} style={styles.stopRow}>
                  <View style={styles.seqCol}>
                    <View style={[styles.seqDot, { backgroundColor: STOP_COLORS[i % STOP_COLORS.length] }]}>
                      <Text style={styles.seqDotText}>{i + 1}</Text>
                    </View>
                    {i < stopItems.length - 1 && <View style={styles.seqLine} />}
                  </View>

                  <TouchableOpacity
                    style={styles.stopCard}
                    onPress={() => item.place ? router.push(`/place/${item.place.id}`) : undefined}
                    activeOpacity={item.place ? 0.85 : 1}
                  >
                    <View style={styles.stopCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stopName}>{item.name}</Text>
                        <Text style={styles.stopLocation}>{item.location}</Text>
                      </View>
                      {item.place && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
                    </View>

                    {/* Type badge (shown when not CUSTOM) */}
                    {item.stop.type && item.stop.type !== 'CUSTOM' && stopTypeLabel && (
                      <View style={[styles.typeBadge, { backgroundColor: stopColor + '18' }]}>
                        <View style={[styles.typeDot, { backgroundColor: stopColor }]} />
                        <Text style={[styles.typeBadgeText, { color: stopColor }]}>{stopTypeLabel}</Text>
                      </View>
                    )}

                    {(item.stop.estimatedStayDays ?? 0) > 0 && (
                      <View style={styles.stayRow}>
                        <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.stayText}>
                          {item.stop.estimatedStayDays} day{item.stop.estimatedStayDays !== 1 ? 's' : ''} stay
                        </Text>
                      </View>
                    )}

                    {item.stop.notes ? (
                      <View style={styles.notesCard}>
                        <Ionicons name="document-text-outline" size={12} color={Colors.warning} />
                        <Text style={styles.notesText} numberOfLines={3}>{item.stop.notes}</Text>
                      </View>
                    ) : null}

                    {legNm !== null && (
                      <View style={styles.legRow}>
                        <Ionicons name="arrow-forward" size={11} color={Colors.textMuted} />
                        <Text style={styles.legText}>{legNm} nm to next stop</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )
            })}
          </View>
        </View>

        {/* Suggested yachts */}
        <SuggestedYachts country={route.country} />

        {/* Meta */}
        <View style={styles.section}>
          <Text style={styles.metaDate}>Created {createdDate}</Text>
        </View>

        {/* Delete — destructive full-width button at the very bottom */}
        {isOwned && (
          <View style={styles.deleteSection}>
            <TouchableOpacity
              style={styles.deleteBtn2}
              onPress={handleDelete}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.deleteBtn2Text}>Delete Route</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon as any} size={13} color={Colors.primary} />
      <Text style={styles.statPillText}>{value}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Premium locked gate
  lockedGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  lockedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F59E0B18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lockedTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  lockedSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  lockedMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedMetaText: { fontSize: 13, color: Colors.textMuted },
  lockedBtn: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  backBtn2: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24, marginTop: 8 },
  backBtn2Text: { color: '#fff', fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBackBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.secondary + '12', alignItems: 'center', justifyContent: 'center',
  },
  confirmBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.danger + '10', alignItems: 'center', justifyContent: 'center',
  },
  deleteSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  deleteBtn2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
  },
  deleteBtn2Text: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  scrollContent: { gap: 0 },

  mapWrapper: { height: 240, position: 'relative' },
  map: { flex: 1 },
  mapPin: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  mapPinText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  fitBtn: {
    position: 'absolute', right: 12, bottom: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },

  statsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary + '12', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  statPillText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  statusPillText: { fontSize: 13, fontWeight: '600' },

  // Publish banner (draft state) — primary CTA
  publishBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.secondary,
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16,
    gap: 12,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 5,
  },
  publishBannerBody: { flex: 1 },
  publishBannerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  publishBannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  publishBannerBtn: {
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  publishBannerBtnText: { fontSize: 14, fontWeight: '700', color: Colors.secondary },

  // Published banner (published state)
  publishedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.success + '10',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.success + '30',
  },
  publishedBannerTitle: { fontSize: 14, fontWeight: '700', color: Colors.success },
  publishedBannerSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  unpublishLink: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  // Creator attribution
  creatorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
  },
  creatorText: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },

  section: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
  },

  descCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  descText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },

  stopsList: { gap: 0 },
  stopRow: { flexDirection: 'row', gap: 12 },
  seqCol: { width: 28, alignItems: 'center', paddingTop: 14 },
  seqDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2,
  },
  seqDotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  seqLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginVertical: 2 },
  stopCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  stopCardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  stopName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  stopLocation: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  stayRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  stayText: { fontSize: 12, color: Colors.textMuted },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 6,
  },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  notesCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: Colors.warning + '10', borderRadius: 8, padding: 8, marginTop: 8,
    borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  notesText: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  legRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  legText: { fontSize: 11, color: Colors.textMuted },

  metaDate: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
})
