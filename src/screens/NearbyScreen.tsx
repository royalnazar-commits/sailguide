import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, ScrollView
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { marinasApi } from '../services/api'
import { MarinaCard } from '../components/MarinaCard'
import { Colors } from '../constants/colors'
import { Marina } from '../types'

const FILTERS = [
  { key: 'all', label: 'All', icon: 'anchor-outline' },
  { key: 'fuel', label: 'Fuel', icon: 'flame-outline' },
  { key: 'anchorage', label: 'Anchorage', icon: 'water-outline' },
]

export default function NearbyScreen() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude })
    })()
  }, [])

  const { data: marinas = [], isLoading } = useQuery({
    queryKey: ['nearby', location, filter],
    queryFn: () =>
      marinasApi.nearby({
        lat: location!.lat,
        lng: location!.lng,
        radiusKm: 100,
        limit: 20,
        fuel: filter === 'fuel' || undefined,
      }),
    enabled: !!location,
  })

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Nearby</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Ionicons name={f.icon as any} size={14} color={filter === f.key ? '#fff' : Colors.secondary} />
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!location && (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.centerText}>Getting your location...</Text>
        </View>
      )}

      {location && isLoading && (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
      )}

      {location && !isLoading && (
        <FlatList
          data={marinas as Marina[]}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              <MarinaCard
                marina={item}
                onPress={() => router.push(`/marina/${item.id}`)}
                showDistance
              />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.centerText}>No marinas found nearby</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff',
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  filterRow: { backgroundColor: '#fff', paddingVertical: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.secondary + '15', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  filterChipActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 13, color: Colors.secondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  center: { alignItems: 'center', paddingTop: 60, gap: 12 },
  centerText: { fontSize: 15, color: Colors.textMuted },
})