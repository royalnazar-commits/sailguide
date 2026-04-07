import React, { useMemo } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BoatCard } from '../src/components/charter/BoatCard'
import { useCharterStore } from '../src/store/charterStore'
import { useProfileStore } from '../src/store/profileStore'
import { Colors } from '../src/constants/colors'

export default function SavedYachtsScreen() {
  const insets = useSafeAreaInsets()
  const { yachts } = useCharterStore()
  const { savedYachts, toggleFavoriteYacht, isFavoriteYacht } = useProfileStore()

  const favoriteYachts = useMemo(
    () => yachts.filter((y) => savedYachts.includes(y.id)),
    [yachts, savedYachts],
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Yachts</Text>
        <Text style={styles.count}>{favoriteYachts.length}</Text>
      </View>

      <FlatList
        data={favoriteYachts}
        keyExtractor={(y) => y.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <BoatCard
            yacht={item}
            onPress={() => router.push(`/boat/${item.id}`)}
            isFavorited={isFavoriteYacht(item.id)}
            onToggleFavorite={() => toggleFavoriteYacht(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No saved yachts</Text>
            <Text style={styles.emptySub}>Tap the heart on any yacht to save it here.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.back()}>
              <Text style={styles.emptyBtnText}>Browse yachts</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: Colors.text },
  count: {
    fontSize: 13, fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },

  list: { paddingHorizontal: 16, paddingTop: 16 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8, backgroundColor: Colors.primary + '12',
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10,
  },
  emptyBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
})
