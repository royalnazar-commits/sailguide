import React, { useEffect, useRef } from 'react'
import {
  Animated, View, Text, StyleSheet, TouchableOpacity, Modal, Pressable,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useContributorStore } from '../store/contributorStore'
import { RewardItem, BadgeId } from '../types/contributor'
import { Colors } from '../constants/colors'

// ── Big-moment filter ─────────────────────────────────────────────────────────
//
// Only these events get a full modal. Everything else is silently added
// to the profile badge grid without interrupting the user.

const BIG_MOMENT_BADGES = new Set<BadgeId>([
  'FIRST_ROUTE',
  'FIRST_ROUTE_SOLD',
  'REACHED_CAPTAIN',
  'REACHED_SEA_GUIDE',
  'REACHED_COMMODORE',
  'REACHED_LEGEND',
  'TEN_ENGAGERS',
  'VERIFIED_SCOUT',
])

function isBigMoment(reward: RewardItem): boolean {
  if (reward.type === 'LEVEL_UP') return true
  if (reward.type === 'BADGE_UNLOCK' && reward.badge) {
    return BIG_MOMENT_BADGES.has(reward.badge.id)
  }
  return false
}

// ── Root component — place once at layout level ───────────────────────────────

/**
 * Drop this once inside the root layout.
 * It watches `pendingRewards`, silently dismisses minor rewards,
 * and shows a premium modal for significant ones (level-ups + key badges).
 */
export function AchievementModal() {
  const pendingRewards = useContributorStore((s) => s.pendingRewards)
  const dismissReward  = useContributorStore((s) => s.dismissReward)

  // Silently dismiss non-big-moment rewards
  useEffect(() => {
    for (const r of pendingRewards) {
      if (!isBigMoment(r)) dismissReward(r.id)
    }
  }, [pendingRewards])

  const current = pendingRewards.find(isBigMoment) ?? null
  if (!current) return null

  return (
    <ModalCard
      key={current.id}
      reward={current}
      onDismiss={() => dismissReward(current.id)}
    />
  )
}

// ── Modal card ────────────────────────────────────────────────────────────────

function ModalCard({ reward, onDismiss }: { reward: RewardItem; onDismiss: () => void }) {
  const scale   = useRef(new Animated.Value(0.85)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start()
  }, [])

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(scale,   { toValue: 0.9, duration: 160, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,   duration: 160, useNativeDriver: true }),
    ]).start(onDismiss)
  }

  const { icon, color, title, subtitle, eyebrow } = resolveDisplay(reward)

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Animated.View style={[styles.backdropFill, { opacity }]} />
      </Pressable>

      {/* Card (pointer-events not blocked by backdrop press) */}
      <Animated.View
        style={[styles.cardWrap, { transform: [{ scale }], opacity }]}
        pointerEvents="box-none"
      >
        <View style={[styles.card, { borderColor: color + '30' }]}>

          {/* Top accent line */}
          <View style={[styles.accentLine, { backgroundColor: color }]} />

          {/* Icon */}
          <View style={[styles.iconRing, { backgroundColor: color + '12', borderColor: color + '30' }]}>
            <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
              <Ionicons name={icon as any} size={38} color={color} />
            </View>
          </View>

          {/* Text */}
          <Text style={[styles.eyebrow, { color }]}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: color }]}
            onPress={dismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>

        </View>
      </Animated.View>
    </Modal>
  )
}

// ── Display helpers ───────────────────────────────────────────────────────────

function resolveDisplay(reward: RewardItem): {
  icon: string; color: string; eyebrow: string; title: string; subtitle: string
} {
  if (reward.type === 'LEVEL_UP' && reward.level) {
    const lvl = reward.level
    return {
      icon:     lvl.icon,
      color:    lvl.color,
      eyebrow:  `Level ${lvl.level}`,
      title:    lvl.name,
      subtitle: lvl.subtitle,
    }
  }

  if (reward.type === 'BADGE_UNLOCK' && reward.badge) {
    return {
      icon:     reward.badge.icon,
      color:    reward.badge.color,
      eyebrow:  'Achievement Unlocked',
      title:    reward.badge.title,
      subtitle: reward.badge.description,
    }
  }

  return { icon: 'star', color: Colors.primary, eyebrow: 'Achievement', title: 'Unlocked', subtitle: '' }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
  },
  backdropFill: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cardWrap: {
    position: 'absolute',
    zIndex: 9999,
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    pointerEvents: 'box-none',
  } as any,
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 0,
    paddingBottom: 28,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 24,
  },
  accentLine: {
    alignSelf: 'stretch',
    height: 4,
    marginBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  iconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.9,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  cta: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
})
