/**
 * ShareRouteModal — bottom sheet to share a route into an existing conversation.
 *
 * Shows the user's conversation list. Tapping a row sends a route card message
 * and shows a brief "Sent ✓" confirmation before closing.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, Animated, TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../store/authStore'
import {
  subscribeToConversations, sendRouteMessage,
  Conversation, RouteMessageStats,
} from '../lib/chatService'
import { Colors } from '../constants/colors'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoutePayload {
  id: string
  title: string
  authorName?: string
  authorId?: string
  coverImage?: string
  avgRating?: number
  stats?: RouteMessageStats
}

interface Props {
  visible: boolean
  route: RoutePayload | null
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

const SHEET_H = 480

export function ShareRouteModal({ visible, route, onClose }: Props) {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()

  const [convos, setConvos]       = useState<Conversation[]>([])
  const [loading, setLoading]     = useState(true)
  const [sentId, setSentId]       = useState<string | null>(null)   // convId just sent to
  const [sending, setSending]     = useState<string | null>(null)   // convId being sent

  const translateY = useRef(new Animated.Value(SHEET_H)).current

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 70, friction: 12,
      }).start()
    } else {
      setSentId(null)
      setSending(null)
    }
  }, [visible, translateY])

  const close = useCallback(() => {
    Animated.timing(translateY, {
      toValue: SHEET_H, duration: 240, useNativeDriver: true,
    }).start(onClose)
  }, [translateY, onClose])

  // Subscribe to conversations while modal is open
  useEffect(() => {
    if (!visible || !user) return
    setLoading(true)
    const unsub = subscribeToConversations(user.id, (data) => {
      setConvos(data)
      setLoading(false)
    })
    return unsub
  }, [visible, user?.id])

  const getOtherName = useCallback((convo: Conversation): string => {
    if (!user) return 'Unknown'
    const otherId = convo.participants.find((id) => id !== user.id) ?? ''
    return convo.participantNames?.[otherId] ?? 'Unknown'
  }, [user])

  const handleSend = useCallback(async (convo: Conversation) => {
    if (!user || !route || sending) return
    setSending(convo.id)
    try {
      await sendRouteMessage(convo.id, user.id, {
        id:          route.id,
        title:       route.title,
        authorName:  route.authorName,
        authorId:    route.authorId,
        coverImage:  route.coverImage,
        avgRating:   route.avgRating ?? undefined,
        stats:       route.stats,
      })
      setSentId(convo.id)
      // Auto-close after brief confirmation
      setTimeout(close, 900)
    } catch {
      setSending(null)
    }
  }, [user, route, sending, close])

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={close}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <View style={s.handleArea}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Share Route</Text>
            {route && (
              <Text style={s.headerSub} numberOfLines={1}>{route.title}</Text>
            )}
          </View>
          <TouchableOpacity onPress={close} hitSlop={10}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Route mini-preview */}
        {route && (
          <View style={s.routePreview}>
            <Ionicons name="compass-outline" size={16} color={Colors.secondary} />
            <Text style={s.routePreviewTitle} numberOfLines={1}>{route.title}</Text>
            {route.stats && (
              <View style={s.routePreviewStats}>
                {route.stats.days ? (
                  <Text style={s.routePreviewStat}>{route.stats.days}d</Text>
                ) : null}
                {route.stats.nm ? (
                  <Text style={s.routePreviewStat}>{route.stats.nm} nm</Text>
                ) : null}
                {route.stats.stops ? (
                  <Text style={s.routePreviewStat}>{route.stats.stops} stops</Text>
                ) : null}
              </View>
            )}
          </View>
        )}

        <Text style={s.sectionLabel}>Send to</Text>

        {/* Conversation list */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : convos.length === 0 ? (
          <View style={s.center}>
            <Ionicons name="chatbubble-outline" size={36} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No conversations yet</Text>
            <Text style={s.emptyText}>Start a chat from a user profile first.</Text>
          </View>
        ) : (
          <FlatList
            data={convos}
            keyExtractor={(c) => c.id}
            style={s.list}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            ItemSeparatorComponent={() => <View style={s.divider} />}
            renderItem={({ item }) => {
              const name    = getOtherName(item)
              const isSent  = sentId === item.id
              const isBusy  = sending === item.id

              return (
                <TouchableOpacity
                  style={s.row}
                  onPress={() => handleSend(item)}
                  disabled={!!sending || !!sentId}
                  activeOpacity={0.75}
                >
                  <View style={s.avatar}>
                    <Text style={s.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={s.rowName} numberOfLines={1}>{name}</Text>
                  {isBusy ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : isSent ? (
                    <View style={s.sentPill}>
                      <Ionicons name="checkmark" size={13} color="#22C55E" />
                      <Text style={s.sentText}>Sent</Text>
                    </View>
                  ) : (
                    <View style={s.sendPill}>
                      <Text style={s.sendPillText}>Send</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        )}
      </Animated.View>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SHEET_H,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
  },
  handleArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: 13, color: Colors.textMuted, marginTop: 2, maxWidth: 260 },

  routePreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.secondary + '10', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.secondary + '25',
  },
  routePreviewTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.text },
  routePreviewStats: { flexDirection: 'row', gap: 6 },
  routePreviewStat: {
    fontSize: 12, fontWeight: '600', color: Colors.secondary,
    backgroundColor: Colors.secondary + '14', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 20, marginBottom: 6,
  },

  list: { flex: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 13, backgroundColor: '#fff',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  rowName: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },

  sendPill: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  sendPillText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  sentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#22C55E18', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  sentText: { fontSize: 13, fontWeight: '700', color: '#22C55E' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
})
