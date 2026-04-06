import React, { useState, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Alert, ScrollView, Modal, TextInput,
  KeyboardAvoidingView, Platform, Pressable, Linking,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { useContributorStore } from '../store/contributorStore'
import { BADGE_CONFIGS, BADGE_CATEGORY_ORDER, LEVELS, BadgeId, BadgeCategory, getLevelForPoints } from '../types/contributor'
import { LevelBadge } from '../components/LevelBadge'
import { Colors } from '../constants/colors'
import { usePlacesStore } from '../store/placesStore'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { useSocialStore } from '../store/socialStore'
import { saveUserProfile, fetchUserProfile, FirestoreUserProfile } from '../lib/userService'
import { getOrCreateConversation } from '../lib/chatService'
import { UserRoute } from '../types/userRoute'
import { Signal, getCategoryMeta, deleteSignal, subscribeToActiveSignals } from '../lib/signalService'

// ── Category labels ───────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  CARTOGRAPHY:  'Cartography',
  PHOTOGRAPHY:  'Photography',
  COMMUNITY:    'Community',
  NAVIGATION:   'Navigation',
  REPUTATION:   'Reputation',
  MILESTONES:   'Milestones',
}

type Tab = 'routes' | 'places' | 'signals' | 'activity' | 'achievements'

const TAB_CONFIG: { key: Tab; label: string; icon: string }[] = [
  { key: 'routes',       label: 'Routes',       icon: 'map-outline'      },
  { key: 'places',       label: 'Places',       icon: 'location-outline' },
  { key: 'signals',      label: 'Signals',      icon: 'radio-outline'    },
  { key: 'activity',     label: 'Activity',     icon: 'time-outline'     },
  { key: 'achievements', label: 'Achievements', icon: 'trophy-outline'   },
]

// ── Unified ProfileScreen ─────────────────────────────────────────────────────

