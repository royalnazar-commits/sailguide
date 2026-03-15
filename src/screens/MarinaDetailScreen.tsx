import React from 'react'
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { marinasApi } from '../services/api'
import { MarinaCard } from '../components/MarinaCard'
import { Colors } from '../constants/colors'

export default function MarinaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: marina, isLoading } = useQuery({
    queryKey: ['marina', id],
    queryFn: () => marinasApi.get(id),
  })

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />
  if (!marina) return null

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {marina.photos?.[0] && (
        <Image source={{ uri: marina.photos[0] }} style={styles.hero} />
      )}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={styles.name}>{marina.name}</Text>
        <Text style={styles.location}>{marina.region}, {marina.country}</Text>

        {marina.depthM && marina.capacity && (
          <View style={styles.techRow}>
            <TechItem icon="arrow-down" label={`${marina.depthM}m depth`} />
            <TechItem icon="boat" label={`${marina.capacity} berths`} />
            {marina.maxLoaM && <TechItem icon="resize" label={`Max ${marina.maxLoaM}m`} />}
          </View>
        )}

        <MarinaCard marina={marina} />

        {marina.shelterNotes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>⛵ Shelter & approach</Text>
            <Text style={styles.notesText}>{marina.shelterNotes}</Text>
          </View>
        )}

        {marina.checkInNotes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>📋 Check-in</Text>
            <Text style={styles.notesText}>{marina.checkInNotes}</Text>
          </View>
        )}

        {marina.lastVerifiedAt && (
          <Text style={styles.verified}>
            ✓ Last verified: {new Date(marina.lastVerifiedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </Text>
        )}
      </View>
    </ScrollView>
  )
}

function TechItem({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={14} color={Colors.secondary} />
      <Text style={{ fontSize: 13, color: Colors.textSecondary }}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { width: '100%', height: 240 },
  backBtn: {
    position: 'absolute', top: 48, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 20 },
  name: { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  location: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  techRow: { flexDirection: 'row', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  notesBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  notesTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  notesText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  verified: { fontSize: 12, color: Colors.success, marginTop: 8 },
})