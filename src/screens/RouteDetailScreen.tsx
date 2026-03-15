import React from 'react'
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SEED_ROUTES, getPointsForRoute } from '../data/seedRoutes'
import { Colors } from '../constants/colors'
import { SafetyBanner } from '../components/SafetyBanner'
import { CaptainBadge } from '../components/CaptainBadge'
import { SaveRouteButton } from '../components/SaveRouteButton'
import { RouteItinerary } from '../components/RouteItinerary'

const difficultyColors = { EASY: Colors.success, MODERATE: Colors.warning, ADVANCED: Colors.danger }

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()

  const route = SEED_ROUTES.find((r) => r.id === id)
  if (!route) return null

  const routePoints = getPointsForRoute(route.id)

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Math.max(120, 80 + insets.bottom) }}>
      {/* Hero image */}
      <Image
        source={{ uri: route.previewPhotos[0] || 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800' }}
        style={styles.heroImage}
      />
      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 12 }]} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      <View style={styles.body}>
        {/* Badges */}
        <View style={styles.badgeRow}>
          {route.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={13} color={Colors.verified} />
              <Text style={styles.verifiedText}>Verified route</Text>
            </View>
          )}
          <View style={[styles.diffBadge, { backgroundColor: difficultyColors[route.difficulty as keyof typeof difficultyColors] + '20' }]}>
            <Text style={[styles.diffText, { color: difficultyColors[route.difficulty as keyof typeof difficultyColors] }]}>
              {route.difficulty.charAt(0) + route.difficulty.slice(1).toLowerCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{route.title}</Text>
        <Text style={styles.region}>{route.region} · {route.country}</Text>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatBox icon="time-outline" value={`${route.durationDays} days`} label="Duration" />
          <StatBox icon="navigate-outline" value={`${route.totalNm} nm`} label="Distance" />
          {route.avgRating > 0 && (
            <StatBox icon="star" value={route.avgRating.toFixed(1)} label="Rating" iconColor="#F59E0B" />
          )}
          {route.season && <StatBox icon="sunny-outline" value={route.season} label="Season" />}
        </View>

        <Text style={styles.description}>{route.description}</Text>

        {/* Itinerary */}
        {routePoints.length > 0 && (
          <RouteItinerary points={routePoints} routeId={route.id} />
        )}

        {/* Tags */}
        {route.tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {route.tags.map((tag: string) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        <SafetyBanner />

        {/* Captain */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Created by</Text>
          <CaptainBadge
            name={route.creator.name}
            avatarUrl={route.creator.avatarUrl}
            isVerified={route.creator.isVerifiedCaptain}
            subtitle={route.creator.bio?.substring(0, 80) || 'Verified sailing captain'}
          />
        </View>

        {/* Map preview button */}
        <TouchableOpacity style={styles.mapPreviewBtn} onPress={() => router.push(`/route/${id}/map`)}>
          <Ionicons name="map-outline" size={20} color={Colors.secondary} />
          <Text style={styles.mapPreviewText}>View Route Map</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.secondary} />
        </TouchableOpacity>

        {/* Last verified */}
        {route.lastVerifiedAt && (
          <Text style={styles.verifiedDate}>
            Last verified: {new Date(route.lastVerifiedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </Text>
        )}
      </View>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <SaveRouteButton routeId={route.id} />
        <TouchableOpacity style={styles.navigateBtn} onPress={() => router.push(`/route/${id}/map`)}>
          <Ionicons name="navigate" size={18} color="#fff" />
          <Text style={styles.navigateText}>View on Map</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function StatBox({ icon, value, label, iconColor }: any) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={iconColor || Colors.secondary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  heroImage: { width: '100%', height: 280 },
  backBtn: {
    position: 'absolute', left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 20 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedText: { fontSize: 12, color: Colors.verified, fontWeight: '600' },
  diffBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  diffText: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  region: { fontSize: 15, color: Colors.textSecondary, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statBox: { flex: 1, minWidth: '22%', backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textMuted },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 24, marginBottom: 16 },
  tag: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 13, color: Colors.secondary },
  section: { marginTop: 20, marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  mapPreviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginVertical: 12,
  },
  mapPreviewText: { flex: 1, fontSize: 15, color: Colors.secondary, fontWeight: '600' },
  verifiedDate: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16, flexDirection: 'row', gap: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  navigateBtn: {
    flex: 1, backgroundColor: Colors.secondary, borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  navigateText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
