import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../store/authStore'
import { subscribeToMessages, sendMessage, Message } from '../lib/chatService'
import { Colors } from '../constants/colors'

// ── Route message card ────────────────────────────────────────────────────────

function RouteChatCard({ msg, isMe }: { msg: Message; isMe: boolean }) {
  const navigate = () => msg.routeId && router.push(`/route-view/${msg.routeId}` as any)
  const openAuthor = () => msg.routeAuthorId && router.push(`/user/${msg.routeAuthorId}` as any)

  return (
    // Outer shell: carries iOS shadow — no overflow:hidden here
    <View style={[rc.shell, isMe ? rc.shellMe : rc.shellThem]}>
      {/* Inner: clips image to border radius, entire card tappable */}
      <TouchableOpacity style={rc.inner} onPress={navigate} activeOpacity={0.88}>

        {/* ── Cover ── */}
        <View style={rc.cover}>
          {msg.routeCoverImage ? (
            <Image source={{ uri: msg.routeCoverImage }} style={rc.coverImage} resizeMode="cover" />
          ) : (
            // Abstract map placeholder — ocean + islands + route path
            <View style={rc.mapPlaceholder}>
              {/* Ocean background rendered via style.backgroundColor */}
              {/* Island blobs */}
              <View style={[rc.island, rc.island1]} />
              <View style={[rc.island, rc.island2]} />
              <View style={[rc.island, rc.island3]} />
              {/* Dashed route line */}
              <View style={rc.routePath}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={rc.routeDash} />
                ))}
              </View>
              {/* Start/end dots */}
              <View style={[rc.routePin, rc.routePinStart]} />
              <View style={[rc.routePin, rc.routePinEnd]} />
              {/* Tiny compass — understated, top-right */}
              <View style={rc.compassCorner}>
                <Ionicons name="compass-outline" size={16} color="rgba(255,255,255,0.35)" />
              </View>
            </View>
          )}
          {/* Scrim — deeper when there's a real image */}
          <View style={msg.routeCoverImage ? rc.coverScrim : rc.mapScrim} />
        </View>

        {/* ── Body ── */}
        <View style={rc.body}>
          {/* Title + optional rating badge */}
          <View style={rc.titleRow}>
            <Text style={rc.title} numberOfLines={2}>{msg.routeTitle ?? 'Route'}</Text>
            {msg.routeAvgRating != null && msg.routeAvgRating > 0 && (
              <View style={rc.ratingBadge}>
                <Text style={rc.ratingStar}>⭐</Text>
                <Text style={rc.ratingNum}>{msg.routeAvgRating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          {/* Author — tappable if we have an ID */}
          {msg.routeAuthorName ? (
            <TouchableOpacity
              onPress={openAuthor}
              disabled={!msg.routeAuthorId}
              activeOpacity={msg.routeAuthorId ? 0.6 : 1}
              hitSlop={6}
            >
              <Text style={rc.author}>by {msg.routeAuthorName}</Text>
            </TouchableOpacity>
          ) : null}

          {/* Stats */}
          {msg.routeStats && (
            <View style={rc.stats}>
              {msg.routeStats.days ? (
                <RouteStatPill icon="time-outline" value={`${msg.routeStats.days}d`} />
              ) : null}
              {msg.routeStats.nm ? (
                <RouteStatPill icon="navigate-outline" value={`${msg.routeStats.nm} nm`} />
              ) : null}
              {msg.routeStats.stops ? (
                <RouteStatPill icon="location-outline" value={`${msg.routeStats.stops} stops`} />
              ) : null}
            </View>
          )}
        </View>

        {/* ── CTA — visual affordance only, whole card is tappable ── */}
        <View style={rc.cta}>
          <Text style={rc.ctaText}>Explore Route</Text>
          <Ionicons name="arrow-forward" size={13} color={Colors.secondary} />
        </View>

      </TouchableOpacity>
    </View>
  )
}

function RouteStatPill({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={rc.statPill}>
      <Ionicons name={icon} size={11} color={Colors.secondary} />
      <Text style={rc.statText}>{value}</Text>
    </View>
  )
}

const rc = StyleSheet.create({
  // ── Shell + inner ──────────────────────────────────────────────────────────
  shell: {
    maxWidth: '86%', marginVertical: 5,
    backgroundColor: '#fff', borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13, shadowRadius: 12, elevation: 5,
  },
  shellMe:   { alignSelf: 'flex-end' },
  shellThem: { alignSelf: 'flex-start' },
  inner: { borderRadius: 18, overflow: 'hidden' },

  // ── Cover ─────────────────────────────────────────────────────────────────
  cover: { height: 128 },
  coverImage: { width: '100%', height: 128 },
  coverScrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 70,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // Abstract map placeholder
  mapPlaceholder: {
    width: '100%', height: 128,
    backgroundColor: '#0B4C74',   // deep ocean
    overflow: 'hidden',
  },
  mapScrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  // Island blobs — abstract land masses
  island: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderRadius: 100,
  },
  island1: { width: 72, height: 46, top: 14, left: 18, transform: [{ rotate: '-12deg' }] },
  island2: { width: 44, height: 30, top: 58, left: 68, transform: [{ rotate: '8deg' }] },
  island3: { width: 56, height: 36, top: 22, right: 24, transform: [{ rotate: '6deg' }] },
  // Dashed route line
  routePath: {
    position: 'absolute', bottom: 38, left: 28, right: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  routeDash: {
    width: 10, height: 2, borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  // Start / end pin dots on the route
  routePin: {
    position: 'absolute', bottom: 33,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5, borderColor: '#fff',
  },
  routePinStart: { left: 22 },
  routePinEnd:   { right: 22 },
  // Compass badge — understated
  compassCorner: { position: 'absolute', top: 8, right: 10 },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: { paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: Colors.text, lineHeight: 21 },

  // Rating badge
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F59E0B18', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0,
  },
  ratingStar: { fontSize: 10 },
  ratingNum:  { fontSize: 12, fontWeight: '700', color: '#B45309' },

  // Author
  author: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },

  // Stats row
  stats: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 4 },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
  },
  statText: { fontSize: 11, fontWeight: '600', color: Colors.secondary },

  // ── CTA ───────────────────────────────────────────────────────────────────
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 13, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: Colors.secondary },
})

