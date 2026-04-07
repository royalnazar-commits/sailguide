import React from 'react'
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Colors } from '../constants/colors'

interface Props {
  name: string
  avatarUrl?: string
  isVerified?: boolean
  subtitle?: string
  /** When provided, tapping the badge navigates to /user/[userId] */
  userId?: string
}

export function CaptainBadge({ name, avatarUrl, isVerified, subtitle, userId }: Props) {
  const handlePress = userId ? () => router.push(`/user/${userId}`) : undefined

  const inner = (
    <>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={20} color={Colors.secondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {isVerified && (
            <Ionicons name="shield-checkmark" size={16} color={Colors.verified} />
          )}
        </View>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {userId && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
    </>
  )

  if (handlePress) {
    return (
      <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    )
  }

  return <View style={styles.container}>{inner}</View>
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.secondary + '15', alignItems: 'center', justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
})