import React from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch, Alert, Linking,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { safeStorage } from '../utils/storage'
import { Colors } from '../constants/colors'

const APP_VERSION = '1.0.0'

export default function SettingsScreen() {
  const { user, clearAuth } = useAuthStore()
  const { preferences, updatePreferences } = useProfileStore()

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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Confirm Deletion',
              'Type "DELETE" to confirm. This action is irreversible.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete everything',
                  style: 'destructive',
                  onPress: async () => {
                    await clearAuth()
                    router.replace('/login')
                  },
                },
              ],
            ),
        },
      ],
    )
  }

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove cached route data and map tiles. Your saved routes will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await safeStorage.removeItem('routeCache')
            await safeStorage.removeItem('mapTileCache')
            Alert.alert('Done', 'Cache cleared successfully.')
          },
        },
      ],
    )
  }

  const openURL = (url: string) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open link', 'Please visit sailguide.app for support.'),
    )
  }

  if (!user) {
    router.replace('/login')
    return null
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <SettingsItem
            icon="person-outline"
            label="Edit Profile"
            onPress={() => router.push('/profile')}
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="key-outline"
            label="Change Password"
            onPress={() =>
              openURL('mailto:support@sailguide.app?subject=Password%20Reset%20Request')
            }
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="shield-outline"
            label="Privacy & Security"
            onPress={() => openURL('https://sailguide.app/privacy')}
          />
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <ToggleItem
            icon="notifications-outline"
            label="Push Notifications"
            description="Route updates and sailing alerts"
            value={preferences.pushNotifications}
            onValueChange={(v) => updatePreferences({ pushNotifications: v })}
          />
          <View style={styles.divider} />
          <ToggleItem
            icon="mail-outline"
            label="Email Notifications"
            description="Weekly sailing reports and tips"
            value={preferences.emailNotifications}
            onValueChange={(v) => updatePreferences({ emailNotifications: v })}
          />
        </View>
      </View>

      {/* App Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Settings</Text>
        <View style={styles.card}>
          <ToggleItem
            icon="location-outline"
            label="Location Services"
            description="For nearby marinas and weather"
            value={preferences.locationServices}
            onValueChange={(v) => updatePreferences({ locationServices: v })}
          />
          <View style={styles.divider} />
          <ToggleItem
            icon="download-outline"
            label="Offline Maps"
            description="Download maps for offline use"
            value={preferences.offlineMaps}
            onValueChange={(v) => updatePreferences({ offlineMaps: v })}
          />
          <View style={styles.divider} />
          <SegmentItem
            icon="speedometer-outline"
            label="Distance Unit"
            options={['nm', 'km']}
            value={preferences.distanceUnit}
            onSelect={(v) => updatePreferences({ distanceUnit: v as 'nm' | 'km' })}
          />
          <View style={styles.divider} />
          <SegmentItem
            icon="thermometer-outline"
            label="Temperature"
            options={['C', 'F']}
            value={preferences.temperatureUnit}
            onSelect={(v) => updatePreferences({ temperatureUnit: v as 'C' | 'F' })}
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="refresh-outline"
            label="Clear Cache"
            onPress={handleClearCache}
          />
        </View>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          <SettingsItem
            icon="help-circle-outline"
            label="Help Center"
            onPress={() => openURL('https://sailguide.app/help')}
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="chatbubble-outline"
            label="Contact Support"
            onPress={() => openURL('mailto:support@sailguide.app')}
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="star-outline"
            label="Rate SailGuide"
            onPress={() => openURL('https://apps.apple.com/app/sailguide')}
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="information-circle-outline"
            label="About"
            onPress={() =>
              Alert.alert(
                'About SailGuide',
                `Version ${APP_VERSION}\n\nYour trusted sailing companion for discovering and navigating Mediterranean routes.\n\n© ${new Date().getFullYear()} SailGuide`,
              )
            }
          />
        </View>
      </View>

      {/* Legal Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.card}>
          <SettingsItem
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => openURL('https://sailguide.app/terms')}
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => openURL('https://sailguide.app/privacy')}
          />
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <View style={styles.card}>
          <SettingsItem
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleLogout}
            danger
          />
          <View style={styles.divider} />
          <SettingsItem
            icon="trash-outline"
            label="Delete Account"
            onPress={handleDeleteAccount}
            danger
          />
        </View>
      </View>
    </ScrollView>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SettingsItem({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: string
  label: string
  onPress: () => void
  danger?: boolean
}) {
  return (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={danger ? Colors.danger : Colors.textSecondary} />
      <Text style={[styles.settingsLabel, danger && { color: Colors.danger }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  )
}

function ToggleItem({
  icon,
  label,
  description,
  value,
  onValueChange,
}: {
  icon: string
  label: string
  description: string
  value: boolean
  onValueChange: (value: boolean) => void
}) {
  return (
    <View style={styles.toggleItem}>
      <Ionicons name={icon as any} size={20} color={Colors.textSecondary} />
      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.border, true: Colors.secondary }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  )
}

function SegmentItem({
  icon,
  label,
  options,
  value,
  onSelect,
}: {
  icon: string
  label: string
  options: string[]
  value: string
  onSelect: (v: string) => void
}) {
  return (
    <View style={styles.segmentItem}>
      <Ionicons name={icon as any} size={20} color={Colors.textSecondary} />
      <Text style={styles.segmentLabel}>{label}</Text>
      <View style={styles.segmentControl}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.segmentBtn, value === opt && styles.segmentBtnActive]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[styles.segmentBtnText, value === opt && styles.segmentBtnTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
    backgroundColor: '#fff',
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },

  section: { marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },

  settingsItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, minHeight: 56,
  },
  settingsLabel: { flex: 1, fontSize: 15, color: Colors.text },

  toggleItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, minHeight: 64,
  },
  toggleContent: { flex: 1 },
  toggleLabel: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  toggleDescription: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  segmentItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, minHeight: 56,
  },
  segmentLabel: { flex: 1, fontSize: 15, color: Colors.text },
  segmentControl: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  segmentBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentBtnText: {
    fontSize: 13, fontWeight: '600', color: Colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: '#fff',
  },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
})
