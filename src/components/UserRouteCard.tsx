/**
 * UserRouteCard — premium card for community / user-created routes.
 *
 * Matches RouteCard visually (same shell+inner shadow pattern, same dimensions,
 * same body layout). Accepts UserRoute instead of the curated Route type.
 */

import React from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { UserRoute } from '../types/userRoute'
import { Colors } from '../constants/colors'

// ── Constants ─────────────────────────────────────────────────────────────────

const MEDIA_HEIGHT = 210

const AVATAR_COLORS = ['#1B6CA8', '#0891B2', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#CA8A04']

// ── Helpers ───────────────────────────────────────────────────────────────────

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  route: UserRoute
  onPress: () => void
  /** Show filled bookmark badge on cover */
  isSaved?: boolean
  /** Rank number for trending lists — renders gold/silver/bronze badge */
  rank?: number
  /** Show "Your Route" badge + draft/published status pill in footer */
  isOwn?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserRouteCard({ route, onPress, isSaved, rank, isOwn }: Props) {
  const coverUri    = route.images?.[0]
  const authorName  = route.createdByName ?? 'Captain'
  const authorColor = avatarColor(authorName)
  const firstTag    = route.tags?.[0]
  const showRank    = rank != null && rank >= 1 && rank <= 3
  const rankColor   = rank === 1 ? '#F59E0B' : rank === 2 ? '#94A3B8' : '#CD7C39'

  return (
    // Outer shell: carries shadow on iOS (no overflow:hidden)
    <View style={styles.card}>
      {/* Inner: clips cover image + body to border radius */}
      <View style={styles.cardInner}>

        {/* ── Cover image ──────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.mediaBlock}
          onPress={onPress}
          activeOpacity={0.92}
        >
          {coverUri ? (
            <Image
              source={{ uri: coverUri }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="compass-outline" size={40} color={Colors.secondary + '50'} />
              {route.region ? (
                <Text style={styles.coverRegionHint}>{route.region}</Text>
              ) : null}
            </View>
          )}

          {/* Scrim for badge legibility */}
          <View style={styles.imageScrim} />

          {/* Bottom-left: type badge + optional tag */}
          <View style={styles.imageBadgesLeft}>
            <View style={styles.communityBadge}>
              <Ionicons name="people-outline" size={11} color="#fff" />
              <Text style={styles.communityBadgeText}>Community</Text>
            </View>
            {firstTag ? (
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>{firstTag}</Text>
              </View>
            ) : null}
          </View>

          {/* Top-right: rank / saved / own badges */}
          <View style={styles.imageBadgesRight}>
            {showRank && (
              <View style={[styles.rankBadge, { backgroundColor: rankColor }]}>
                <Text style={styles.rankBadgeText}>#{rank}</Text>
              </View>
            )}
            {isSaved && (
              <View style={styles.savedBadge}>
                <Ionicons name="bookmark" size={13} color="#fff" />
              </View>
            )}
            {isOwn && (
              <View style={styles.ownBadge}>
                <Ionicons name="person-circle" size={11} color="#fff" />
                <Text style={styles.ownBadgeText}>Yours</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* ── Card body ────────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.body} onPress={onPress} activeOpacity={0.85}>
          <Text style={styles.title} numberOfLines={2}>
            {route.title || 'Untitled Route'}
          </Text>

          {(route.region || route.country) ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.region}>
                {[route.region, route.country].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : null}

          {/* Stats row — matches RouteCard's tinted background strip */}
          <View style={styles.statsRow}>
            {(route.estimatedDays ?? 0) > 0 ? (
              <>
                <StatItem icon="time-outline" value={`${route.estimatedDays} days`} />
                <View style={styles.statDivider} />
              </>
            ) : null}
            {route.totalNm > 0 ? (
              <>
                <StatItem icon="navigate-outline" value={`${route.totalNm} nm`} />
                <View style={styles.statDivider} />
              </>
            ) : null}
            <StatItem icon="location-outline" value={`${route.stops.length} stop${route.stops.length !== 1 ? 's' : ''}`} />
          </View>

          {/* Footer: author + status/price pill */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.authorRow}
              onPress={() => route.createdBy ? router.push(`/user/${route.createdBy}` as any) : undefined}
              activeOpacity={route.createdBy ? 0.75 : 1}
              disabled={!route.createdBy}
            >
              <View style={[styles.authorAvatar, { backgroundColor: authorColor }]}>
                <Text style={styles.authorInitials}>{initials(authorName)}</Text>
              </View>
              <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
            </TouchableOpacity>

            {isOwn ? (
              <View style={[
                styles.statusPill,
                route.status === 'PUBLISHED' ? styles.statusPublished : styles.statusDraft,
              ]}>
                <Text style={[
                  styles.statusText,
                  route.status === 'PUBLISHED' ? styles.statusTextPublished : styles.statusTextDraft,
                ]}>
                  {route.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                </Text>
              </View>
            ) : route.isPremium && (route.priceUsd ?? 0) > 0 ? (
              <View style={styles.pricePill}>
                <Text style={styles.priceText}>${route.priceUsd}</Text>
              </View>
            ) : (
              <View style={styles.freePill}>
                <Text style={styles.freeText}>Free</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

      </View>
    </View>
  )
}

// ── StatItem ──────────────────────────────────────────────────────────────────

function StatItem({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={13} color={Colors.secondary} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Outer shell: carries shadow, no overflow:hidden (iOS clips shadow otherwise)
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
  // Inner: clips cover image to border radius
  cardInner: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  // ── Cover ────────────────────────────────────────────────────────────────
  mediaBlock: {
    height: MEDIA_HEIGHT,
    backgroundColor: Colors.secondary + '14',
  },
  coverImage: {
    width: '100%',
    height: MEDIA_HEIGHT,
  },
  coverPlaceholder: {
    width: '100%',
    height: MEDIA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.secondary + '0A',
  },
  coverRegionHint: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary + '80',
    letterSpacing: 0.3,
  },
  imageScrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 72,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },

  // Cover badge positions
  imageBadgesLeft: {
    position: 'absolute', bottom: 10, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  imageBadgesRight: {
    position: 'absolute', top: 12, right: 12,
    alignItems: 'flex-end', gap: 6,
  },

  // Community type badge (mirrors difficultyBadge in RouteCard)
  communityBadge: {
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.secondary,
  },
  communityBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Tag badge (mirrors seasonBadge in RouteCard)
  tagBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  tagBadgeText: { color: '#fff', fontSize: 11, fontWeight: '500' },

  // Rank badge (gold/silver/bronze)
  rankBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  rankBadgeText: { fontSize: 11, fontWeight: '900', color: '#fff' },

  // Saved bookmark badge
  savedBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },

  // "Yours" badge for own routes
  ownBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  ownBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // ── Body ─────────────────────────────────────────────────────────────────
  body: { padding: 14 },
  title: {
    fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 5,
  },
  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12,
  },
  region: { fontSize: 13, color: Colors.textSecondary },

  // Stats row — same tinted pill as RouteCard
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 4,
    marginBottom: 12,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' },
  statText: { fontSize: 13, color: Colors.secondary, fontWeight: '600' },
  statDivider: { width: 1, height: 14, backgroundColor: Colors.border },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, marginRight: 8 },
  authorAvatar: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  authorInitials: { fontSize: 9, fontWeight: '800', color: '#fff' },
  authorName: { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  // Status pills
  statusPill: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusPublished: { backgroundColor: '#22C55E18' },
  statusDraft:     { backgroundColor: Colors.textMuted + '18' },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusTextPublished: { color: '#22C55E' },
  statusTextDraft:     { color: Colors.textMuted },

  // Price / free pills — mirrors RouteCard
  pricePill: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  priceText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  freePill: {
    backgroundColor: '#22C55E18',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  freeText: { fontSize: 12, fontWeight: '700', color: '#22C55E' },
})
