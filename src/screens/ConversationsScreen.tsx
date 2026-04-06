import React, { useEffect, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '../store/authStore'
import { subscribeToConversations, Conversation } from '../lib/chatService'
import { Colors } from '../constants/colors'

export default function ConversationsScreen() {
  const { user } = useAuthStore()
  const insets = useSafeAreaInsets()
  const [convos, setConvos] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToConversations(user.id, (data) => {
      setConvos(data)
      setLoading(false)
    })
    return unsub
  }, [user?.id])

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Sign in to use messages</Text>
      </View>
    )
  }

  const getOtherName = (convo: Conversation) => {
    const otherId = convo.participants.find((id) => id !== user.id) ?? ''
    return convo.participantNames?.[otherId] ?? 'Unknown'
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : convos.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubble-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyText}>Start a conversation from a user profile</Text>
        </View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/chat/${item.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {getOtherName(item).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowName}>{getOtherName(item)}</Text>
                <Text style={styles.rowLast} numberOfLines={1}>
                  {item.lastMessage || 'No messages yet'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.border} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  list: { paddingVertical: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 72 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  rowContent: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowLast: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
})
