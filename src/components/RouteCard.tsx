import React, { useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Route } from '../types'
import { Colors } from '../constants/colors'
import { useProfileStore } from '../store/profileStore'
import { getPointsForRoute } from '../data/seedRoutes'
import { RoutePreviewMap } from './RoutePreviewMap'

interface Props {
  route: Route
  onPress: () => void
  showSaveIndicator?: boolean
}

const MEDIA_HEIGHT = 210
const ROUTE_FALLBACK = 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80'

const difficultyColor = { EASY: '#22C55E', MODERATE: '#F59E0B', ADVANCED: '#EF4444' }
const difficultyLabel = { EASY: 'Easy', MODERATE: 'Moderate', ADVANCED: 'Advanced' }
const difficultyIcon: Record<string, any> = {
  EASY: 'sunny-outline',
  MODERATE: 'partly-sunny-outline',
  ADVANCED: 'thunderstorm-outline',
}

export function RouteCard({ route, onPress, showSaveIndicator = false }: Props) {
  const { savedRoutes, preferences } = useProfileStore()
  const distLabel = preferences.distanceUnit === 'km'
    ? `${Math.round(route.totalNm * 1.852)} km`
    : `${route.totalNm} nm`
  const isSaved = savedRoutes.includes(route.id)
  const accentColor = difficultyColor[route.difficulty]
  const reviewCount = route._count?.reviews ?? 0
  const points = getPointsForRoute(route.id)
  const [imgErr, setImgErr] = useState(false)
  const [mediaWidth, setMediaWidth] = useState(0)
  const [activeSlide, setActiveSlide] = useState(0)
  const heroUri = imgErr ? ROUTE_FALLBACK : (route.previewPhotos[0] || ROUTE_FALLBACK)

  return (
    // Outer View carries shadow; inner cardInner provides overflow:hidden so
    // the image is clipped to border radius without killing the shadow on iOS.
    <View style={styles.card}>
      <View style={styles.cardInner}>

      {/* ── Swipeable media block ─────────────────────────────────────────── */}
      <View
        style={styles.mediaBlock}
        onLayout={(e) => setMediaWidth(e.nativeEvent.layout.width)}
      >
        {mediaWidth > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            bounces={false}
            decelerationRate="fast"
            disableIntervalMomentum
            onMomentumScrollEnd={(e) => {
              setActiveSlide(Math.round(e.nativeEvent.contentOffset.x / mediaWidth))
            }}
          >
            {/* Slide 1 — Photo (tap to open route) */}
            <TouchableOpacity
              style={{ width: mediaWidth, height: MEDIA_HEIGHT }}
              onPress={onPress}
              activeOpacity={0.92}
            >
              <Image
                source={{ uri: heroUri }}
                style={{ width: mediaWidth, height: MEDIA_HEIGHT }}
                onError={() => setImgErr(true)}
              />
              {/* Scrim */}
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
            </TouchableOpacity>

            {/* Slide 2 — Route map (tap to open route) */}
            <TouchableOpacity
              style={{ width: mediaWidth, height: MEDIA_HEIGHT }}
              onPress={onPress}
              activeOpacity={0.92}
            >
              <RoutePreviewMap points={points} height={MEDIA_HEIGHT} />
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Dot indicators — always on top, pass through touches */}
        <View style={styles.dots} pointerEvents="none">
          {[0, 1].map((i) => (
            <View
              key={i}
              style={[styles.dot, activeSlide === i ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      </View>

      {/* ── Card body ── tappable separately so media swipe stays conflict-free */}
      <TouchableOpacity style={styles.body} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.title} numberOfLines={2}>{route.title}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.region}>{route.region} · {route.country}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatItem icon="time-outline" value={`${route.durationDays} days`} />
          <View style={styles.statDivider} />
          <StatItem icon="navigate-outline" value={distLabel} />
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
      </TouchableOpacity>

      </View>{/* cardInner */}
    </View>
  )
}

function StatItem({ icon, value, iconColor }: { icon: any; value: string; iconColor?: string }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={13} color={iconColor || Colors.secondary} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Outer shell carries the shadow — no overflow:hidden so shadow isn't clipped on iOS.
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  // Inner shell clips image + content to border radius without clipping the shadow.
  cardInner: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  // ── Media block ──────────────────────────────────────────────────────────
  mediaBlock: {
    height: MEDIA_HEIGHT,
    backgroundColor: '#E8F4FD', // placeholder colour while layout fires
  },
  imageScrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 72, backgroundColor: 'rgba(0,0,0,0.38)',
  },
  imageBadgesLeft: {
    position: 'absolute', bottom: 10, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  imageBadgesRight: {
    position: 'absolute', top: 12, right: 12,
    alignItems: 'flex-end', gap: 6,
  },
  difficultyBadge: {
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  difficultyText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  seasonBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  seasonText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  verifiedBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  verifiedText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  savedBadge: {
    backgroundColor: Colors.primary, borderRadius: 16,
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
  },

  // ── Dot indicators ───────────────────────────────────────────────────────
  dots: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 18, backgroundColor: '#fff' },
  dotInactive: { width: 6, backgroundColor: 'rgba(255,255,255,0.50)' },

  // ── Card body ────────────────────────────────────────────────────────────
  body: { padding: 14 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  region: { fontSize: 13, color: Colors.textSecondary },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 4, marginBottom: 12,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' },
  statText: { fontSize: 13, color: Colors.secondary, fontWeight: '600' },
  statDivider: { width: 1, height: 14, backgroundColor: Colors.border },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  captainRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, marginRight: 8 },
  captainName: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  pricePill: {
    backgroundColor: Colors.primary + '15', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  pricePillFree: { backgroundColor: '#22C55E18' },
  price: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  priceFree: { color: '#22C55E' },
})
