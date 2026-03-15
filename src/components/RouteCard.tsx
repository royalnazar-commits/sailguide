import React, { useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Route } from '../types'
import { Colors } from '../constants/colors'
import { useProfileStore } from '../store/profileStore'

interface Props {
  route: Route
  onPress: () => void
  showSaveIndicator?: boolean
}

const ROUTE_FALLBACK = 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80'

const difficultyColor = { EASY: '#22C55E', MODERATE: '#F59E0B', ADVANCED: '#EF4444' }
const difficultyLabel = { EASY: 'Easy', MODERATE: 'Moderate', ADVANCED: 'Advanced' }
const difficultyIcon: Record<string, any> = {
  EASY: 'sunny-outline',
  MODERATE: 'partly-sunny-outline',
  ADVANCED: 'thunderstorm-outline',
}

export function RouteCard({ route, onPress, showSaveIndicator = false }: Props) {
  const { savedRoutes } = useProfileStore()
  const isSaved = savedRoutes.includes(route.id)
  const accentColor = difficultyColor[route.difficulty]
  const reviewCount = route._count?.reviews ?? 0
  const [imgErr, setImgErr] = useState(false)
  const heroUri = imgErr ? ROUTE_FALLBACK : (route.previewPhotos[0] || ROUTE_FALLBACK)

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      {/* ── Image with overlaid badges ── */}
      <View>
        <Image
          source={{ uri: heroUri }}
          style={styles.image}
          onError={() => setImgErr(true)}
        />

        {/* Scrim for badge readability */}
        <View style={styles.imageScrim} />

        {/* Bottom-left: difficulty + season */}
        <View style={styles.imageBadgesLeft}>
          <View style={[styles.difficultyBadge, { backgroundColor: accentColor }]}>
            <Ionicons name={difficultyIcon[route.difficulty]} size={11} color="#fff" />
            <Text style={styles.difficultyText}>{difficultyLabel[route.difficulty]}</Text>
          </View>
          {route.season && (
            <View style={styles.seasonBadge}>
              <Text style={styles.seasonText}>{route.season}</Text>
            </View>
          )}
        </View>

        {/* Top-right: verified + saved */}
        <View style={styles.imageBadgesRight}>
          {route.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#fff" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
          {showSaveIndicator && isSaved && (
            <View style={styles.savedBadge}>
              <Ionicons name="bookmark" size={13} color="#fff" />
            </View>
          )}
        </View>
      </View>

      {/* ── Card body ── */}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{route.title}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.region}>{route.region} · {route.country}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatItem icon="time-outline" value={`${route.durationDays} days`} />
          <View style={styles.statDivider} />
          <StatItem icon="navigate-outline" value={`${route.totalNm} nm`} />
          {route.avgRating > 0 && (
            <>
              <View style={styles.statDivider} />
              <StatItem
                icon="star"
                value={reviewCount > 0 ? `${route.avgRating.toFixed(1)} (${reviewCount})` : route.avgRating.toFixed(1)}
                iconColor="#F59E0B"
              />
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.captainRow}>
            {route.creator.isVerifiedCaptain && (
              <Ionicons name="shield-checkmark" size={13} color={Colors.verified} />
            )}
            <Text style={styles.captainName} numberOfLines={1}>{route.creator.name}</Text>
          </View>
          <View style={[styles.pricePill, route.priceUsd === 0 && styles.pricePillFree]}>
            <Text style={[styles.price, route.priceUsd === 0 && styles.priceFree]}>
              {route.priceUsd === 0 ? 'Free' : `$${route.priceUsd}`}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function StatItem({ icon, value, iconColor }: { icon: any; value: string; iconColor?: string }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={13} color={iconColor || Colors.textSecondary} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  image: { width: '100%', height: 200 },
  imageScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  imageBadgesLeft: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  imageBadgesRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'flex-end',
    gap: 6,
  },
  difficultyBadge: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  difficultyText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  seasonBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  seasonText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  verifiedBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  savedBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 14 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  region: { fontSize: 13, color: Colors.textSecondary },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' },
  statText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  statDivider: { width: 1, height: 14, backgroundColor: Colors.border },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  captainRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, marginRight: 8 },
  captainName: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  pricePill: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pricePillFree: { backgroundColor: '#22C55E18' },
  price: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  priceFree: { color: '#22C55E' },
})
