import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Alert, TextInput,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSocialStore, PublicProfile } from '../store/socialStore'
import { useAuthStore } from '../store/authStore'
import { LevelBadge } from '../components/LevelBadge'
import { Colors } from '../constants/colors'

export default function FollowListScreen() {
  const { type, userId: targetId } = useLocalSearchParams<{ type: string; userId?: string }>()
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const {
    following,
    followUser,
    unfollowUser,
    isFollowing,
    getProfile,
    getFollowerProfiles,
    getFollowingProfiles,
    getSuggestedProfiles,
  } = useSocialStore()

  const [query, setQuery] = useState('')

  const isOwnList = !targetId || targetId === user?.id
  const targetProfile = targetId ? getProfile(targetId) : undefined

  const title = useMemo(() => {
    const base = type === 'followers' ? 'Followers' : 'Following'
    if (!isOwnList && targetProfile) {
      const firstName = targetProfile.name.split(' ')[0]
      return `${firstName}'s ${base}`
    }
    return base
  }, [type, isOwnList, targetProfile])

  // Resolve full list for this type + target
  const rawList: PublicProfile[] = useMemo(() => {
    const uid = targetId ?? user?.id ?? ''
    return type === 'following'
      ? getFollowingProfiles(uid)
      : getFollowerProfiles(uid)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, targetId, user?.id, following])

  // Search filter
  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rawList
    return rawList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.username?.toLowerCase().includes(q),
    )
  }, [rawList, query])

  // Suggested captains — only shown on own following list
  const suggested = useMemo(() => {
    if (!isOwnList || type !== 'following') return []
    return getSuggestedProfiles([...following, user?.id ?? ''])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwnList, type, following, user?.id])

  const handleUnfollow = (profile: PublicProfile) => {
    Alert.alert(
      `Unfollow ${profile.name}?`,
      'You will stop seeing this captain in your following list.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: () => unfollowUser(profile.id),
        },
      ],
    )
  }

  const suggestedSection =
    suggested.length > 0 ? (
      <View style={styles.suggestedSection}>
        <View style={styles.suggestedHeader}>
          <Ionicons name="compass-outline" size={14} color={Colors.secondary} />
          <Text style={styles.suggestedTitle}>Suggested Captains</Text>
        </View>
        {suggested.map((profile, idx) => (
          <React.Fragment key={profile.id}>
            <UserRow
              profile={profile}
              following={isFollowing(profile.id)}
              onFollow={() => followUser(profile.id)}
              onUnfollow={() => handleUnfollow(profile)}
              onPress={() => router.push(`/user/${profile.id}`)}
            />
            {idx < suggested.length - 1 && <View style={styles.separator} />}
          </React.Fragment>
        ))}
      </View>
    ) : null

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
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{rawList.length}</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or username…"
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={filteredList}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View>
            {query.trim() ? (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No results for "{query}"</Text>
                <Text style={styles.emptySub}>Try a different name or handle.</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="compass-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>
                  {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                </Text>
                <Text style={styles.emptySub}>
                  {type === 'following'
                    ? 'Follow experienced sailors to discover routes, anchorages and local knowledge.'
                    : 'Your followers will appear here.'}
                </Text>
              </View>
            )}
            {/* Show suggested only in empty state when no search query */}
            {!query.trim() && suggestedSection}
          </View>
        }
        ListFooterComponent={
          /* Show suggested below the list too (when list has results) */
          filteredList.length > 0 ? suggestedSection : null
        }
        renderItem={({ item }) => (
          <UserRow
            profile={item}
            following={isFollowing(item.id)}
            onFollow={() => followUser(item.id)}
            onUnfollow={() => handleUnfollow(item)}
            onPress={() => router.push(`/user/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  )
}

// ── User row ──────────────────────────────────────────────────────────────────

function UserRow({
  profile,
  following,
  onFollow,
  onUnfollow,
  onPress,
}: {
  profile: PublicProfile
  following: boolean
  onFollow: () => void
  onUnfollow: () => void
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      {/* Avatar */}
      {profile.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={22} color={Colors.secondary} />
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.isVerifiedCaptain && (
            <Ionicons name="shield-checkmark" size={13} color={Colors.verified} />
          )}
        </View>
        {profile.username ? (
          <Text style={styles.handle}>@{profile.username}</Text>
        ) : null}
        {profile.bio ? (
          <Text style={styles.bio} numberOfLines={1}>{profile.bio}</Text>
        ) : null}
        <LevelBadge points={profile.contributorPoints} size="xs" />
      </View>

      {/* Follow / Following button */}
      <TouchableOpacity
        style={[styles.followBtn, following && styles.followingBtn]}
        onPress={(e) => { e.stopPropagation(); following ? onUnfollow() : onFollow() }}
        activeOpacity={0.8}
      >
        <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
          {following ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10,
  },
  backBtn: {},
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.text },
  countPill: {
    backgroundColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  countText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1, fontSize: 15, color: Colors.text,
    backgroundColor: Colors.background,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
  },

  list: { padding: 16 },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 76 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, flexShrink: 0 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text },
  handle: { fontSize: 12, color: Colors.textMuted },
  bio: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  followBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    flexShrink: 0,
  },
  followingBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5, borderColor: Colors.secondary,
  },
  followBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  followingBtnText: { color: Colors.secondary },

  empty: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 60, paddingBottom: 24, gap: 12, paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  emptySub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  suggestedSection: { marginTop: 16 },
  suggestedHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: 10,
  },
  suggestedTitle: {
    fontSize: 13, fontWeight: '700',
    color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
})
