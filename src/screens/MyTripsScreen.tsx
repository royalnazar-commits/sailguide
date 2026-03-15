import React from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useProfileStore } from '../store/profileStore'
import { RouteCard } from '../components/RouteCard'
import { SEED_ROUTES } from '../data/seedRoutes'
import { Colors } from '../constants/colors'

export default function MyTripsScreen() {
  const insets = useSafeAreaInsets()
  const { savedRoutes } = useProfileStore()

  const saved = SEED_ROUTES.filter((r) => savedRoutes.includes(r.id))

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Trips</Text>
          <Text style={styles.subtitle}>
            {saved.length} saved route{saved.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)/catalog')}>
          <Ionicons name="search-outline" size={16} color={Colors.primary} />
          <Text style={styles.browseBtnText}>Browse Routes</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={saved}
        keyExtractor={(r) => r.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RouteCard
            route={item}
            showSaveIndicator
            onPress={() => router.push(`/route/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bookmark-outline" size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No saved routes yet</Text>
            <Text style={styles.emptySub}>
              Browse routes and tap the bookmark icon to save them here.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/catalog')}>
              <Ionicons name="list-outline" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>Browse Routes</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '12',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  browseBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  list: { padding: 16 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 14, paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24, marginTop: 4,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