export default function ChatScreen() {
  const { id: convId, otherName } = useLocalSearchParams<{ id: string; otherName?: string }>()
  const { user } = useAuthStore()
  const insets = useSafeAreaInsets()

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    if (!convId) return
    const unsub = subscribeToMessages(convId, (msgs) => {
      setMessages(msgs)
      setLoading(false)
    })
    return unsub
  }, [convId])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [messages.length])

  const handleSend = useCallback(async () => {
    const msgText = text.trim()
    if (!msgText || !user || !convId || sending) return
    setText('')        // clear immediately so input feels responsive
    setSending(true)
    try {
      await sendMessage(convId, user.id, msgText)
    } catch {
      setText(msgText)  // restore on failure so the user doesn't lose their message
    } finally {
      setSending(false)
    }
  }, [text, user, convId, sending])

  const formatTime = (ts: any) => {
    if (!ts) return ''
    const date = ts.toDate ? ts.toDate() : new Date(ts)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarLetter}>
            {(otherName ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.headerName} numberOfLines={1}>{otherName ?? 'Chat'}</Text>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const isMe = item.senderId === user?.id
            const prevMsg = index > 0 ? messages[index - 1] : null
            const showTime = !prevMsg || (
              item.createdAt && prevMsg.createdAt &&
              (item.createdAt as any).seconds - (prevMsg.createdAt as any).seconds > 300
            )
            return (
              <>
                {showTime && item.createdAt ? (
                  <Text style={styles.timeDivider}>{formatTime(item.createdAt)}</Text>
                ) : null}
                {item.type === 'route' ? (
                  <RouteChatCard msg={item} isMe={isMe} />
                ) : (
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                      {item.text}
                    </Text>
                  </View>
                )}
              </>
            )
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Send the first message</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarLetter: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  headerName: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },

  // Messages
  messageList: { padding: 16, gap: 4, flexGrow: 1, justifyContent: 'flex-end' },
  timeDivider: {
    alignSelf: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    marginVertical: 8,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginVertical: 2,
  },
  bubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: '#fff' },
  bubbleTextThem: { color: Colors.text },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
})
