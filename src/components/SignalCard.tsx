import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Signal, getCategoryMeta, deleteSignal } from '../lib/signalService'
import { getOrCreateConversation } from '../lib/chatService'
import { fetchUserProfile } from '../lib/userService'
import { useAuthStore } from '../store/authStore'
import { Colors } from '../constants/colors'

interface Props {
  signal: Signal
  currentUserId: string
  onClose: () => void
}

export function SignalCard({ signal, currentUserId, onClose }: Props) {
  const { user } = useAuthStore()
  const meta = getCategoryMeta(signal.category)
  const isOwn = signal.userId === currentUserId

  const [deleting,   setDeleting]   = React.useState(false)
  const [messaging,  setMessaging]  = React.useState(false)
  const [avatarUrl,  setAvatarUrl]  = React.useState<string | null>(null)

  // Load creator's real avatar from Firestore
  React.useEffect(() => {
    fetchUserProfile(signal.userId).then((p) => {
      if (p?.avatarUrl) setAvatarUrl(p.avatarUrl)
    })
  }, [signal.userId])

  const handleOpenProfile = () => {
    onClose()
    router.push(`/user/${signal.userId}?name=${encodeURIComponent(signal.userName)}`)
  }

  const handleMessage = async () => {
    if (!user || messaging) return
    setMessaging(true)
    try {
      const convId = await getOrCreateConversation(
        user.id, user.name,
        signal.userId, signal.userName,
      )
      onClose()
      router.push(`/chat/${convId}?otherName=${encodeURIComponent(signal.userName)}`)
    } finally {
      setMessaging(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteSignal(signal.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const ageText = (): string => {
    if (!signal.createdAt) return ''
    const mins = Math.floor((Date.now() - signal.createdAt.toMillis()) / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  const isActive = (): boolean => {
    if (!signal.createdAt) return false
    return Date.now() - signal.createdAt.toMillis() < 2 * 60 * 60 * 1000
  }

  const initial = (signal.userName ?? '?').charAt(0).toUpperCase()
  const firstName = signal.userName?.split(' ')[0] ?? 'them'

  return (
    <View style={styles.card}>
      {/* ── Handle ─────────────────────────────────────────────────── */}
      <View style={styles.handle} />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={[styles.categoryPill, { backgroundColor: meta.color + '15', borderColor: meta.color + '35' }]}>
          <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
          <Text style={[styles.categoryLabel, { color: meta.color }]}>{signal.category}</Text>
        </View>
        <View style={styles.headerMid}>
          {isActive()
            ? <><View style={styles.activeDot} /><Text style={styles.activeLabel}>Active</Text></>
            : <Text style={styles.ageLabel}>{ageText()}</Text>
          }
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={14} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Accent stripe ──────────────────────────────────────────── */}
      <View style={[styles.accentStripe, { backgroundColor: meta.color }]} />

      {/* ── Message bubble ─────────────────────────────────────────── */}
      <View style={[styles.bubble, { backgroundColor: meta.color + '10', borderColor: meta.color + '28' }]}>
        <Text style={styles.bubbleText}>{signal.text}</Text>
      </View>

      {/* ── Creator row ────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.creatorRow} onPress={handleOpenProfile} activeOpacity={0.7}>
        <View style={[styles.avatar, { backgroundColor: meta.color + '18' }]}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            : <Text style={[styles.avatarLetter, { color: meta.color }]}>{initial}</Text>
          }
        </View>
        <View style={styles.creatorInfo}>
          <Text style={styles.creatorName} numberOfLines={1}>{signal.userName}</Text>
          <Text style={styles.creatorSub}>View profile</Text>
        </View>
        {isOwn && (
          <View style={[styles.ownBadge, { backgroundColor: meta.color + '15', borderColor: meta.color + '30' }]}>
            <Text style={[styles.ownBadgeText, { color: meta.color }]}>You</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* ── Chat CTA — always visible ───────────────────────────────── */}
      <TouchableOpacity
        style={[styles.chatBtn, { backgroundColor: meta.color }, messaging && styles.chatBtnLoading]}
        onPress={handleMessage}
        disabled={messaging}
        activeOpacity={0.84}
      >
        {messaging
          ? <ActivityIndicator size="small" color="#fff" />
          : (
            <>
              <Ionicons name="chatbubble" size={16} color="#fff" />
              <Text style={styles.chatBtnText}>
                {isOwn ? 'Open Chat' : `Message ${firstName}`}
              </Text>
            </>
          )
        }
      </TouchableOpacity>

      {/* ── Delete (own signals only) ───────────────────────────────── */}
      {isOwn && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          disabled={deleting}
          activeOpacity={0.8}
        >
          {deleting
            ? <ActivityIndicator size="small" color={Colors.danger} />
            : (
              <>
                <Ionicons name="trash-outline" size={14} color={Colors.danger} />
                <Text style={styles.deleteBtnText}>Remove Signal</Text>
              </>
            )
          }
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 38,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 16,
    gap: 14,
  },

  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 2,
  },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  categoryEmoji: { fontSize: 13 },
  categoryLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  headerMid: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  activeLabel: { fontSize: 12, fontWeight: '600', color: '#22C55E' },
  ageLabel: { fontSize: 12, color: Colors.textMuted },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },

  // Accent stripe
  accentStripe: {
    height: 3, borderRadius: 2,
    marginHorizontal: -20,
    marginTop: -6,
    opacity: 0.45,
  },

  // Message bubble
  bubble: {
    borderRadius: 18,
    borderTopLeftRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bubbleText: {
    fontSize: 17, fontWeight: '600',
    color: Colors.text, lineHeight: 26,
    letterSpacing: -0.2,
  },

  // Creator row
  creatorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.background,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    overflow: 'hidden',
  },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  avatarLetter: { fontSize: 14, fontWeight: '800' },
  creatorInfo: { flex: 1 },
  creatorName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  creatorSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  ownBadge: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    marginRight: 2,
  },
  ownBadgeText: { fontSize: 11, fontWeight: '700' },

  // Chat button (always visible)
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 15,
    marginTop: -2,
  },
  chatBtnLoading: { opacity: 0.55 },
  chatBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Delete button
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, borderWidth: 1.5, borderColor: Colors.danger + '40',
    borderRadius: 14, paddingVertical: 11, marginTop: -6,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: Colors.danger },
})
