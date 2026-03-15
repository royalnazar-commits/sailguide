import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getLevelForPoints, LEVELS } from '../types/contributor'

interface Props {
  /** Pass either a level number (1–5) or the user's total points */
  level?: number
  points?: number
  /** 'xs' = inline pill in comment/card  'sm' = standalone badge  'md' = profile card */
  size?: 'xs' | 'sm' | 'md'
}

export function LevelBadge({ level, points, size = 'sm' }: Props) {
  const config = points !== undefined
    ? getLevelForPoints(points)
    : LEVELS.find((l) => l.level === level) ?? LEVELS[0]

  if (size === 'xs') {
    return (
      <View style={[styles.xsPill, { backgroundColor: config.color + '18', borderColor: config.color + '50' }]}>
        <Ionicons name={config.icon as any} size={10} color={config.color} />
        <Text style={[styles.xsText, { color: config.color }]}>{config.name}</Text>
      </View>
    )
  }

  if (size === 'sm') {
    return (
      <View style={[styles.smPill, { backgroundColor: config.color + '15', borderColor: config.color + '40' }]}>
        <Ionicons name={config.icon as any} size={12} color={config.color} />
        <Text style={[styles.smText, { color: config.color }]}>Lvl {config.level} · {config.name}</Text>
      </View>
    )
  }

  // md — used in profile contributor card
  return (
    <View style={[styles.mdBadge, { backgroundColor: config.color + '12', borderColor: config.color + '35' }]}>
      <View style={[styles.mdIconCircle, { backgroundColor: config.color + '20' }]}>
        <Ionicons name={config.icon as any} size={28} color={config.color} />
      </View>
      <View style={styles.mdInfo}>
        <Text style={[styles.mdLevel, { color: config.color }]}>Level {config.level}</Text>
        <Text style={[styles.mdName, { color: config.color }]}>{config.name}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // xs — tiny pill for comment headers
  xsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  xsText: { fontSize: 10, fontWeight: '700' },

  // sm — standalone badge for cards / route lists
  smPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  smText: { fontSize: 12, fontWeight: '600' },

  // md — large display for profile
  mdBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1.5,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  mdIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  mdInfo: { gap: 2 },
  mdLevel: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  mdName:  { fontSize: 20, fontWeight: '800' },
})