export default function ProfileScreen() {
  // URL params — absent on the tab, present when navigating to another user
  const { id: idParam, name: nameParam } = useLocalSearchParams<{ id?: string; name?: string }>()

  // Own-profile data
  const { user, clearAuth, updateUser } = useAuthStore()
  const { userStats, recentActivity } = useProfileStore()
  const { userPlaces } = usePlacesStore()
  const { savedRoutes, getAllPublishedRoutes } = useRouteBuilderStore()
  const { totalPoints, currentLevel, progressToNextLevel, pointsToNextLevel, earnedBadges } = useContributorStore()
  const {
    following: followingList,
    isFollowing,
    followUser,
    unfollowUser,
    getFollowerProfiles,
    getFollowingProfiles,
    getProfile,
  } = useSocialStore()

  const insets = useSafeAreaInsets()

  // Determine mode
  const isOwnProfile = !idParam || idParam === user?.id
  const targetUserId = isOwnProfile ? (user?.id ?? '') : idParam!

  // ── Other-user data ─────────────────────────────────────────────────────────
  const demoProfile = isOwnProfile ? undefined : getProfile(targetUserId)
  const [firestoreProfile, setFirestoreProfile] = useState<FirestoreUserProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(!isOwnProfile && !demoProfile)

  useEffect(() => {
    if (isOwnProfile || demoProfile) return
    setLoadingProfile(true)
    fetchUserProfile(targetUserId).then((p) => {
      setFirestoreProfile(p)
      setLoadingProfile(false)
    })
  }, [targetUserId])

  // ── Signal data ──────────────────────────────────────────────────────────────
  const [allSignals, setAllSignals] = useState<Signal[]>([])
  const [deletingSignalId, setDeletingSignalId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToActiveSignals(setAllSignals)
    return unsub
  }, [])

  const userSignals = useMemo(
    () => allSignals.filter((s) => s.userId === targetUserId),
    [allSignals, targetUserId],
  )

  const handleDeleteSignal = async (signalId: string) => {
    setDeletingSignalId(signalId)
    try {
      await deleteSignal(signalId)
    } finally {
      setDeletingSignalId(null)
    }
  }

  // ── Derived display values ──────────────────────────────────────────────────
  const displayName: string = (() => {
    if (isOwnProfile) return user?.name ?? 'Sailor'
    if (demoProfile) return demoProfile.name
    if (firestoreProfile) return firestoreProfile.name
    return nameParam ?? targetUserId ?? 'Sailor'
  })()

  const displayBio: string | undefined = (() => {
    if (isOwnProfile) return user?.bio
    if (demoProfile) return demoProfile.bio
    return firestoreProfile?.bio ?? undefined
  })()

  const displayAvatar: string | undefined = (() => {
    if (isOwnProfile) return user?.avatarUrl
    if (demoProfile) return demoProfile.avatarUrl
    return firestoreProfile?.avatarUrl ?? undefined
  })()

  const isVerified: boolean = (() => {
    if (isOwnProfile) return user?.isVerifiedCaptain ?? false
    if (demoProfile) return demoProfile.isVerifiedCaptain
    return firestoreProfile?.isVerifiedCaptain ?? false
  })()

  const contributorPoints: number = (() => {
    if (isOwnProfile) return totalPoints
    if (demoProfile) return demoProfile.contributorPoints
    return firestoreProfile?.contributorPoints ?? 0
  })()

  const placesCount: number = (() => {
    if (isOwnProfile) return userPlaces.length
    if (demoProfile) return demoProfile.placesAdded
    return 0
  })()

  const otherUserRoutes = useMemo(
    () => getAllPublishedRoutes().filter((r) => r.createdBy === targetUserId),
    [targetUserId, savedRoutes],
  )

  const routesCount: number = (() => {
    if (isOwnProfile) return savedRoutes.length
    if (demoProfile) return demoProfile.routesCreated
    return firestoreProfile?.routesCreated ?? otherUserRoutes.length
  })()

  const memberSince: string | undefined = (() => {
    if (isOwnProfile) return userStats.memberSince ?? user?.createdAt
    if (demoProfile) return demoProfile.memberSince
    return undefined
  })()

  // Contributor level for other user
  const otherLevel = useMemo(() => getLevelForPoints(contributorPoints), [contributorPoints])
  const displayLevel = isOwnProfile ? currentLevel : otherLevel

  // Social counts
  const followersCount = useMemo(
    () => getFollowerProfiles(targetUserId).length,
    [targetUserId, followingList],
  )
  const followingCount = useMemo(
    () => {
      if (isOwnProfile) return followingList.length
      return getFollowingProfiles(targetUserId).length
    },
    [targetUserId, followingList],
  )

  const amFollowing = isFollowing(targetUserId)

  // ── Own-profile UI state ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('routes')
  const [editVisible, setEditVisible] = useState(false)

  // Edit form state
  const [editName, setEditName]           = useState('')
  const [editBio, setEditBio]             = useState('')
  const [editMessenger, setEditMessenger] = useState('')
  const [editInstagram, setEditInstagram] = useState('')
  const [editYachtName, setEditYachtName] = useState('')
  const [editYachtType, setEditYachtType] = useState('')
  const [editYachtLen, setEditYachtLen]   = useState('')
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null)

  // Other-user messaging state
  const [messaging, setMessaging] = useState(false)

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth()
          router.replace('/login')
        },
      },
    ])
  }

  const openEdit = () => {
    setEditName(user?.name ?? '')
    setEditBio(user?.bio ?? '')
    setEditMessenger(user?.messenger ?? '')
    setEditInstagram(user?.instagram ?? '')
    setEditYachtName(user?.yachtName ?? '')
    setEditYachtType(user?.yachtType ?? '')
    setEditYachtLen(user?.yachtLengthM != null ? String(user.yachtLengthM) : '')
    setEditAvatarUri(null)
    setEditVisible(true)
  }

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your profile picture.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setEditAvatarUri(result.assets[0].uri)
    }
  }

  const saveEdit = async () => {
    const name = editName.trim()
    if (!name) return
    const updates = {
      name,
      bio:          editBio.trim() || undefined,
      messenger:    editMessenger.trim() || undefined,
      instagram:    editInstagram.trim().replace(/^@/, '') || undefined,
      yachtName:    editYachtName.trim() || undefined,
      yachtType:    editYachtType.trim() || undefined,
      yachtLengthM: editYachtLen ? parseFloat(editYachtLen) : undefined,
      ...(editAvatarUri ? { avatarUrl: editAvatarUri } : {}),
    }
    await updateUser(updates)
    setEditVisible(false)
    if (user) {
      const updatedUser = { ...user, ...updates }
      saveUserProfile(updatedUser, totalPoints, savedRoutes.length)
    }
  }

  const handleMessage = async () => {
    if (!user || messaging) return
    setMessaging(true)
    try {
      const convId = await getOrCreateConversation(
        user.id, user.name,
        targetUserId, displayName,
      )
      router.push(`/chat/${convId}?otherName=${encodeURIComponent(displayName)}`)
    } finally {
      setMessaging(false)
    }
  }

  const handleFollowToggle = () => {
    if (amFollowing) {
      Alert.alert(
        `Unfollow ${displayName}?`,
        'You will stop seeing this captain in your following list.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Unfollow', style: 'destructive', onPress: () => unfollowUser(targetUserId) },
        ],
      )
    } else {
      followUser(targetUserId)
    }
  }

  // Detect messenger type and return icon/color/url metadata
  const getContactMeta = (value: string): { icon: string; color: string; url: string; handle: string } => {
    const v = value.trim()
    if (/^\+?\d[\d\s\-().]{5,}$/.test(v)) {
      return { icon: 'logo-whatsapp', color: '#25D366', url: `https://wa.me/${v.replace(/\D/g, '')}`, handle: v }
    }
    if (v.startsWith('@') || v.toLowerCase().includes('t.me/')) {
      const domain = v.startsWith('@') ? v.slice(1) : (v.split('/').pop() ?? v)
      return { icon: 'send', color: '#2CA5E0', url: `tg://resolve?domain=${domain}`, handle: v.startsWith('@') ? v : `@${domain}` }
    }
    return { icon: 'chatbubble-outline', color: Colors.secondary, url: '', handle: v }
  }

  // ── Signed-out own profile ──────────────────────────────────────────────────
  if (isOwnProfile && !user) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-circle-outline" size={60} color={Colors.textMuted} />
        <Text style={styles.centerTitle}>Sign in to access your profile</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
          <Text style={styles.loginText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Other-user top bar ──────────────────────────────────────────────────────
  const renderOtherUserTopBar = () => (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={22} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.topBarTitle}>Sailor Profile</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={handleMessage}
          disabled={messaging}
          activeOpacity={0.8}
        >
          {messaging
            ? <ActivityIndicator size="small" color={Colors.secondary} />
            : <Ionicons name="chatbubble-outline" size={16} color={Colors.secondary} />
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.followBtn, amFollowing && styles.followingBtn]}
          onPress={handleFollowToggle}
          activeOpacity={0.8}
        >
          <Ionicons
            name={amFollowing ? 'checkmark' : 'add'}
            size={14}
            color={amFollowing ? Colors.secondary : '#fff'}
          />
          <Text style={[styles.followBtnText, amFollowing && styles.followingBtnText]}>
            {amFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  // ── Shared profile card ─────────────────────────────────────────────────────
  const renderProfileCard = () => (
    <>
      {isOwnProfile ? (
        // Own profile: side-by-side row layout with edit button
        <View style={styles.ownHeader}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.ownAvatar} />
          ) : (
            <View style={styles.ownAvatarPlaceholder}>
              <Ionicons name="person" size={36} color={Colors.secondary} />
            </View>
          )}
          <View style={styles.ownUserInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{displayName}</Text>
              {isVerified && (
                <Ionicons name="shield-checkmark" size={18} color={Colors.verified} />
              )}
            </View>
            {displayBio ? (
              <Text style={styles.bio} numberOfLines={2}>{displayBio}</Text>
            ) : (
              <Text style={styles.email}>{user?.email}</Text>
            )}
            {(user?.messenger || user?.instagram) ? (
              <View style={styles.contactRow}>
                {user.messenger ? (() => {
                  const meta = getContactMeta(user.messenger)
                  return <ContactIcon icon={meta.icon} color={meta.color} url={meta.url} handle={meta.handle} />
                })() : null}
                {user.instagram ? (
                  <ContactIcon
                    icon="logo-instagram"
                    color="#E1306C"
                    url={`instagram://user?username=${user.instagram}`}
                    handle={`@${user.instagram}`}
                    urlFallback={`https://instagram.com/${user.instagram}`}
                  />
                ) : null}
              </View>
            ) : null}
            {memberSince ? (
              <Text style={styles.memberSince}>
                Member since {new Date(memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={openEdit} activeOpacity={0.8}>
            <Ionicons name="pencil" size={16} color={Colors.secondary} />
          </TouchableOpacity>
        </View>
      ) : (
        // Other user: centered card layout
        <View style={styles.publicProfileCard}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.publicAvatar} />
          ) : (
            <View style={styles.publicAvatarPlaceholder}>
              <Ionicons name="person" size={32} color={Colors.secondary} />
            </View>
          )}
          <View style={styles.publicNameRow}>
            <Text style={styles.name}>{displayName}</Text>
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={13} color={Colors.verified} />
                <Text style={styles.verifiedText}>Captain</Text>
              </View>
            )}
          </View>
          {displayBio ? (
            <Text style={styles.publicBio}>{displayBio}</Text>
          ) : null}
          {memberSince ? (
            <Text style={styles.memberSince}>
              Member since {new Date(memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </Text>
          ) : null}
        </View>
      )}

      {/* Yacht pill — own profile only */}
      {isOwnProfile && user?.yachtName ? (
        <View style={styles.yachtPill}>
          <Ionicons name="boat-outline" size={14} color={Colors.secondary} />
          <Text style={styles.yachtPillText}>
            {user.yachtName}{user.yachtType ? ` · ${user.yachtType}` : ''}{user.yachtLengthM ? ` · ${user.yachtLengthM}m` : ''}
          </Text>
        </View>
      ) : null}
    </>
  )

  // ── Shared stats rows ───────────────────────────────────────────────────────
  const renderStatsRows = () => (
    <>
      <View style={styles.statsRow}>
        <StatCard
          icon="map-outline"
          value={routesCount}
          label="Routes"
          color={Colors.primary}
          onPress={isOwnProfile ? () => router.push('/my-routes') : undefined}
        />
        <StatCard
          icon="location-outline"
          value={placesCount}
          label="Places"
          color="#00B4D8"
          onPress={isOwnProfile ? () => router.push('/my-places') : undefined}
        />
        <StatCard
          icon="flash-outline"
          value={contributorPoints}
          label="Points"
          color="#F59E0B"
        />
      </View>

      {/* Social stats */}
      <View style={[styles.statsRow, { marginTop: isOwnProfile ? 10 : 0 }]}>
        <StatCard
          icon="person-add-outline"
          value={followersCount}
          label="Followers"
          color="#8B5CF6"
          onPress={isOwnProfile
            ? () => router.push('/follow-list?type=followers')
            : () => router.push(`/follow-list?type=followers&userId=${targetUserId}`)
          }
        />
        <StatCard
          icon="people-outline"
          value={followingCount}
          label="Following"
          color={Colors.success}
          onPress={isOwnProfile
            ? () => router.push('/follow-list?type=following')
            : () => router.push(`/follow-list?type=following&userId=${targetUserId}`)
          }
        />
      </View>
    </>
  )

  // ── Shared contributor level section ────────────────────────────────────────
  const renderContributorLevel = () => {
    const pts = contributorPoints
    const lvl = displayLevel
    const isMaxLevel = lvl.level === 5

    let progressValue = 0
    let ptsToNext = 0
    if (isOwnProfile) {
      progressValue = progressToNextLevel()
      ptsToNext = pointsToNextLevel()
    } else {
      if (!isMaxLevel) {
        const nextLevel = LEVELS[lvl.level] // index = level (0-based off by one, so lvl.level gives next)
        const range = nextLevel.minPoints - lvl.minPoints
        progressValue = range > 0 ? (pts - lvl.minPoints) / range : 0
        ptsToNext = nextLevel.minPoints - pts
      }
    }

    return (
      <View style={isOwnProfile ? styles.section : styles.publicSection}>
        <Text style={styles.sectionTitle}>Contributor Level</Text>
        <View style={styles.contributorCard}>
          <LevelBadge points={pts} size="md" />
          <View style={styles.contributorMeta}>
            <View style={styles.contributorPointsRow}>
              <Text style={styles.contributorPoints}>{pts} pts</Text>
              {!isMaxLevel && (
                <Text style={styles.contributorNextLevel}>
                  {ptsToNext} to {LEVELS[lvl.level].name}
                </Text>
              )}
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progressValue * 100)}%` as any, backgroundColor: lvl.color },
                ]}
              />
            </View>
            {isMaxLevel ? (
              <Text style={styles.contributorMaxed}>Maximum level reached</Text>
            ) : (
              <Text style={styles.contributorHint}>
                {Math.round(progressValue * 100)}% to Level {lvl.level + 1}
              </Text>
            )}
          </View>
        </View>
      </View>
    )
  }

  // ── Unified tab content (own + other user) ──────────────────────────────────
  const renderTabContent = () => {
    // Routes data
    const routesList = isOwnProfile ? savedRoutes : otherUserRoutes

    return (
      <>
        <View style={styles.tabRow}>
          {TAB_CONFIG.map(({ key, label, icon }) => {
            const active = activeTab === key
            const showBadge = key === 'signals' && userSignals.length > 0
            return (
              <TouchableOpacity
                key={key}
                style={[styles.tab, active && styles.activeTab]}
                onPress={() => setActiveTab(key)}
                activeOpacity={0.75}
              >
                <View style={styles.tabIconWrap}>
                  <Ionicons
                    name={icon as any}
                    size={16}
                    color={active ? Colors.primary : Colors.textMuted}
                  />
                  {showBadge && (
                    <View style={[styles.tabBadge, { backgroundColor: active ? Colors.primary : '#22C55E' }]} />
                  )}
                </View>
                <Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Routes tab */}
        {activeTab === 'routes' && (
          <View style={styles.section}>
            {routesList.length === 0 ? (
              <EmptyState
                icon="map-outline"
                message={isOwnProfile ? 'No routes yet' : 'No published routes yet'}
                action={isOwnProfile ? 'Build a Route' : 'Explore Routes'}
                onAction={() => router.push(isOwnProfile ? '/(tabs)/trips' : '/(tabs)/explore')}
              />
            ) : (
              <View style={styles.card}>
                {routesList.map((route, i) => (
                  <View key={route.id}>
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => isOwnProfile
                        ? router.push('/my-routes')
                        : router.push(`/user-route/${route.id}`)
                      }
                      activeOpacity={0.7}
                    >
                      <View style={[styles.listItemIcon, { backgroundColor: Colors.primary + '15' }]}>
                        <Ionicons name="map-outline" size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.listItemContent}>
                        <Text style={styles.listItemTitle} numberOfLines={1}>
                          {route.title || 'Untitled Route'}
                        </Text>
                        <Text style={styles.listItemSub}>
                          {route.stops.length} stops · {route.totalNm} nm
                          {route.status === 'PUBLISHED' ? ' · Published' : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                    {i < routesList.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Places tab */}
        {activeTab === 'places' && (
          <View style={styles.section}>
            {!isOwnProfile ? (
              <EmptyState
                icon="location-outline"
                message="Places are private"
                action="Explore Map"
                onAction={() => router.push('/(tabs)/explore')}
              />
            ) : userPlaces.length === 0 ? (
              <EmptyState
                icon="location-outline"
                message="No places added yet"
                action="Explore Map"
                onAction={() => router.push('/(tabs)/explore')}
              />
            ) : (
              <View style={styles.card}>
                {userPlaces.map((place, i) => (
                  <View key={place.id}>
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => router.push('/my-places')}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.listItemIcon, { backgroundColor: '#00B4D8' + '15' }]}>
                        <Ionicons name="location-outline" size={18} color="#00B4D8" />
                      </View>
                      <View style={styles.listItemContent}>
                        <Text style={styles.listItemTitle} numberOfLines={1}>{place.name}</Text>
                        <Text style={styles.listItemSub}>
                          {place.type} · {place.region}
                          {place.status === 'PUBLISHED' ? ' · Published' : ''}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                    {i < userPlaces.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Signals tab */}
        {activeTab === 'signals' && (
          <View style={styles.section}>
            {userSignals.length === 0 ? (
              <EmptyState
                icon="radio-outline"
                message="No active signals"
                action={isOwnProfile ? 'Post a Signal' : 'Explore Map'}
                onAction={() => router.push('/(tabs)/explore')}
              />
            ) : (
              userSignals.map((sig) => {
                const meta = getCategoryMeta(sig.category)
                const mins = sig.createdAt
                  ? Math.floor((Date.now() - sig.createdAt.toMillis()) / 60000)
                  : null
                const ageLabel = mins === null ? '' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`
                const sigActive = mins !== null && mins < 120
                return (
                  <View key={sig.id} style={[styles.signalCard, { borderLeftColor: meta.color }]}>
                    <View style={styles.signalCardHeader}>
                      <View style={[styles.signalPill, { backgroundColor: meta.color + '15', borderColor: meta.color + '35' }]}>
                        <Text style={styles.signalPillEmoji}>{meta.emoji}</Text>
                        <Text style={[styles.signalPillLabel, { color: meta.color }]}>{sig.category}</Text>
                      </View>
                      {sigActive
                        ? <View style={styles.signalActive}>
                            <View style={styles.signalActiveDot} />
                            <Text style={styles.signalActiveText}>Active</Text>
                          </View>
                        : <Text style={styles.signalAgeText}>{ageLabel}</Text>
                      }
                    </View>
                    <View style={[styles.signalBubble, { backgroundColor: meta.color + '10', borderColor: meta.color + '25' }]}>
                      <Text style={styles.signalBubbleText}>{sig.text}</Text>
                    </View>
                    {isOwnProfile ? (
                      <TouchableOpacity
                        style={styles.signalDeleteBtn}
                        onPress={() => handleDeleteSignal(sig.id)}
                        disabled={deletingSignalId === sig.id}
                        activeOpacity={0.8}
                      >
                        {deletingSignalId === sig.id
                          ? <ActivityIndicator size="small" color={Colors.danger} />
                          : <>
                              <Ionicons name="trash-outline" size={13} color={Colors.danger} />
                              <Text style={styles.signalDeleteText}>Remove Signal</Text>
                            </>
                        }
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.signalChatBtn, { backgroundColor: meta.color }]}
                        onPress={handleMessage}
                        activeOpacity={0.84}
                      >
                        <Ionicons name="chatbubble" size={13} color="#fff" />
                        <Text style={styles.signalChatText}>Message about this signal</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })
            )}
          </View>
        )}

        {/* Activity tab */}
        {activeTab === 'activity' && (
          <View style={styles.section}>
            {!isOwnProfile ? (
              <EmptyState
                icon="time-outline"
                message="Activity is private"
                action="Explore Map"
                onAction={() => router.push('/(tabs)/explore')}
              />
            ) : (
              <View style={styles.card}>
                {recentActivity.length === 0 ? (
                  <View style={styles.emptyInline}>
                    <Text style={styles.emptyInlineText}>No recent activity</Text>
                  </View>
                ) : recentActivity.map((activity, index) => (
                  <View key={activity.id}>
                    <ActivityItem activity={activity} />
                    {index < recentActivity.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Achievements tab */}
        {activeTab === 'achievements' && (
          <View>
            {!isOwnProfile ? (
              <View style={styles.section}>
                <EmptyState
                  icon="trophy-outline"
                  message="Achievements are private"
                  action="Explore Map"
                  onAction={() => router.push('/(tabs)/explore')}
                />
              </View>
            ) : (
              BADGE_CATEGORY_ORDER.map((category) => {
                const badgesInCategory = (Object.keys(BADGE_CONFIGS) as BadgeId[]).filter(
                  (id) => BADGE_CONFIGS[id].category === category,
                )
                return (
                  <View key={category} style={styles.section}>
                    <Text style={styles.sectionTitle}>{CATEGORY_LABELS[category]}</Text>
                    <View style={styles.achievementsGrid}>
                      {badgesInCategory.map((badgeId) => {
                        const config = BADGE_CONFIGS[badgeId]
                        const earned = earnedBadges.find((b) => b.badgeId === badgeId)
                        return (
                          <ContributorBadge
                            key={badgeId}
                            title={config.title}
                            description={config.description}
                            icon={config.icon}
                            color={config.color}
                            earned={!!earned}
                            earnedAt={earned?.earnedAt}
                          />
                        )
                      })}
                    </View>
                  </View>
                )
              })
            )}
          </View>
        )}
      </>
    )
  }

  // ── Edit profile modal ──────────────────────────────────────────────────────
  const renderEditModal = () => (
    <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditVisible(false)} />
        <View style={[styles.editSheet, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={() => setEditVisible(false)} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Avatar picker */}
            <TouchableOpacity style={styles.avatarPickerWrap} onPress={pickPhoto} activeOpacity={0.8}>
              {editAvatarUri || user?.avatarUrl ? (
                <Image
                  source={{ uri: editAvatarUri ?? user?.avatarUrl }}
                  style={styles.avatarPickerImg}
                />
              ) : (
                <View style={[styles.avatarPickerImg, styles.avatarPickerPlaceholder]}>
                  <Ionicons name="person" size={32} color={Colors.secondary} />
                </View>
              )}
              <View style={styles.avatarPickerOverlay}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Section: Profile */}
            <EditSectionHeader icon="person-outline" label="Profile" />

            <FieldLabel label="Name" required />
            <TextInput
              style={styles.fieldInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />

            <FieldLabel label="Bio" />
            <TextInput
              style={[styles.fieldInput, styles.fieldMulti]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Sailor, adventurer, coffee addict…"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Section: Contact */}
            <EditSectionHeader icon="call-outline" label="Contact" />

            <FieldLabel label="Messenger" />
            <TextInput
              style={styles.fieldInput}
              value={editMessenger}
              onChangeText={setEditMessenger}
              placeholder="WhatsApp +1 234 567 890 or @telegram"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FieldLabel label="Instagram" />
            <View style={styles.fieldWithPrefix}>
              <Text style={styles.fieldPrefix}>@</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldPrefixed]}
                value={editInstagram}
                onChangeText={setEditInstagram}
                placeholder="username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Section: Yacht */}
            <EditSectionHeader icon="boat-outline" label="Yacht" />

            <FieldLabel label="Yacht name" />
            <TextInput
              style={styles.fieldInput}
              value={editYachtName}
              onChangeText={setEditYachtName}
              placeholder="e.g. Sea Wanderer"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <FieldLabel label="Type" />
                <TextInput
                  style={styles.fieldInput}
                  value={editYachtType}
                  onChangeText={setEditYachtType}
                  placeholder="Sloop, Ketch…"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                />
              </View>
              <View style={{ width: 100 }}>
                <FieldLabel label="Length (m)" />
                <TextInput
                  style={styles.fieldInput}
                  value={editYachtLen}
                  onChangeText={setEditYachtLen}
                  placeholder="12.5"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Actions */}
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditVisible(false)} activeOpacity={0.8}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !editName.trim() && styles.saveBtnDisabled]}
                onPress={saveEdit}
                activeOpacity={0.8}
                disabled={!editName.trim()}
              >
                <Text style={styles.saveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )

  // ── Unified layout ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      {!isOwnProfile && renderOtherUserTopBar()}

      {loadingProfile ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {renderProfileCard()}

          {renderStatsRows()}

          {/* Captain Dashboard — own profile only */}
          {isOwnProfile && user?.role === 'CAPTAIN' && (
            <TouchableOpacity
              style={styles.captainDashBtn}
              onPress={() => router.push('/captain-dashboard')}
              activeOpacity={0.85}
            >
              <View style={styles.captainDashLeft}>
                <View style={styles.captainDashIcon}>
                  <Ionicons name="shield-checkmark" size={20} color={Colors.verified} />
                </View>
                <View>
                  <Text style={styles.captainDashTitle}>Captain Dashboard</Text>
                  <Text style={styles.captainDashSub}>Manage your routes, places & pricing</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          {renderContributorLevel()}

          {renderTabContent()}

          {/* Settings — own profile only */}
          {isOwnProfile && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Settings</Text>
              <View style={styles.card}>
                <MenuItem icon="settings-outline" label="Account Settings" onPress={() => router.push('/settings')} />
                <View style={styles.divider} />
                <MenuItem icon="notifications-outline" label="Notifications" onPress={() => Alert.alert('Notifications', 'Notification settings coming soon!')} />
                <View style={styles.divider} />
                <MenuItem icon="help-circle-outline" label="Help & Support" onPress={() => Alert.alert('Help', 'Help center coming soon!')} />
                <View style={styles.divider} />
                <MenuItem icon="information-circle-outline" label="About SailGuide" onPress={() => Alert.alert('About', 'Version 1.0.0\n\nSailGuide is your trusted sailing companion for discovering and navigating Mediterranean routes.')} />
                <View style={styles.divider} />
                <MenuItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} danger />
              </View>
            </View>
          )}

          {isOwnProfile && renderEditModal()}
        </ScrollView>
      )}
    </View>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContactIcon({ icon, color, url, handle, urlFallback }: {
  icon: string; color: string; url: string; handle: string; urlFallback?: string
}) {
  const onPress = () => {
    if (!url) return
    Linking.openURL(url).catch(() => urlFallback && Linking.openURL(urlFallback!).catch(() => {}))
  }
  return (
    <TouchableOpacity style={styles.contactIcon} onPress={onPress} activeOpacity={0.7} hitSlop={6}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={styles.contactHandle} numberOfLines={1}>{handle}</Text>
    </TouchableOpacity>
  )
}

