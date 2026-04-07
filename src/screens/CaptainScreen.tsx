import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCaptainStore } from '../store/captainStore'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { usePlacesStore } from '../store/placesStore'
import { useAuthStore } from '../store/authStore'
import { useSocialStore } from '../store/socialStore'
import { useProfileStore } from '../store/profileStore'
import { PurchaseModal } from '../components/PurchaseModal'
import { Colors } from '../constants/colors'
import { UserRoute } from '../types/userRoute'
import { Place } from '../types/place'

// ── Public Captain Profile ────────────────────────────────────────────────────

export default function CaptainScreen() {
  const insets = useSafeAreaInsets()
  const { id: captainId } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const { captainSettings, purchaseItem, isSubscribedTo, hasAccessToRoute, hasAccessToPlace } = useCaptainStore()
  const { savedRoutes } = useRouteBuilderStore()
  const { userPlaces } = usePlacesStore()

  const [purchaseTarget, setPurchaseTarget] = useState<{
    type: 'ROUTE' | 'PLACE' | 'SUBSCRIPTION'
    itemId: string
    title: string
    subtitle: string
    price: number
  } | null>(null)

  const viewerId = user?.id
  const { isFollowing, followUser, unfollowUser } = useSocialStore()
  const { savedRoutes: savedRouteIds, toggleSaveRoute } = useProfileStore()
  const following = isFollowing(captainId ?? '')

  // Captain's published routes
  const captainRoutes = useMemo(
    () => savedRoutes.filter((r) => r.createdBy === captainId && r.status === 'PUBLISHED'),
    [savedRoutes, captainId],
  )

  // Captain's places
  const captainPlaces = useMemo(
    () => userPlaces.filter((p) => p.createdBy === captainId),
    [userPlaces, captainId],
  )

  // Derive captain display info from their first published route / place
  const captainName = captainRoutes[0]?.createdByName ?? captainPlaces[0]?.createdBy ?? `Captain ${captainId?.slice(0, 6)}`
  const isSubscribed = isSubscribedTo(captainId ?? '')
  const isOwnProfile = viewerId === captainId

  const handleSubscribe = () => {
    if (!captainSettings.subscriptionEnabled) return
    if (isSubscribed) {
      Alert.alert('Already subscribed', `You already have access to all of ${captainName}'s premium content.`)
      return
    }
    setPurchaseTarget({
      type: 'SUBSCRIPTION',
      itemId: captainId ?? '',
      title: `Subscribe to ${captainName}`,
      subtitle: `Get unlimited access to all of ${captainName}'s premium routes and places.`,
      price: captainSettings.subscriptionPriceUsd,
    })
  }

  const handleBuyRoute = (route: UserRoute) => {
    const hasAccess = hasAccessToRoute(route.id, captainId ?? '', viewerId)
    if (hasAccess) {
      router.push(`/user-route/${route.id}`)
      return
    }
    setPurchaseTarget({
      type: 'ROUTE',
      itemId: route.id,
      title: route.title,
      subtitle: route.description ?? `Premium route by ${captainName}`,
      price: route.priceUsd ?? 0,
    })
  }

  const handleBuyPlace = (place: Place) => {
    const hasAccess = hasAccessToPlace(place.id, captainId ?? '', viewerId)
    if (hasAccess) {
      router.push(`/place/${place.id}`)
      return
    }
    setPurchaseTarget({
      type: 'PLACE',
      itemId: place.id,
      title: place.name,
      subtitle: place.description,
      price: place.priceUsd ?? 0,
    })
  }

  const handleConfirmPurchase = () => {
    if (!purchaseTarget) return
    purchaseItem({
      type: purchaseTarget.type,
      itemId: purchaseTarget.itemId,
      captainId: captainId ?? '',
      priceUsd: purchaseTarget.price,
    })
    Alert.alert(
      purchaseTarget.type === 'SUBSCRIPTION' ? 'Subscribed!' : 'Unlocked!',
      purchaseTarget.type === 'SUBSCRIPTION'
        ? `You now have access to all of ${captainName}'s premium content.`
        : `"${purchaseTarget.title}" is now unlocked.`,
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Captain Profile</Text>
        {isOwnProfile ? (
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/captain-dashboard')}>
            <Ionicons name="settings-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.followBtn, following && styles.followingBtn]}
            onPress={() => following ? unfollowUser(captainId ?? '') : followUser(captainId ?? '')}
            activeOpacity={0.8}
          >
            <Ionicons name={following ? 'checkmark' : 'add'} size={14} color={following ? Colors.secondary : '#fff'} />
            <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Captain header card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={32} color={Colors.secondary} />
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.captainName}>{captainName}</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color={Colors.verified} />
                <Text style={styles.verifiedText}>Captain</Text>
              </View>
            </View>
            <View style={styles.countsRow}>
              <Text style={styles.countItem}>
                <Text style={styles.countValue}>{captainRoutes.length}</Text>
                {' routes'}
              </Text>
              <Text style={styles.countDot}>·</Text>
              <Text style={styles.countItem}>
                <Text style={styles.countValue}>{captainPlaces.length}</Text>
                {' places'}
              </Text>
            </View>
          </View>
        </View>

        {/* Subscribe banner */}
        {captainSettings.subscriptionEnabled && !isOwnProfile && (
          <TouchableOpacity
            style={[styles.subscribeCard, isSubscribed && styles.subscribedCard]}
            onPress={handleSubscribe}
            activeOpacity={0.85}
          >
            <View style={styles.subscribeLeft}>
              <Ionicons
                name={isSubscribed ? 'checkmark-circle' : 'star'}
                size={22}
                color={isSubscribed ? Colors.success : '#fff'}
              />
              <View>
                <Text style={[styles.subscribeTitle, isSubscribed && styles.subscribedTitle]}>
                  {isSubscribed ? 'Subscribed' : `Subscribe to ${captainName}`}
                </Text>
                <Text style={[styles.subscribeSub, isSubscribed && styles.subscribedSub]}>
                  {isSubscribed
                    ? 'You have access to all premium content'
                    : `$${captainSettings.subscriptionPriceUsd.toFixed(2)}/month · Unlock all premium content`}
                </Text>
              </View>
            </View>
            {!isSubscribed && (
              <View style={styles.subscribePricePill}>
                <Text style={styles.subscribePriceText}>
                  ${captainSettings.subscriptionPriceUsd.toFixed(2)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Routes */}
        <SectionHeader title="Routes" icon="map-outline" count={captainRoutes.length} />

        {captainRoutes.length === 0 ? (
          <EmptySection message="No published routes yet." />
        ) : (
          captainRoutes.map((route) => {
            const locked = !!(route.isPremium && !hasAccessToRoute(route.id, captainId ?? '', viewerId))
            return (
              <RouteCard
                key={route.id}
                route={route}
                locked={locked}
                isSaved={savedRouteIds.includes(route.id)}
                onPress={() => handleBuyRoute(route)}
                onSave={() => toggleSaveRoute(route.id)}
              />
            )
          })
        )}

        {/* Places */}
        <SectionHeader title="Places" icon="location-outline" count={captainPlaces.length} />

        {captainPlaces.length === 0 ? (
          <EmptySection message="No places shared yet." />
        ) : (
          captainPlaces.map((place) => {
            const locked = !!(place.isPremium && !hasAccessToPlace(place.id, captainId ?? '', viewerId))
            return (
              <PlaceCard
                key={place.id}
                place={place}
                locked={locked}
                onPress={() => handleBuyPlace(place)}
              />
            )
          })
        )}
      </ScrollView>

      {/* Purchase modal */}
      {purchaseTarget && (
        <PurchaseModal
          visible
          onClose={() => setPurchaseTarget(null)}
          title={
            purchaseTarget.type === 'SUBSCRIPTION'
              ? `Subscribe to ${captainName}`
              : `Unlock "${purchaseTarget.title}"`
          }
          subtitle={purchaseTarget.subtitle}
          priceUsd={purchaseTarget.price}
          confirmLabel={
            purchaseTarget.type === 'SUBSCRIPTION'
              ? `Subscribe · $${purchaseTarget.price.toFixed(2)}/month`
              : purchaseTarget.price === 0
              ? 'Get Free Access'
              : `Buy for $${purchaseTarget.price.toFixed(2)}`
          }
          onConfirm={handleConfirmPurchase}
        />
      )}
    </View>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, icon, count }: { title: string; icon: any; count: number }) {
  return (
    <View style={secStyles.row}>
      <Ionicons name={icon} size={15} color={Colors.secondary} />
      <Text style={secStyles.title}>{title}</Text>
      <View style={secStyles.countPill}>
        <Text style={secStyles.countText}>{count}</Text>
      </View>
    </View>
  )
}

function EmptySection({ message }: { message: string }) {
  return (
    <View style={styles.emptySection}>
      <Text style={styles.emptySectionText}>{message}</Text>
    </View>
  )
}

function RouteCard({
  route,
  locked,
  isSaved,
  onPress,
  onSave,
}: {
  route: UserRoute
  locked: boolean
  isSaved: boolean
  onPress: () => void
  onSave: () => void
}) {
  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.itemIconWrap}>
        <Ionicons name="map-outline" size={20} color={Colors.primary} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={1}>{route.title}</Text>
        <Text style={styles.itemSub} numberOfLines={2}>{route.description}</Text>
        <View style={styles.itemMeta}>
          {route.region && (
            <View style={styles.metaChip}>
              <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.metaChipText}>{route.region}</Text>
            </View>
          )}
          {route.totalNm > 0 && (
            <View style={styles.metaChip}>
              <Ionicons name="navigate-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.metaChipText}>{route.totalNm} nm</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.itemRight}>
        {locked ? (
          <View style={styles.lockPill}>
            <Ionicons name="lock-closed" size={12} color={Colors.warning} />
            <Text style={styles.lockPillText}>${route.priceUsd?.toFixed(2)}</Text>
          </View>
        ) : (
          <View style={styles.freePill}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
            <Text style={styles.freePillText}>{route.priceUsd ? 'Owned' : 'Free'}</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onSave() }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={isSaved ? Colors.secondary : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

function PlaceCard({
  place,
  locked,
  onPress,
}: {
  place: Place
  locked: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.88}>
      <View style={[styles.itemIconWrap, { backgroundColor: '#00B4D810' }]}>
        <Ionicons name="location-outline" size={20} color="#00B4D8" />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle} numberOfLines={1}>{place.name}</Text>
        <Text style={styles.itemSub} numberOfLines={2}>{place.description}</Text>
        <View style={styles.itemMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.metaChipText}>{place.region}</Text>
          </View>
        </View>
      </View>
      <View style={styles.itemRight}>
        {locked ? (
          <View style={styles.lockPill}>
            <Ionicons name="lock-closed" size={12} color={Colors.warning} />
            <Text style={styles.lockPillText}>${place.priceUsd?.toFixed(2)}</Text>
          </View>
        ) : (
          <View style={styles.freePill}>
            <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
            <Text style={styles.freePillText}>{place.priceUsd ? 'Owned' : 'Free'}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn: {},
  topBarTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
  editBtn: { padding: 4 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.secondary,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  followingBtn: {
    backgroundColor: Colors.secondary + '12',
    borderWidth: 1.5, borderColor: Colors.secondary,
  },
  followBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: Colors.secondary },

  content: { padding: 16, gap: 12 },

  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  captainName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.verified + '15',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 11, fontWeight: '600', color: Colors.verified },
  countsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countItem: { fontSize: 13, color: Colors.textSecondary },
  countValue: { fontWeight: '700', color: Colors.text },
  countDot: { color: Colors.textMuted, marginHorizontal: 4 },

  subscribeCard: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscribedCard: { backgroundColor: Colors.success + '18', borderWidth: 1.5, borderColor: Colors.success + '40' },
  subscribeLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  subscribeTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  subscribedTitle: { color: Colors.success },
  subscribeSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  subscribedSub: { color: Colors.success },
  subscribePricePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subscribePriceText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  emptySection: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  emptySectionText: { fontSize: 14, color: Colors.textMuted },

  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  itemSub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 6 },
  itemMeta: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.background,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaChipText: { fontSize: 11, color: Colors.textMuted },
  itemRight: { alignItems: 'center', gap: 6, flexShrink: 0 },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.warning + '18',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lockPillText: { fontSize: 12, fontWeight: '700', color: Colors.warning },
  freePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.success + '18',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  freePillText: { fontSize: 12, fontWeight: '700', color: Colors.success },
})

const secStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countPill: {
    backgroundColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
})
