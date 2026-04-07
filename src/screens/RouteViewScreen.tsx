/**
 * RouteViewScreen — premium read-only view for a published UserRoute.
 *
 * Layout matches RouteDetailScreen (ScrollView hero → body → social bar).
 * Social interactions (like, save, comments) via routeInteractionStore.
 * Map accessed via "View on Map" → /route-view-map/[id].
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Dimensions, Image, Animated, Modal, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useAuthStore } from '../store/authStore'
import { usePlacesStore } from '../store/placesStore'
import { useRouteInteractionStore, RouteComment } from '../store/routeInteractionStore'
import { useSocialStore } from '../store/socialStore'
import { SafetyBanner } from '../components/SafetyBanner'
import { SuggestedYachts } from '../components/SuggestedYachts'
import { CaptainBadge } from '../components/CaptainBadge'
import { ShareRouteModal } from '../components/ShareRouteModal'
import { seedPlaces } from '../data/seedPlaces'
import { Colors } from '../constants/colors'
import { UserRouteDayDetail, UserRouteStop } from '../types/userRoute'

// ── Constants ─────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_W    = 168
const CARD_GAP  = 12
const HERO_H    = 300
const SHEET_MAX = 560

// ── Palettes ──────────────────────────────────────────────────────────────────

const DAY_PALETTE   = ['#1B6CA8', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#00B4D8', '#F97316']
const AVATAR_COLORS = ['#1B6CA8', '#0891B2', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#CA8A04']

const STOP_TYPE_COLORS: Record<string, string> = {
  MARINA: '#1B6CA8', ANCHORAGE: '#22C55E', BAY: '#00B4D8',
  BEACH: '#FF7043', LAGOON: '#0891B2', CAVE: '#7C3AED',
  FUEL: '#F59E0B', CUSTOM: '#64748B',
  DAY_START: '#22C55E', DAY_END: '#1B6CA8', ALT_END: '#F97316',
}
const STOP_TYPE_LABELS: Record<string, string> = {
  MARINA: 'Marina', ANCHORAGE: 'Anchorage', BAY: 'Bay', BEACH: 'Beach',
  CAVE: 'Cave', FUEL: 'Fuel', CUSTOM: 'Stop', LAGOON: 'Lagoon', SWIM: 'Swim Stop',
}

// Emoji + label config for rich intermediate stop cards (mirrors RouteItinerary's STOP_CONFIG)
const USER_STOP_CONFIG: Record<string, { emoji: string; label: string }> = {
  MARINA:    { emoji: '⚓', label: 'Marina' },
  ANCHORAGE: { emoji: '⚓', label: 'Anchorage' },
  BAY:       { emoji: '🌊', label: 'Bay' },
  BEACH:     { emoji: '🏖', label: 'Beach' },
  LAGOON:    { emoji: '🏝', label: 'Lagoon' },
  CAVE:      { emoji: '🦇', label: 'Cave' },
  FUEL:      { emoji: '⛽', label: 'Fuel Stop' },
  SWIM:      { emoji: '🏊', label: 'Swim Spot' },
  CUSTOM:    { emoji: '📍', label: 'Stop' },
}

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
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Derive an evocative title for a stop that has no name
function stopTitle(stop: UserRouteStop): string {
  if (stop.name?.trim()) return stop.name
  switch (stop.type) {
    case 'CAVE':      return 'Hidden Cave'
    case 'BEACH':     return 'Sandy Beach'
    case 'LAGOON':    return 'Crystal Lagoon'
    case 'ANCHORAGE': return 'Quiet Anchorage'
    case 'BAY':       return 'Sheltered Bay'
    case 'MARINA':    return 'Marina'
    case 'FUEL':      return 'Fuel Stop'
    case 'SWIM':      return 'Swim Spot'
    default:          return 'Waypoint'
  }
}

// Return stop description; fall back to a short contextual placeholder
function stopDescription(stop: UserRouteStop): string | null {
  if (stop.description?.trim()) return stop.description
  switch (stop.type) {
    case 'CAVE':      return 'A scenic cave worth exploring — bring a torch.'
    case 'BEACH':     return 'A beautiful beach — ideal for a swim and a rest.'
    case 'LAGOON':    return 'Crystal-clear waters perfect for anchoring.'
    case 'ANCHORAGE': return 'Protected anchorage with good holding ground.'
    case 'BAY':       return 'A sheltered bay — great for a lunch stop.'
    case 'MARINA':    return 'Marina facilities available here.'
    case 'FUEL':      return 'Fuel and provisioning stop.'
    case 'SWIM':      return 'Great spot for a swim break.'
    default:          return null
  }
}

// XP hook — wire to XP store when the system is built
function notifyXP(amount: number) {
  // TODO: dispatch to XP/captain store
  console.log(`[XP] +${amount}`)
}

// ── Day grouping ──────────────────────────────────────────────────────────────

interface DayGroup {
  day: number
  departure:    UserRouteStop | undefined
  destination:  UserRouteStop | undefined
  intermediate: UserRouteStop[]
  alt:          UserRouteStop | undefined
  nm:           number
  isInherited:  boolean
}

function nmBetween(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 3440.065
  const dLa = ((la2 - la1) * Math.PI) / 180
  const dLo = ((lo2 - lo1) * Math.PI) / 180
  const a = Math.sin(dLa / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLo / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

function buildDayGroups(stops: UserRouteStop[]): DayGroup[] {
  if (stops.length === 0) return []
  const hasDayTypes = stops.some((s) => s.type === 'DAY_START' || s.type === 'DAY_END')
  if (!hasDayTypes) {
    const sorted = [...stops].sort((a, b) => a.sequence - b.sequence)
    const dep = sorted[0], dst = sorted.length > 1 ? sorted[sorted.length - 1] : undefined
    const mid = sorted.slice(1, sorted.length > 1 ? sorted.length - 1 : 1)
    const nm = dep?.lat && dep?.lng && dst?.lat && dst?.lng
      ? nmBetween(dep.lat, dep.lng, dst.lat, dst.lng) : 0
    return [{ day: 0, departure: dep, destination: dst, intermediate: mid, alt: undefined, nm, isInherited: false }]
  }
  const maxDay = Math.max(...stops.map((s) => s.dayIndex ?? 0))
  const groups: DayGroup[] = []
  for (let d = 0; d <= maxDay; d++) {
    const ds = stops.filter((s) => (s.dayIndex ?? 0) === d).sort((a, b) => a.sequence - b.sequence)
    if (!ds.length) continue
    const departure    = ds.find((s) => s.type === 'DAY_START')
    const destination  = ds.find((s) => s.type === 'DAY_END')
    const intermediate = ds.filter((s) => s.type !== 'DAY_START' && s.type !== 'DAY_END' && s.type !== 'ALT_END')
    const alt          = ds.find((s) => s.type === 'ALT_END')
    const inherited    = !departure && d > 0
      ? stops.find((s) => (s.dayIndex ?? 0) === d - 1 && s.type === 'DAY_END') : undefined
    const effective = departure ?? inherited
    const nm = effective?.lat && effective?.lng && destination?.lat && destination?.lng
      ? nmBetween(effective.lat, effective.lng, destination.lat, destination.lng) : 0
    groups.push({ day: d, departure: effective, destination, intermediate, alt, nm, isInherited: !!inherited })
  }
  return groups
}

// ── Stable empty data ─────────────────────────────────────────────────────────

const EMPTY_ROUTE_DATA = Object.freeze({
  ratings: {} as Record<string, number>,
  saveCount: 0,
  savedBy: [] as string[],
  comments: [] as RouteComment[],
})

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RouteViewScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>()
  const insets    = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)

  const { getRoute, savedRoutes } = useRouteBuilderStore()
  const { user }       = useAuthStore()
  const { userPlaces } = usePlacesStore()
  const { isFollowing, followUser, unfollowUser } = useSocialStore()

  // Selective subscriptions
  const routeData     = useRouteInteractionStore((s) => s.routes[id] ?? EMPTY_ROUTE_DATA)
  const addRating     = useRouteInteractionStore((s) => s.addRating)
  const toggleSave    = useRouteInteractionStore((s) => s.toggleSave)
  const addComment    = useRouteInteractionStore((s) => s.addComment)
  const deleteComment = useRouteInteractionStore((s) => s.deleteComment)

  const allPlaces  = useMemo(() => [...seedPlaces, ...userPlaces], [userPlaces])
  const route      = getRoute(id)
  const isOwner    = savedRoutes.some((r) => r.id === id)
  const userId     = user?.id ?? 'anonymous'
  const userName   = user?.name ?? user?.email?.split('@')[0] ?? 'Sailor'
  const authorId   = route?.createdBy
  const following  = authorId ? isFollowing(authorId) : false

  const handleFollowToggle = useCallback(() => {
    if (!authorId) return
    if (following) { unfollowUser(authorId) } else { followUser(authorId) }
  }, [authorId, following, followUser, unfollowUser])

  // Derived social state
  const saved    = routeData.savedBy.includes(userId)
  const comments = routeData.comments

  // Rating derived state
  const myRating   = routeData.ratings[userId] ?? 0
  const ratingVals = Object.values(routeData.ratings)
  const avgRating  = ratingVals.length > 0
    ? Math.round(ratingVals.reduce((s, v) => s + v, 0) / ratingVals.length * 10) / 10
    : null
  const ratingCount = ratingVals.length

  const [commentText, setCommentText] = useState('')
  const [shareVisible, setShareVisible] = useState(false)
  const [activeDayModal, setActiveDayModal] = useState<{ group: DayGroup; detail?: UserRouteDayDetail } | null>(null)
  const textRef     = useRef<TextInput>(null)
  const composerRef = useRef<View>(null)

  // Micro-interaction animations
  const saveScale = useRef(new Animated.Value(1)).current
  const modalAnim = useRef(new Animated.Value(SHEET_MAX)).current

  const openDayModal = useCallback((group: DayGroup, detail?: UserRouteDayDetail) => {
    setActiveDayModal({ group, detail })
    modalAnim.setValue(SHEET_MAX)
    Animated.spring(modalAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 12 }).start()
  }, [modalAnim])

  const closeDayModal = useCallback(() => {
    Animated.timing(modalAnim, { toValue: SHEET_MAX, duration: 240, useNativeDriver: true })
      .start(() => setActiveDayModal(null))
  }, [modalAnim])

  // Resolved stops
  const stopItems = useMemo(() => {
    if (!route) return []
    return route.stops
      .slice().sort((a, b) => a.sequence - b.sequence)
      .map((stop, i) => {
        const place = allPlaces.find((p) => p.id === stop.placeId)
        const lat   = place?.lat ?? stop.lat
        const lng   = place?.lng ?? stop.lng
        if (lat == null || lng == null) return null
        return { stop, lat, lng, name: place?.name ?? stop.name ?? `Stop ${i + 1}` }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }, [route, allPlaces])

  const dayGroups = useMemo(() => buildDayGroups(route?.stops ?? []), [route?.stops])

  // Social actions
  const handleSave = useCallback(() => {
    toggleSave(id, userId)
    saveScale.setValue(1)
    Animated.sequence([
      Animated.spring(saveScale, { toValue: 1.35, useNativeDriver: true, tension: 300, friction: 6 }),
      Animated.spring(saveScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start()
  }, [id, userId, toggleSave, saveScale])

  const handleRate = useCallback((star: number) => {
    const isFirstRating = myRating === 0
    addRating(id, userId, star)
    if (isFirstRating) notifyXP(2)
  }, [myRating, id, userId, addRating])

  const handleComment = useCallback(() => {
    const text = commentText.trim()
    if (!text) return
    addComment(id, userId, userName, text)
    setCommentText('')
    notifyXP(5)
  }, [commentText, id, userId, userName, addComment])

  const handleComposerFocus = useCallback(() => {
    // Let keyboard animate before scrolling
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350)
  }, [])

  // ── Not found ──
  if (!route) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textMuted} />
        <Text style={s.centerTitle}>Route not found</Text>
        <TouchableOpacity style={s.goBackBtn} onPress={() => router.back()}>
          <Text style={s.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const coverUri       = route.images?.[0]
  const authorName     = route.createdByName ?? 'Unknown Sailor'
  const authorColor    = avatarColor(authorName)
  const publishedDate  = route.publishedAt
    ? new Date(route.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <View style={s.container}>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Scrollable content ── */}
        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={{ paddingBottom: Math.max(120, 100 + insets.bottom) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Hero ── */}
          <View style={s.heroContainer}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={s.heroImage} resizeMode="cover" />
            ) : (
              <View style={[s.heroImage, s.heroPlaceholder]}>
                <Ionicons name="compass-outline" size={52} color="rgba(255,255,255,0.35)" />
              </View>
            )}
            <View style={s.heroScrim} />
            <View style={s.heroScrimDeep} />

            {/* Back button */}
            <TouchableOpacity
              style={[s.backBtn, { top: insets.top + 10 }]}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            {/* Owner Edit button */}
            {isOwner && (
              <TouchableOpacity
                style={[s.heroEditBtn, { top: insets.top + 10 }]}
                onPress={() => router.push(`/user-route/${id}` as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={s.heroEditBtnText}>Edit</Text>
              </TouchableOpacity>
            )}

            {/* Title row overlaid on hero */}
            <View style={s.heroTitleRow}>
              <View style={s.heroTitleLeft}>
                <Text style={s.heroTitle} numberOfLines={2}>{route.title}</Text>
                {(route.region || route.country) && (
                  <Text style={s.heroRegion}>
                    {[route.region, route.country].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              {/* Bookmark */}
              <TouchableOpacity
                style={s.bookmarkBtn}
                onPress={handleSave}
                activeOpacity={0.75}
              >
                <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                  <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={saved ? '#F59E0B' : '#fff'}
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Body ── */}
          <View style={s.body}>

            {/* Badge row */}
            <View style={s.badgeRow}>
              <View style={s.communityBadge}>
                <Ionicons name="people-outline" size={12} color={Colors.secondary} />
                <Text style={s.communityBadgeText}>Community Route</Text>
              </View>
              {route.tags.length > 0 && (
                <View style={s.diffBadge}>
                  <Text style={s.diffBadgeText}>{route.tags[0]}</Text>
                </View>
              )}
              <TouchableOpacity
                style={s.inlineMapBtn}
                onPress={() => router.push(`/route-view-map/${id}` as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="navigate" size={13} color="#fff" />
                <Text style={s.inlineMapText}>View on Map</Text>
              </TouchableOpacity>
            </View>

            {/* Stats grid */}
            <View style={s.statsGrid}>
              {(route.estimatedDays ?? 0) > 0 && (
                <StatBox icon="time-outline" value={`${route.estimatedDays} days`} label="Duration" />
              )}
              {route.totalNm > 0 && (
                <StatBox icon="navigate-outline" value={`${route.totalNm} nm`} label="Distance" />
              )}
              {stopItems.length > 0 && (
                <StatBox icon="location-outline" value={String(stopItems.length)} label="Stops" />
              )}
            </View>

            {/* Description */}
            {route.description ? (
              <Text style={s.description}>{route.description}</Text>
            ) : null}

            {/* Itinerary — horizontal day cards */}
            {dayGroups.length > 0 && (
              <UserItinerary
                dayGroups={dayGroups}
                dayDetails={route.dayDetails}
                onCardPress={openDayModal}
              />
            )}

            {/* Tags */}
            {route.tags.length > 0 && (
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {route.tags.map((tag, i) => (
                    <View key={i} style={s.tag}>
                      <Text style={s.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Charter */}
            <SuggestedYachts country={route.country} />

            {/* Safety */}
            <View style={{ marginVertical: 4 }}>
              <SafetyBanner compact />
            </View>

            {/* Author */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Created by</Text>
              <View style={s.authorBlock}>
                <TouchableOpacity
                  style={s.authorBlockLeft}
                  onPress={() => {
                    if (authorId) router.push(`/user/${authorId}` as any)
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[s.authorAvatar, { backgroundColor: authorColor }]}>
                    <Text style={s.authorAvatarText}>{initials(authorName)}</Text>
                  </View>
                  <View style={s.authorInfo}>
                    <View style={s.authorNameRow}>
                      <Text style={s.authorName}>{authorName}</Text>
                      {isOwner && (
                        <View style={s.youBadge}>
                          <Text style={s.youBadgeText}>You</Text>
                        </View>
                      )}
                    </View>
                    {publishedDate && (
                      <Text style={s.authorMeta}>Published {publishedDate}</Text>
                    )}
                  </View>
                </TouchableOpacity>
                {!isOwner && route.createdBy && (
                  <TouchableOpacity
                    style={[s.followPill, following && s.followPillActive]}
                    onPress={handleFollowToggle}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={following ? 'checkmark' : 'person-add-outline'}
                      size={13}
                      color={following ? Colors.secondary : '#fff'}
                    />
                    <Text style={[s.followPillText, following && s.followPillTextActive]}>
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
                {isOwner && (
                  <TouchableOpacity
                    onPress={() => router.push(`/user-route/${id}` as any)}
                    activeOpacity={0.8}
                    style={s.editPill}
                  >
                    <Ionicons name="create-outline" size={13} color={Colors.secondary} />
                    <Text style={s.editPillText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Map preview button */}
            <TouchableOpacity
              style={s.mapPreviewBtn}
              onPress={() => router.push(`/route-view-map/${id}` as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="map-outline" size={20} color={Colors.secondary} />
              <Text style={s.mapPreviewText}>View Route Map</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.secondary} />
            </TouchableOpacity>

            {/* ── Comments — exact copy of PlaceDetailScreen ── */}
            <View style={s.divider} />

            <View style={s.section}>
              <View style={s.commentsSectionHeader}>
                <Text style={s.sectionTitle}>
                  Comments{comments.length > 0 ? ` (${comments.length})` : ''}
                </Text>
                {comments.length > 0 && (
                  <View style={s.commentCountPill}>
                    <Ionicons name="chatbubble-outline" size={12} color={Colors.secondary} />
                    <Text style={s.commentCountPillText}>{comments.length}</Text>
                  </View>
                )}
              </View>

              {comments.length === 0 ? (
                <View style={s.commentsEmpty}>
                  <Ionicons name="chatbubbles-outline" size={32} color={Colors.textMuted} />
                  <Text style={s.commentsEmptyTitle}>No comments yet</Text>
                  <Text style={s.commentsEmptyText}>Be the first to share your experience of this route.</Text>
                </View>
              ) : (
                <View style={s.commentsList}>
                  {comments.map((c, idx) => (
                    <RouteCommentCard
                      key={c.id}
                      comment={c}
                      isLast={idx === comments.length - 1}
                      isOwn={c.userId === userId}
                      isAuthor={!!(route.createdBy && c.userId === route.createdBy)}
                      onDelete={() => deleteComment(id, c.id, userId)}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* ── Composer ── */}
            <View ref={composerRef} style={s.composer}>
              <View style={s.composerRow}>
                <View style={[s.composerAvatar, { backgroundColor: avatarColor(userName) }]}>
                  <Text style={s.composerAvatarText}>{initials(userName)}</Text>
                </View>
                <TextInput
                  ref={textRef}
                  style={[s.composerInput, s.composerTextArea]}
                  placeholder="Share your thoughts..."
                  placeholderTextColor={Colors.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  blurOnSubmit={false}
                  maxLength={280}
                  onFocus={handleComposerFocus}
                />
              </View>

              <TouchableOpacity
                style={s.composerSubmit}
                onPress={handleComment}
                disabled={!commentText.trim()}
                activeOpacity={0.85}
              >
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={s.composerSubmitText}>Post Comment</Text>
              </TouchableOpacity>
            </View>

            {/* ── Rating block — final action ── */}
            <RatingBlock
              myRating={myRating}
              avgRating={avgRating}
              ratingCount={ratingCount}
              onRate={handleRate}
            />

          </View>
        </ScrollView>

        {/* ── Sticky action bar ── */}
        <View style={[s.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[s.saveActionBtn, saved && s.saveActionBtnActive]}
            onPress={handleSave}
            activeOpacity={0.82}
          >
            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={saved ? Colors.primary : Colors.textSecondary}
              />
            </Animated.View>
            <Text style={[s.saveActionBtnText, saved && s.saveActionBtnTextActive]}>
              {saved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.shareActionBtn}
            onPress={() => setShareVisible(true)}
            activeOpacity={0.82}
          >
            <Ionicons name="paper-plane-outline" size={18} color={Colors.secondary} />
            <Text style={s.shareActionBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.mapActionBtn}
            onPress={() => router.push(`/route-view-map/${id}` as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="map" size={18} color="#fff" />
            <Text style={s.mapActionBtnText}>View Map</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Share modal ── */}
      <ShareRouteModal
        visible={shareVisible}
        route={route ? {
          id,
          title:      route.title,
          authorName: route.createdByName ?? undefined,
          authorId:   route.createdBy ?? undefined,
          coverImage: route.images?.[0],
          avgRating:  avgRating ?? undefined,
          stats: {
            days:  route.estimatedDays,
            nm:    route.totalNm > 0      ? route.totalNm      : undefined,
            stops: route.stops.length > 0 ? route.stops.length : undefined,
          },
        } : null}
        onClose={() => setShareVisible(false)}
      />

      {/* ── Day detail modal (bottom sheet) ── */}
      <Modal
        visible={activeDayModal !== null}
        transparent
        animationType="none"
        onRequestClose={closeDayModal}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={closeDayModal}>
          <View style={s.modalBackdrop} />
        </TouchableWithoutFeedback>
        <Animated.View style={[s.modalSheet, { transform: [{ translateY: modalAnim }] }]}>
          <View style={s.modalHandle} />
          {activeDayModal && (
            <ReadonlyDayCard
              group={activeDayModal.group}
              dayDetail={activeDayModal.detail}
              inModal
              onClose={closeDayModal}
            />
          )}
        </Animated.View>
      </Modal>
    </View>
  )
}

// ── UserItinerary ──────────────────────────────────────────────────────────────

interface ItineraryProps {
  dayGroups:  DayGroup[]
  dayDetails?: Record<number, UserRouteDayDetail>
  onCardPress: (group: DayGroup, detail?: UserRouteDayDetail) => void
}

function UserItinerary({ dayGroups, dayDetails, onCardPress }: ItineraryProps) {
  if (dayGroups.length === 0) return null
  return (
    <View style={it.wrapper}>
      <Text style={it.sectionTitle}>Itinerary</Text>
      <Text style={it.sectionSub}>
        {dayGroups.length} {dayGroups.length === 1 ? 'day' : 'days'} · tap a card for details
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={it.strip}
        style={it.stripScroll}
      >
        {dayGroups.map((group) => {
          const dayColor  = DAY_PALETTE[group.day % DAY_PALETTE.length]
          const depName   = group.departure?.name  ?? 'Start'
          const dstName   = group.destination?.name ?? 'End'
          const stopCount = group.intermediate.length + (group.alt ? 1 : 0)
          return (
            <TouchableOpacity
              key={group.day}
              style={[it.card, { borderLeftColor: dayColor }]}
              onPress={() => onCardPress(group, dayDetails?.[group.day])}
              activeOpacity={0.75}
            >
              <View style={it.cardDayRow}>
                <View style={[it.dayBadge, { backgroundColor: dayColor + '18' }]}>
                  <Text style={[it.dayBadgeText, { color: dayColor }]}>DAY {group.day + 1}</Text>
                </View>
                <View style={[it.typeDot, { backgroundColor: dayColor }]} />
              </View>
              <View style={it.routeLine}>
                <Text style={it.fromName} numberOfLines={1}>{depName}</Text>
                <View style={it.arrowRow}>
                  <View style={[it.arrowLine, { backgroundColor: dayColor + '40' }]} />
                  <View style={[it.arrowCircle, { borderColor: dayColor }]}>
                    <Ionicons name="arrow-down" size={10} color={dayColor} />
                  </View>
                  <View style={[it.arrowLine, { backgroundColor: dayColor + '40' }]} />
                </View>
                <Text style={it.toName} numberOfLines={1}>{dstName}</Text>
              </View>
              <View style={it.cardFooter}>
                {group.nm > 0 && (
                  <View style={it.statPill}>
                    <Text style={it.statPillText}>{group.nm} nm</Text>
                  </View>
                )}
                {stopCount > 0 && (
                  <View style={[it.statPill, { backgroundColor: dayColor + '14' }]}>
                    <Text style={[it.statPillText, { color: dayColor }]}>
                      {stopCount} stop{stopCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )
        })}
        <View style={{ width: 20 }} />
      </ScrollView>
    </View>
  )
}

// ── ReadonlyDayCard ────────────────────────────────────────────────────────────

interface ReadonlyDayCardProps {
  group:      DayGroup
  dayDetail?: UserRouteDayDetail
  inModal?:   boolean
  onClose?:   () => void
}

function ReadonlyDayCard({ group, dayDetail, inModal, onClose }: ReadonlyDayCardProps) {
  const { day, departure, destination, intermediate, alt, nm, isInherited } = group
  const dayColor = DAY_PALETTE[day % DAY_PALETTE.length]
  const depName  = departure?.name  ?? 'Departure'
  const dstName  = destination?.name ?? 'Destination'

  const content = (
    <>
      {/* Day header */}
      <View style={[dc.header, { borderLeftColor: dayColor }]}>
        <View style={[dc.dayBadge, { backgroundColor: dayColor + '1A' }]}>
          <Text style={[dc.dayBadgeText, { color: dayColor }]}>Day {day + 1}</Text>
        </View>
        <View style={dc.legRow}>
          <Text style={dc.legFrom} numberOfLines={1}>{depName}</Text>
          {destination && (
            <>
              <Ionicons name="arrow-forward" size={10} color={Colors.textMuted} />
              <Text style={dc.legTo} numberOfLines={1}>{dstName}</Text>
            </>
          )}
        </View>
        {nm > 0 && (
          <View style={dc.nmPill}>
            <Text style={dc.nmPillText}>{nm} nm</Text>
          </View>
        )}
        {inModal && onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={dc.closeBtn}>
              <Ionicons name="close" size={16} color={Colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Day description */}
      {dayDetail?.description ? (
        <View style={dc.descBlock}>
          <Text style={dc.descText}>{dayDetail.description}</Text>
        </View>
      ) : null}

      {/* Timeline */}
      {(departure || destination || intermediate.length > 0) && (
        <View style={dc.timelineSection}>
          <Text style={dc.sectionLabel}>Along the way</Text>
          {departure && (
            <ReadonlyTimelineRow
              stop={departure} role={isInherited ? 'inherited' : 'departure'}
              dayColor={dayColor} hasLine={!!(intermediate.length > 0 || destination)}
            />
          )}
          {intermediate.map((stop, i) => (
            <ReadonlyTimelineRow
              key={stop.id} stop={stop} role="intermediate"
              dayColor={dayColor} hasLine={i < intermediate.length - 1 || !!destination}
            />
          ))}
          {destination && (
            <ReadonlyTimelineRow
              stop={destination} role="destination"
              dayColor={dayColor} hasLine={!!alt}
            />
          )}
          {alt && (
            <ReadonlyTimelineRow
              stop={alt} role="alt"
              dayColor={dayColor} hasLine={false}
            />
          )}
        </View>
      )}

      {/* Highlights */}
      {(dayDetail?.highlights ?? []).length > 0 && (
        <View style={dc.hlSection}>
          <Text style={dc.sectionLabel}>Highlights</Text>
          {dayDetail!.highlights!.map((h, i) => (
            <View key={i} style={dc.hlRow}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={dc.hlText}>{h}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Warnings */}
      {(dayDetail?.warnings ?? []).length > 0 && (
        <View style={dc.warnSection}>
          <Text style={dc.sectionLabel}>Heads up</Text>
          {dayDetail!.warnings!.map((w, i) => (
            <View key={i} style={dc.warnRow}>
              <Ionicons name="warning-outline" size={14} color={Colors.warning} />
              <Text style={dc.warnText}>{w}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  )

  if (inModal) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        bounces={false}
      >
        {content}
      </ScrollView>
    )
  }

  return <View style={dc.card}>{content}</View>
}

// ── ReadonlyTimelineRow ────────────────────────────────────────────────────────

type TimelineRole = 'departure' | 'inherited' | 'intermediate' | 'destination' | 'alt'

function ReadonlyTimelineRow({
  stop, role, dayColor, hasLine,
}: { stop: UserRouteStop; role: TimelineRole; dayColor: string; hasLine: boolean }) {
  const isAnchor = role === 'departure' || role === 'inherited' || role === 'destination'
  const isAlt    = role === 'alt'
  const dotColor =
    role === 'departure' || role === 'inherited' ? '#22C55E' :
    role === 'destination'                       ? '#1B6CA8' :
    role === 'alt'                               ? '#F97316' :
    STOP_TYPE_COLORS[stop.type ?? 'CUSTOM'] ?? Colors.textMuted
  const roleLabel =
    role === 'departure'   ? 'Departure' :
    role === 'inherited'   ? 'Overnight arrival' :
    role === 'destination' ? 'Destination' :
    role === 'alt'         ? 'Alt. Destination' :
    STOP_TYPE_LABELS[stop.type ?? 'CUSTOM'] ?? 'Stop'
  const dotIcon =
    role === 'departure' || role === 'inherited' ? 'boat-outline' :
    role === 'destination'                       ? 'flag' :
    role === 'alt'                               ? 'git-branch-outline' : null

  const isIntermediate = role === 'intermediate'
  const emoji  = isIntermediate ? (USER_STOP_CONFIG[stop.type ?? 'CUSTOM']?.emoji ?? '📍') : null
  const title  = isIntermediate ? stopTitle(stop)       : (stop.name ?? roleLabel)
  const desc   = isIntermediate ? stopDescription(stop) : (stop.description ?? null)

  return (
    <View style={tl.row}>
      <View style={tl.col}>
        {isAnchor || isAlt ? (
          <View style={[tl.anchorDot, { backgroundColor: dotColor, borderColor: dotColor + '30' }]}>
            {dotIcon && <Ionicons name={dotIcon as any} size={11} color="#fff" />}
          </View>
        ) : (
          // Rich emoji circle — matches curated route tlStopDot
          <View style={[tl.stopCircle, { backgroundColor: dotColor + '20', borderColor: dotColor + '50' }]}>
            <Text style={tl.stopEmoji}>{emoji}</Text>
          </View>
        )}
        {hasLine && (
          <View style={[tl.line, { backgroundColor: isAlt ? '#F9731638' : dayColor + '30' }]} />
        )}
      </View>
      <View style={tl.body}>
        {/* Title */}
        <Text style={[tl.name, (isAnchor || isAlt) && tl.anchorName]} numberOfLines={1}>
          {title}
        </Text>
        {/* Type badge + optional Rec badge */}
        <View style={tl.metaRow}>
          <View style={[tl.roleBadge, { backgroundColor: dotColor + '14' }]}>
            <Text style={[tl.roleBadgeText, { color: dotColor }]}>{roleLabel}</Text>
          </View>
          {stop.isRecommended && (
            <View style={[tl.recBadge, { backgroundColor: dotColor + '18' }]}>
              <Text style={[tl.recBadgeText, { color: dotColor }]}>★ Rec</Text>
            </View>
          )}
        </View>
        {/* Description */}
        {desc ? (
          <Text style={tl.desc} numberOfLines={2}>{desc}</Text>
        ) : null}
        {/* Duration */}
        {(stop.durationMins ?? 0) > 0 && (
          <Text style={tl.duration}>
            ~{stop.durationMins! < 60
              ? `${stop.durationMins}min`
              : `${Math.round(stop.durationMins! / 60)}h`}
          </Text>
        )}
      </View>
    </View>
  )
}

// ── RouteCommentCard — exact copy of PlaceDetailScreen CommentCard ─────────────

function RouteCommentCard({
  comment, isLast, isOwn, isAuthor, onDelete,
}: {
  comment: RouteComment
  isLast: boolean
  isOwn: boolean
  isAuthor: boolean
  onDelete: () => void
}) {
  const color  = avatarColor(comment.userName)
  const abbrev = initials(comment.userName)
  const date   = timeAgo(comment.createdAt)
  return (
    <View style={[cr.commentCard, !isLast && cr.commentCardBorder]}>
      <View style={[cr.commentAvatar, { backgroundColor: color }]}>
        <Text style={cr.commentAvatarText}>{abbrev}</Text>
      </View>
      <View style={cr.commentBody}>
        <View style={cr.commentHeader}>
          <Text style={cr.commentAuthor}>{comment.userName}</Text>
          {isAuthor && (
            <View style={[cr.authorBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
              <Text style={[cr.authorBadgeText, { color }]}>Author</Text>
            </View>
          )}
          <Text style={cr.commentDate}>{date}</Text>
          {isOwn && (
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={13} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={cr.commentText}>{comment.text}</Text>
      </View>
    </View>
  )
}

// ── RatingBlock ────────────────────────────────────────────────────────────────

const STAR_COLORS = ['', '#EF4444', '#F87171', '#F59E0B', '#22C55E', '#16A34A']
const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

function RatingBlock({
  myRating, avgRating, ratingCount, onRate,
}: {
  myRating: number
  avgRating: number | null
  ratingCount: number
  onRate: (star: number) => void
}) {
  const [pendingStar, setPendingStar] = useState<number | null>(null)
  const [changing, setChanging]       = useState(false)

  // Whether the user is actively selecting
  const interactive = myRating === 0 || changing

  const handleStarPress = (star: number) => {
    if (!interactive) return
    setPendingStar(star)
  }

  const handleConfirm = () => {
    if (pendingStar == null) return
    onRate(pendingStar)
    setPendingStar(null)
    setChanging(false)
  }

  const handleCancel = () => {
    setPendingStar(null)
    if (changing) setChanging(false)
  }

  // Which star value to display (preview pending before confirm)
  const displayRating = pendingStar ?? (interactive ? 0 : myRating)
  const displayColor  = displayRating > 0 ? STAR_COLORS[displayRating] : Colors.border

  return (
    <View style={s.ratingBlock}>
      {/* Title row */}
      <View style={s.ratingBlockHeader}>
        <Text style={s.ratingBlockTitle}>Rate this route</Text>
        {ratingCount > 0 && (
          <Text style={s.ratingBlockCount}>
            {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
          </Text>
        )}
      </View>

      {/* Stars — interactive when no rating yet or in change mode */}
      <View style={s.ratingStarsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleStarPress(star)}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            activeOpacity={interactive ? 0.7 : 1}
            disabled={!interactive}
          >
            <Ionicons
              name={star <= displayRating ? 'star' : 'star-outline'}
              size={36}
              color={star <= displayRating ? displayColor : Colors.border}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* State-driven sub-text */}
      {pendingStar != null ? (
        // ── Confirmation prompt ──
        <View style={s.ratingConfirmBlock}>
          <Text style={s.ratingConfirmQuestion}>
            Rate this route {pendingStar} {pendingStar === 1 ? 'star' : 'stars'}?
          </Text>
          <View style={s.ratingConfirmRow}>
            <TouchableOpacity
              style={s.ratingCancelBtn}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Text style={s.ratingCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.ratingConfirmBtn, { backgroundColor: STAR_COLORS[pendingStar] }]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={s.ratingConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : myRating > 0 && !changing ? (
        // ── Locked state ──
        <View style={s.ratingLockedBlock}>
          <Text style={[s.ratingLockedLabel, { color: STAR_COLORS[myRating] }]}>
            {STAR_LABELS[myRating]} — your rating
          </Text>
          <TouchableOpacity
            onPress={() => setChanging(true)}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Text style={s.ratingChangeBtn}>Change rating</Text>
          </TouchableOpacity>
        </View>
      ) : changing ? (
        <Text style={s.ratingPrompt}>Select a new rating</Text>
      ) : (
        <Text style={s.ratingPrompt}>Tap a star to rate</Text>
      )}

      {/* Aggregate */}
      {avgRating !== null && (
        <View style={s.ratingAggRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={star <= Math.round(avgRating) ? 'star' : 'star-outline'}
              size={13}
              color={star <= Math.round(avgRating) ? '#F59E0B' : Colors.border}
            />
          ))}
          <Text style={s.ratingAggNum}>{avgRating.toFixed(1)}</Text>
          <Text style={s.ratingAggLabel}>avg</Text>
        </View>
      )}
    </View>
  )
}

// ── StatBox ────────────────────────────────────────────────────────────────────

function StatBox({ icon, value, label, iconColor }: { icon: string; value: string; label: string; iconColor?: string }) {
  return (
    <View style={s.statBox}>
      <Ionicons name={icon as any} size={20} color={iconColor ?? Colors.secondary} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

// ── Main styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  goBackBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  goBackBtnText: { color: '#fff', fontWeight: '700' },

  // Hero — identical to RouteDetailScreen
  heroContainer: { position: 'relative', height: HERO_H },
  heroImage: { width: '100%', height: HERO_H, backgroundColor: Colors.secondary + '18' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  heroScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, backgroundColor: 'rgba(0,0,0,0.22)' },
  heroScrimDeep: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, backgroundColor: 'rgba(0,0,0,0.48)' },
  heroTitleRow: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 18,
  },
  heroTitleLeft: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 28, marginBottom: 4 },
  heroRegion: { fontSize: 14, color: 'rgba(255,255,255,0.82)', fontWeight: '500' },
  backBtn: {
    position: 'absolute', left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  heroEditBtn: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  heroEditBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  bookmarkBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.40)', alignItems: 'center', justifyContent: 'center',
    marginLeft: 12, flexShrink: 0,
  },

  // Body — identical to RouteDetailScreen
  body: { padding: 20 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' },
  communityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.secondary + '14', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  communityBadgeText: { fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  diffBadge: { backgroundColor: Colors.secondary + '10', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  diffBadgeText: { fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  inlineMapBtn: {
    marginLeft: 'auto' as any,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.secondary,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  inlineMapText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statBox: {
    flex: 1, minWidth: '22%', backgroundColor: '#fff', borderRadius: 12, padding: 12,
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textMuted },

  // Rating block — bottom section card
  ratingBlock: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 14, marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  ratingBlockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' as any },
  ratingBlockTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  ratingBlockCount: { fontSize: 13, color: Colors.textMuted },
  ratingStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingPrompt: { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic' },
  ratingAggRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  ratingAggNum: { fontSize: 13, fontWeight: '700', color: Colors.text, marginLeft: 5 },
  ratingAggLabel: { fontSize: 12, color: Colors.textMuted, marginLeft: 2 },

  // Inline confirmation
  ratingConfirmBlock: { alignItems: 'center', gap: 10, width: '100%' as any },
  ratingConfirmQuestion: { fontSize: 15, fontWeight: '600', color: Colors.text, textAlign: 'center' as const },
  ratingConfirmRow: { flexDirection: 'row', gap: 10 },
  ratingCancelBtn: {
    paddingVertical: 9, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  ratingCancelText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  ratingConfirmBtn: {
    paddingVertical: 9, paddingHorizontal: 24,
    borderRadius: 10,
  },
  ratingConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Locked state
  ratingLockedBlock: { alignItems: 'center', gap: 6 },
  ratingLockedLabel: { fontSize: 15, fontWeight: '700' },
  ratingChangeBtn: { fontSize: 13, fontWeight: '600', color: Colors.secondary, textDecorationLine: 'underline' as const },

  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 24, marginBottom: 16 },

  tag: { backgroundColor: Colors.secondary + '14', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 13, color: Colors.secondary },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 10 },

  // Author block
  authorBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorBlockLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  authorAvatarText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  authorInfo: { flex: 1 },
  authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  authorName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  authorMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  youBadge: { backgroundColor: Colors.secondary + '18', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  youBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.secondary },
  followPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.secondary, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  followPillActive: { backgroundColor: Colors.secondary + '12', borderWidth: 1, borderColor: Colors.secondary + '40' },
  followPillText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  followPillTextActive: { color: Colors.secondary },
  editPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.secondary + '12', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.secondary + '30' },
  editPillText: { fontSize: 12, fontWeight: '700', color: Colors.secondary },

  mapPreviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.secondary + '10', borderRadius: 14, padding: 14, marginVertical: 12,
    borderWidth: 1, borderColor: Colors.secondary + '25',
  },
  mapPreviewText: { flex: 1, fontSize: 15, color: Colors.secondary, fontWeight: '600' },

  // Comments section (exact copy of PlaceDetailScreen)
  commentsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  commentCountPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.secondary + '15', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  commentCountPillText: { fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  commentsEmpty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  commentsEmptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  commentsEmptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  commentsList: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },

  // Composer
  composer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: Colors.border },
  composerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  composerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  composerAvatarText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  composerInput: { flex: 1, backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  composerTextArea: { minHeight: 90, textAlignVertical: 'top' as const, paddingTop: 10 },
  composerSubmit: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  composerSubmitText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Sticky action bar
  actionBar: {
    backgroundColor: '#fff', flexDirection: 'row', gap: 12,
    paddingTop: 14, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  saveActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  saveActionBtnActive: { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '40' },
  saveActionBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  saveActionBtnTextActive: { color: Colors.primary },
  shareActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.secondary + '10', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Colors.secondary + '30' },
  shareActionBtnText: { fontSize: 14, fontWeight: '700', color: Colors.secondary },
  mapActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.secondary, borderRadius: 12, paddingVertical: 12 },
  mapActionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Day modal
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
})

// ── Itinerary styles ──────────────────────────────────────────────────────────

const it = StyleSheet.create({
  wrapper: { marginTop: 4, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  sectionSub: { fontSize: 13, color: Colors.textMuted, marginBottom: 14 },
  stripScroll: { marginHorizontal: -20 },
  strip: { paddingLeft: 20, paddingRight: 8, flexDirection: 'row' },
  card: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderLeftWidth: 4,
    marginRight: CARD_GAP,
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.09, shadowRadius: 8, elevation: 3,
  },
  cardDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dayBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  dayBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  typeDot: { width: 7, height: 7, borderRadius: 3.5 },
  routeLine: { flex: 1, justifyContent: 'center', gap: 4 },
  fromName: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  arrowRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  arrowLine: { flex: 1, height: 1 },
  arrowCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  toName: { fontSize: 14, fontWeight: '800', color: Colors.text },
  cardFooter: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  statPill: { backgroundColor: Colors.background, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statPillText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
})

// ── DayCard styles ─────────────────────────────────────────────────────────────

const dc = StyleSheet.create({
  card: { backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border, borderLeftWidth: 3 },
  dayBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  dayBadgeText: { fontSize: 12, fontWeight: '800' },
  legRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, overflow: 'hidden' },
  legFrom: { fontSize: 13, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  legTo: { fontSize: 13, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  nmPill: { backgroundColor: Colors.primary + '10', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  nmPillText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  descBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  descText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },
  timelineSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  hlSection: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, backgroundColor: '#F8FFFA' },
  hlRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 },
  hlText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 19 },
  warnSection: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, backgroundColor: '#FFFBF5' },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 },
  warnText: { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 19 },
})

// ── TimelineRow styles ─────────────────────────────────────────────────────────

const tl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 2 },
  // Widened to accommodate 28px emoji circles alongside 26px anchor dots
  col: { width: 32, alignItems: 'center', flexShrink: 0 },
  anchorDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 2 },
  // Rich emoji circle for intermediate stops — mirrors curated tlStopDot
  stopCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stopEmoji: { fontSize: 14 },
  line: { width: 1.5, flex: 1, minHeight: 18, marginTop: 3, borderRadius: 1 },
  body: { flex: 1, paddingTop: 2, paddingBottom: 14 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  anchorName: { fontSize: 14, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  roleBadge: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  roleBadgeText: { fontSize: 10, fontWeight: '700' },
  recBadge: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  recBadgeText: { fontSize: 10, fontWeight: '700' },
  desc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 4 },
  duration: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
})

// ── CommentCard + StarPicker styles (exact copy of PlaceDetailScreen) ────────

const cr = StyleSheet.create({
  commentCard: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  commentCardBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentAuthor: { fontSize: 14, fontWeight: '700', color: Colors.text },
  commentDate: { fontSize: 12, color: Colors.textMuted, marginLeft: 'auto' as any },
  authorBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  authorBadgeText: { fontSize: 10, fontWeight: '800' },
  commentText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
})
