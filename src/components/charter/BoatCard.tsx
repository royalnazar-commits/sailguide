import React, { useState } from 'react'
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Yacht, BOAT_TYPE_LABELS } from '../../types/charter'
import { Colors } from '../../constants/colors'

const SAILBOAT_FALLBACK = 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=900&q=80'
const MOTOR_FALLBACK    = 'https://images.unsplash.com/photo-1577394779877-f5e73dc3d6b0?w=900&q=80'
const CATAMARAN_FALLBACK = 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=900&q=80'

function getFallback(type: string): string {
  if (type === 'MOTOR_YACHT') return MOTOR_FALLBACK
  if (type === 'CATAMARAN') return CATAMARAN_FALLBACK
  return SAILBOAT_FALLBACK
}

const TYPE_COLORS = {
  SAILBOAT:    '#1B6CA8',
  CATAMARAN:   '#22C55E',
  MOTOR_YACHT: '#C9963A',
  GULET:       '#8B5CF6',
}

interface Props {
  yacht: Yacht
  onPress: () => void
  /** Show as a compact horizontal card (for map bottom sheet) */
  compact?: boolean
}

export function BoatCard({ yacht, onPress, compact = false }: Props) {
  const typeColor = TYPE_COLORS[yacht.type] ?? Colors.secondary
  const [imgErr, setImgErr] = useState(false)
  const heroUri = imgErr ? getFallback(yacht.type) : (yacht.images[0] ?? getFallback(yacht.type))


  if (compact) {
    return (
      <TouchableOpacity style={compact_styles.card} onPress={onPress} activeOpacity={0.88}>
        <Image source={{ uri: heroUri }} style={compact_styles.image} onError={() => setImgErr(true)} />
        <View style={compact_styles.body}>
          <Text style={compact_styles.name} numberOfLines={1}>{yacht.name}</Text>
          <Text style={compact_styles.model} numberOfLines={1}>{yacht.model}</Text>
          <View style={compact_styles.metaRow}>
            <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
            <Text style={compact_styles.marina} numberOfLines={1}>{yacht.city}</Text>
          </View>
          <View style={compact_styles.footer}>
            <Text style={compact_styles.price}>€{yacht.pricePerWeekEur.toLocaleString()}</Text>
            <Text style={compact_styles.priceUnit}>/week</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      {/* ── Image ── */}
      <View>
        <Image source={{ uri: heroUri }} style={styles.image} onError={() => setImgErr(true)} />
        <View style={styles.imageScrim} />

        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
          <Text style={styles.typeText}>{BOAT_TYPE_LABELS[yacht.type]}</Text>
        </View>

        {/* Rating pill */}
        <View style={styles.ratingPill}>
          <Ionicons name="star" size={11} color="#F59E0B" />
          <Text style={styles.ratingText}>{yacht.rating.toFixed(1)}</Text>
        </View>

        {/* Year badge */}
        <View style={styles.yearBadge}>
          <Text style={styles.yearText}>{yacht.yearBuilt}</Text>
        </View>
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{yacht.name}</Text>
          <View style={styles.reviewCount}>
            <Text style={styles.reviewText}>({yacht.reviewCount})</Text>
          </View>
        </View>

        <Text style={styles.model} numberOfLines={1}>{yacht.model}</Text>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.marina} numberOfLines={1}>{yacht.marina} · {yacht.country}</Text>
        </View>

        {/* Specs row */}
        <View style={styles.specsRow}>
          <SpecItem icon="resize-outline" value={`${yacht.lengthM}m`} />
          <View style={styles.specDivider} />
          <SpecItem icon="bed-outline" value={`${yacht.cabins} cab`} />
          <View style={styles.specDivider} />
          <SpecItem icon="people-outline" value={`${yacht.guests} guests`} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.price}>€{yacht.pricePerWeekEur.toLocaleString()}</Text>
            <Text style={styles.priceUnit}>per week</Text>
          </View>
          <TouchableOpacity style={styles.ctaBtn} onPress={onPress} activeOpacity={0.85}>
            <Text style={styles.ctaText}>View</Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function SpecItem({ icon, value }: { icon: any; value: string }) {
  return (
    <View style={styles.specItem}>
      <Ionicons name={icon} size={13} color={Colors.textSecondary} />
      <Text style={styles.specText}>{value}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  image: { width: '100%', height: 210 },
  imageScrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  typeBadge: {
    position: 'absolute', top: 12, left: 12,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  typeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ratingPill: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  ratingText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  yearBadge: {
    position: 'absolute', bottom: 10, right: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  yearText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  body: { padding: 14 },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  name: { fontSize: 18, fontWeight: '800', color: Colors.text, flex: 1 },
  reviewCount: {},
  reviewText: { fontSize: 12, color: Colors.textMuted },

  model: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  marina: { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  specsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.background, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 4,
    marginBottom: 14,
  },
  specItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  specText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  specDivider: { width: 1, height: 14, backgroundColor: Colors.border },

  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  price: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  priceUnit: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  ctaBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})

const compact_styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    width: 260,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  image: { width: 90, height: 90 },
  body: { flex: 1, padding: 10, justifyContent: 'space-between' },
  name: { fontSize: 14, fontWeight: '700', color: Colors.text },
  model: { fontSize: 12, color: Colors.textSecondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  marina: { fontSize: 11, color: Colors.textMuted, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  priceUnit: { fontSize: 11, color: Colors.textMuted },
})
