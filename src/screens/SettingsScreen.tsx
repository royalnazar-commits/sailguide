import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Switch, Alert
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../store/authStore'
import { Colors } from '../constants/colors'

export default function SettingsScreen() {
  const { user, clearAuth } = useAuthStore()
  const [pushNotifications, setPushNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [locationServices, setLocationServices] = useState(true)
  const [offlineMaps, setOfflineMaps] = useState(false)

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
    router.replace('/login')
    return null
  }

  return (
    <ScrollView style={styles.container}>
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
            onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon!')} 
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="key-outline" 
            label="Change Password" 
            onPress={() => Alert.alert('Change Password', 'Password change coming soon!')} 
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="mail-outline" 
            label="Email Preferences" 
            onPress={() => Alert.alert('Email', 'Email preferences coming soon!')} 
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="shield-outline" 
            label="Privacy & Security" 
            onPress={() => Alert.alert('Privacy', 'Privacy settings coming soon!')} 
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
            value={pushNotifications}
            onValueChange={setPushNotifications}
          />
          <View style={styles.divider} />
          <ToggleItem 
            icon="mail-outline"
            label="Email Notifications"
            description="Weekly sailing reports and tips"
            value={emailNotifications}
            onValueChange={setEmailNotifications}
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
            value={locationServices}
            onValueChange={setLocationServices}
          />
          <View style={styles.divider} />
          <ToggleItem 
            icon="download-outline"
            label="Offline Maps"
            description="Download maps for offline use"
            value={offlineMaps}
            onValueChange={setOfflineMaps}
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="refresh-outline" 
            label="Clear Cache" 
            onPress={() => Alert.alert('Clear Cache', 'This will clear cached route data and images.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', onPress: () => Alert.alert('Success', 'Cache cleared successfully!') }
            ])} 
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
            onPress={() => Alert.alert('Help', 'Help center coming soon!')} 
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="chatbubble-outline" 
            label="Contact Support" 
            onPress={() => Alert.alert('Contact', 'Support contact coming soon!')} 
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="star-outline" 
            label="Rate App" 
            onPress={() => Alert.alert('Rate App', 'Thank you! App Store rating coming soon.')} 
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="information-circle-outline" 
            label="About" 
            onPress={() => Alert.alert('About SailGuide', 'Version 1.0.0\n\nSailGuide is your trusted sailing companion for discovering and navigating Mediterranean routes.\n\n© 2024 SailGuide Team')} 
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
            onPress={() => Alert.alert('Terms', 'Terms of Service coming soon!')} 
          />
          <View style={styles.divider} />
          <SettingsItem 
            icon="shield-checkmark-outline" 
            label="Privacy Policy" 
            onPress={() => Alert.alert('Privacy', 'Privacy Policy coming soon!')} 
          />
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
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
            onPress={() => Alert.alert('Delete Account', 'This action cannot be undone. Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Account Deletion', 'Account deletion process will be available in a future update.') }
            ])}
            danger
          />
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

function SettingsItem({ icon, label, onPress, danger = false }: {
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

function ToggleItem({ icon, label, description, value, onValueChange }: {
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
        trackColor={{ false: Colors.border, true: Colors.primary + '40' }}
        thumbColor={value ? Colors.primary : '#f4f3f4'}
      />
    </View>
  )
}

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
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },

  settingsItem: { 
    flexDirection: 'row', alignItems: 'center', gap: 14, 
    padding: 16, minHeight: 56 
  },
  settingsLabel: { flex: 1, fontSize: 15, color: Colors.text },

  toggleItem: { 
    flexDirection: 'row', alignItems: 'center', gap: 14, 
    padding: 16, minHeight: 64 
  },
  toggleContent: { flex: 1 },
  toggleLabel: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  toggleDescription: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
})