import React, { useEffect, useRef } from 'react'
import {
  Animated, View, Text, StyleSheet, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useContributorStore } from '../store/contributorStore'
import { RewardItem } from '../types/contributor'
import { Colors } from '../constants/colors'

const DISPLAY_DURATION_MS = 4000
const SLIDE_DURATION_MS   = 300

// ── Reward toast overlay ──────────────────────────────────────────────────────

/**
 * Place this once at the root layout level.
 * It watches the contributor store's pendingRewards queue and
 * shows one animated toast at a time, auto-dismissing after 4 s.
 */
export function RewardToast() {
  const pendingRewards = useContributorStore((s) => s.pendingRewards)
  const dismissReward  = useContributorStore((s) => s.dismissReward)
  const insets         = useSafeAreaInsets()

  const current = pendingRewards[0] ?? null

  if (!current) return null

  return (
    <ToastCard
      key={current.id}
      reward={current}
      topOffset={insets.top + 8}
      onDismiss={() => dismissReward(current.id)}
    />
  )
}

// ── Individual toast card ─────────────────────────────────────────────────────

function ToastCard({ reward, topOffset, onDismiss }: { reward: RewardItem; topOffset: number; onDismiss: () => void }) {
  const slideY  = useRef(new Animated.Value(-120)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: SLIDE_DURATION_MS, useNativeDriver: true }),
    ]).start()

    // Auto-dismiss
    const timer = setTimeout(() => slideOut(onDismiss), DISPLAY_DURATION_MS)
    return () => clearTimeout(timer)
  }, [])

  const slideOut = (cb: () => void) => {
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -120, duration: SLIDE_DURATION_MS, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,    duration: SLIDE_DURATION_MS, useNativeDriver: true }),
    ]).start(cb)
  }

  const handleDismiss = () => slideOut(onDismiss)

  const { icon, color, title, subtitle } = resolveRewardDisplay(reward)

  return (
    <Animated.View
      style={[
        styles.card,
        { top: topOffset, transform: [{ translateY: slideY }], opacity, borderLeftColor: color },
      ]}
    >
      {/* Icon circle */}
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>

      {/* Text */}
      <View style={styles.textBlock}>
        <Text style={[styles.label, { color }]}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
      </View>

      {/* Dismiss */}
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Display helpers ───────────────────────────────────────────────────────────

function resolveRewardDisplay(reward: RewardItem): {
  icon: string; color: string; title: string; subtitle: string
} {
  if (reward.type === 'LEVEL_UP' && reward.level) {
    return {
      icon:     reward.level.icon,
      color:    reward.level.color,
      title:    `Level Up! You're now ${reward.level.name}`,
      subtitle: `You've reached Level ${reward.level.level}. Keep contributing!`,
    }
  }

  if (reward.type === 'BADGE_UNLOCK' && reward.badge) {
    return {
      icon:     reward.badge.icon,
      color:    reward.badge.color,
      title:    `Badge Unlocked: ${reward.badge.title}`,
      subtitle: reward.badge.description,
    }
  }

  return { icon: 'star', color: Colors.primary, title: 'Achievement unlocked!', subtitle: '' }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: { flex: 1 },
  label:    { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
})