function EditSectionHeader({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.editSectionHeader}>
      <Ionicons name={icon} size={14} color={Colors.secondary} />
      <Text style={styles.editSectionLabel}>{label}</Text>
    </View>
  )
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}{required ? <Text style={{ color: Colors.danger }}> *</Text> : null}
    </Text>
  )
}

function EmptyState({ icon, message, action, onAction }: {
  icon: any; message: string; action: string; onAction: () => void
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={36} color={Colors.textMuted} />
      <Text style={styles.emptyStateText}>{message}</Text>
      <TouchableOpacity style={styles.emptyStateBtn} onPress={onAction} activeOpacity={0.8}>
        <Text style={styles.emptyStateBtnText}>{action}</Text>
      </TouchableOpacity>
    </View>
  )
}

function ContributorBadge({
  title, description, icon, color, earned, earnedAt,
}: { title: string; description: string; icon: string; color: string; earned: boolean; earnedAt?: string }) {
  return (
    <View style={[styles.achievementBadge, !earned && styles.achievementLocked]}>
      <View style={[styles.achievementIcon, { backgroundColor: earned ? color + '20' : undefined }, !earned && styles.achievementIconLocked]}>
        <Ionicons name={(earned ? icon : 'lock-closed') as any} size={24} color={earned ? color : Colors.textMuted} />
      </View>
      <Text style={[styles.achievementTitle, !earned && styles.achievementTitleLocked]}>{title}</Text>
      <Text style={[styles.achievementDesc, !earned && styles.achievementDescLocked]}>{description}</Text>
      {earned && earnedAt && (
        <Text style={styles.achievementDate}>
          {new Date(earnedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
        </Text>
      )}
    </View>
  )
}

function StatCard({ icon, value, label, color, onPress }: {
  icon: any; value: string | number; label: string; color: string; onPress?: () => void
}) {
  const inner = (
    <>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {onPress && <View style={[styles.statTapDot, { backgroundColor: color + '60' }]} />}
    </>
  )
  if (onPress) {
    return (
      <TouchableOpacity style={[styles.statCard, { borderWidth: 1.5, borderColor: color + '40' }]} onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    )
  }
  return <View style={styles.statCard}>{inner}</View>
}

function ActivityItem({ activity }: { activity: any }) {
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: activity.iconColor + '15' }]}>
        <Ionicons name={activity.icon} size={16} color={activity.iconColor} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{activity.title}</Text>
        <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
        <Text style={styles.activityDate}>{new Date(activity.date).toLocaleDateString('en-GB')}</Text>
      </View>
    </View>
  )
}

