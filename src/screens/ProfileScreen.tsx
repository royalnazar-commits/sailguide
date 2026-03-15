import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, Alert, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { useContributorStore } from '../store/contributorStore'
import { BADGE_CONFIGS, BADGE_CATEGORY_ORDER, LEVELS, BadgeId, BadgeCategory } from '../types/contributor'
import { LevelBadge } from '../components/LevelBadge'
import { Colors } from '../constants/colors'
import { usePlacesStore } from '../store/placesStore'
import { useRouteBuilderStore } from '../store/routeBuilderStore'

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  CARTOGRAPHY:  'Cartography',
  PHOTOGRAPHY:  'Photography',
  COMMUNITY:    'Community',
  NAVIGATION:   'Navigation',
  REPUTATION:   'Reputation',
  MILESTONES:   'Milestones',
}

export default function ProfileScreen() {
  const { user, clearAuth } = useAuthStore()
  const { userStats, recentActivity } = useProfileStore()
  const { userPlaces } = usePlacesStore()
  const { savedRoutes } = useRouteBuilderStore()
  const { totalPoints, currentLevel, progressToNextLevel, pointsToNextLevel, earnedBadges } = useContributorStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'achievements'>('overview')

  const completedRoutes = userStats.routesCompleted
  const savedRoutesCount = userStats.routesSaved
  const totalMiles = userStats.nauticalMiles

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

  if (!user) {
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

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={36} color={Colors.secondary} />
          </View>
        )}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user.name}</Text>
            {user.isVerifiedCaptain && (
              <Ionicons name="shield-checkmark" size={18} color={Colors.verified} />
            )}
          </View>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.memberSince}>
            Member since {new Date(userStats.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon!')}>
          <Ionicons name="pencil" size={16} color={Colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <StatCard icon="map" value={completedRoutes} label="Routes" color={Colors.primary} />
        <StatCard icon="bookmark" value={savedRoutesCount} label="Saved" color={Colors.secondary} />
        <StatCard icon="location" value={userPlaces.length} label="Places" color="#00B4D8" />
        <StatCard icon="boat" value={`${totalMiles}nm`} label="Miles" color={Colors.success} />
      </View>

      {/* Captain Dashboard button — only visible for captains */}
      {user.role === 'CAPTAIN' && (
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

      {/* ── Contributor Level Card ──────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contributor Level</Text>
        <View style={styles.contributorCard}>
          {/* Level badge */}
          <LevelBadge points={totalPoints} size="md" />

          {/* Points + progress */}
          <View style={styles.contributorMeta}>
            <View style={styles.contributorPointsRow}>
              <Text style={styles.contributorPoints}>{totalPoints} pts</Text>
              {currentLevel.level < 5 && (
                <Text style={styles.contributorNextLevel}>
                  {pointsToNextLevel()} to {LEVELS[currentLevel.level].name}
                </Text>
              )}
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progressToNextLevel() * 100)}%` as any, backgroundColor: currentLevel.color },
                ]}
              />
            </View>
            {currentLevel.level === 5 ? (
              <Text style={styles.contributorMaxed}>Maximum level reached</Text>
            ) : (
              <Text style={styles.contributorHint}>
                {Math.round(progressToNextLevel() * 100)}% to Level {currentLevel.level + 1}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Bio Section */}
      {user.bio && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.bio}>{user.bio}</Text>
          </View>
        </View>
      )}

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' && styles.activeTab]}
          onPress={() => setActiveTab('activity')}
        >
          <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}>Activity</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'achievements' && styles.activeTab]}
          onPress={() => setActiveTab('achievements')}
        >
          <Text style={[styles.tabText, activeTab === 'achievements' && styles.activeTabText]}>Achievements</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <View>
          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.card}>
              <MenuItem icon="map-outline" label="Browse Routes" onPress={() => router.push('/(tabs)/catalog')} />
              <View style={styles.divider} />
              <MenuItem icon="location-outline" label="My Places" badge={userPlaces.length || undefined} onPress={() => router.push('/my-places')} />
              <View style={styles.divider} />
              <MenuItem icon="map-outline" label="My Routes" badge={savedRoutes.length || undefined} onPress={() => router.push('/my-routes')} />
              <View style={styles.divider} />
              <MenuItem icon="star-outline" label="My Reviews" onPress={() => Alert.alert('Reviews', 'Review management coming soon!')} />
              <View style={styles.divider} />
              <MenuItem icon="bookmark-outline" label="Saved Routes" onPress={() => router.push('/(tabs)/trips')} />
            </View>
          </View>
        </View>
      )}

      {activeTab === 'activity' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.card}>
            {recentActivity.map((activity, index) => (
              <View key={activity.id}>
                <ActivityItem activity={activity} />
                {index < recentActivity.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>
      )}

      {activeTab === 'achievements' && (
        <View>
          {BADGE_CATEGORY_ORDER.map((category) => {
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
          })}
        </View>
      )}

      {/* Settings Menu */}
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

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// Component: Contributor Badge (for contributor badges in Achievements tab)
function ContributorBadge({
  title, description, icon, color, earned, earnedAt,
}: { title: string; description: string; icon: string; color: string; earned: boolean; earnedAt?: string }) {
  return (
    <View style={[styles.achievementBadge, !earned && styles.achievementLocked]}>
      <View style={[styles.achievementIcon, { backgroundColor: earned ? color + '20' : undefined }, !earned && styles.achievementIconLocked]}>
        <Ionicons
          name={(earned ? icon : 'lock-closed') as any}
          size={24}
          color={earned ? color : Colors.textMuted}
        />
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

// Component: Stat Card
function StatCard({ icon, value, label, color }: { icon: any; value: string | number; label: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// Component: Activity Item
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

// Component: Menu Item
function MenuItem({ icon, label, onPress, danger, badge }: any) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#fff', padding: 20, paddingTop: 60,
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 20, fontWeight: '700', color: Colors.text },
  email: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  memberSince: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center',
  },

  // Stats
  statsContainer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 16 },
  captainDashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.verified + '40',
    gap: 12,
  },
  captainDashLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  captainDashIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.verified + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captainDashTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  captainDashSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 8,
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textMuted },

  // Sections
  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  bio: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, padding: 16 },

  // Contributor level card
  contributorCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  contributorMeta: { gap: 6 },
  contributorPointsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  contributorPoints: { fontSize: 22, fontWeight: '800', color: Colors.text },
  contributorNextLevel: { fontSize: 13, color: Colors.textMuted },
  progressBar: {
    height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  contributorHint: { fontSize: 12, color: Colors.textMuted },
  contributorMaxed: { fontSize: 12, color: Colors.success, fontWeight: '600' },

  // Achievement date
  achievementDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },

  // Tabs
  tabContainer: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20,
    marginTop: 20, borderRadius: 12, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  activeTabText: { color: '#fff' },

  // Activity
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  activityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  activitySubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  activityDate: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },

  // Achievements
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

  // Menu
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  menuLabel: { flex: 1, fontSize: 15, color: Colors.text },
  menuBadge: { backgroundColor: Colors.accent + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  menuBadgeText: { fontSize: 12, color: Colors.secondary, fontWeight: '700' },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  // Login state
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  centerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  loginBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40,
  },
  loginText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