function MenuItem({ icon, label, onPress, danger, badge }: any) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={danger ? Colors.danger : Colors.textSecondary} />
      <Text style={[styles.menuLabel, danger && { color: Colors.danger }]}>{label}</Text>
      {badge !== undefined && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  )
}


// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Other-user top bar ────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn: {},
  topBarTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  messageBtn: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: Colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.secondary,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  followingBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5, borderColor: Colors.secondary,
  },
  followBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: Colors.secondary },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Own profile header row ────────────────────────────────────────────────
  ownHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#fff', padding: 20, paddingTop: 60,
  },
  ownAvatar: { width: 72, height: 72, borderRadius: 36 },
  ownAvatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  ownUserInfo: { flex: 1 },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },

  // ── Other user centered profile card ─────────────────────────────────────
  publicProfileCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  publicAvatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 14 },
  publicAvatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  publicNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  publicBio: {
    fontSize: 14, color: Colors.textSecondary, lineHeight: 20,
    textAlign: 'center', marginBottom: 8,
  },

  // ── Shared name/bio/contact ───────────────────────────────────────────────
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 20, fontWeight: '700', color: Colors.text },
  bio: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
  email: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  memberSince: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  contactIcon: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  contactHandle: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', flexShrink: 1 },

  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.verified + '15',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  verifiedText: { fontSize: 11, fontWeight: '600', color: Colors.verified },

  // ── Yacht pill ────────────────────────────────────────────────────────────
  yachtPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', marginHorizontal: 20, marginTop: 10,
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
  },
  yachtPillText: { fontSize: 13, color: Colors.secondary, fontWeight: '500' },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 16 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 8,
  },
  statTapDot: { width: 16, height: 2, borderRadius: 1 },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textMuted },

  // ── Signal cards ──────────────────────────────────────────────────────────
  signalCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 10,
    borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 4,
  },
  signalCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  signalPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  signalPillEmoji: { fontSize: 12 },
  signalPillLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  signalActive: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  signalActiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  signalActiveText: { fontSize: 11, fontWeight: '600', color: '#22C55E' },
  signalAgeText: { fontSize: 11, color: Colors.textMuted },
  signalBubble: {
    borderRadius: 16, borderTopLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  signalBubbleText: {
    fontSize: 15, fontWeight: '600', color: Colors.text, lineHeight: 22,
  },
  signalDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.danger + '35', borderRadius: 10,
  },
  signalDeleteText: { fontSize: 13, fontWeight: '600', color: Colors.danger },
  signalChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  signalChatText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // ── Captain dashboard ─────────────────────────────────────────────────────
  captainDashBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 20, marginTop: 14,
    borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: Colors.verified + '40', gap: 12,
  },
  captainDashLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  captainDashIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.verified + '15', alignItems: 'center', justifyContent: 'center',
  },
  captainDashTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  captainDashSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },

  // ── Contributor card ──────────────────────────────────────────────────────
  section: { marginTop: 20, paddingHorizontal: 20 },
  publicSection: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  contributorCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  contributorMeta: { gap: 6 },
  contributorPointsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  contributorPoints: { fontSize: 22, fontWeight: '800', color: Colors.text },
  contributorNextLevel: { fontSize: 13, color: Colors.textMuted },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  contributorHint: { fontSize: 12, color: Colors.textMuted },
  contributorMaxed: { fontSize: 12, color: Colors.success, fontWeight: '600' },

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 9,
    borderRadius: 10,
  },
  activeTab: { backgroundColor: Colors.primary + '12' },
  tabText: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, letterSpacing: 0.2 },
  activeTabText: { color: Colors.primary },
  tabIconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  tabBadge: {
    position: 'absolute', top: -2, right: -4,
    width: 7, height: 7, borderRadius: 4,
    borderWidth: 1.5, borderColor: '#fff',
  },

  // ── Shared card / list ────────────────────────────────────────────────────
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  listItemIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listItemContent: { flex: 1 },
  listItemTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  listItemSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },


  // ── Empty states ──────────────────────────────────────────────────────────
  emptyState: {
    backgroundColor: '#fff', borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 12,
  },
  emptyStateText: { fontSize: 15, color: Colors.textMuted, fontWeight: '500' },
  emptyStateBtn: {
    marginTop: 4, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.primary,
  },
  emptyStateBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  emptyInline: { padding: 24, alignItems: 'center' },
  emptyInlineText: { fontSize: 14, color: Colors.textMuted },

  // ── Activity ──────────────────────────────────────────────────────────────
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  activityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  activitySubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  activityDate: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  // ── Achievements ──────────────────────────────────────────────────────────
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  achievementBadge: {
    width: '48%', backgroundColor: '#fff', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 8,
  },
  achievementLocked: { opacity: 0.5 },
  achievementIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center',
  },
  achievementIconLocked: { backgroundColor: '#F1F5F9' },
  achievementTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  achievementTitleLocked: { color: Colors.textMuted },
  achievementDesc: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  achievementDescLocked: { color: Colors.textMuted },
  achievementDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  // ── Menu ──────────────────────────────────────────────────────────────────
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  menuLabel: { flex: 1, fontSize: 15, color: Colors.text },
  menuBadge: { backgroundColor: Colors.accent + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  menuBadgeText: { fontSize: 12, color: Colors.secondary, fontWeight: '700' },

  // ── Avatar picker (edit modal) ────────────────────────────────────────────
  avatarPickerWrap: {
    alignSelf: 'center', marginBottom: 24, position: 'relative',
  },
  avatarPickerImg: {
    width: 88, height: 88, borderRadius: 44,
  },
  avatarPickerPlaceholder: {
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  avatarPickerOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },

  // ── Edit Modal ────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  editSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 24,
    maxHeight: '92%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },

  editSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 14, marginTop: 8,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  editSectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, marginBottom: 14,
  },
  fieldMulti: { minHeight: 80, paddingTop: 12 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldWithPrefix: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  fieldPrefix: {
    fontSize: 16, color: Colors.textMuted, fontWeight: '600',
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border, borderRightWidth: 0,
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  fieldPrefixed: {
    flex: 1, marginBottom: 0,
    borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
  },

  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 8 },
  cancelBtn: {
    flex: 1, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 2, borderRadius: 14, backgroundColor: Colors.primary, paddingVertical: 14, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Sign-in prompt ────────────────────────────────────────────────────────
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  centerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  loginBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  loginText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
