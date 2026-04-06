/**
 * SuggestedYachts — horizontal yacht suggestion shelf for route detail screens.
 *
 * Used by both RouteDetailScreen (predefined routes) and
 * UserRouteDetailScreen (user-created/community routes).
 * Swap getSuggestedYachts() for a real API call when Booking Manager is ready.
 */

import React from 'react'
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCharterStore } from '../store/charterStore'
import { Yacht, BOAT_TYPE_LABELS } from '../types/charter'
import { Colors } from '../constants/colors'

interface Props {
  country?: string
}

export function SuggestedYachts({ country }: Props) {
  const getSuggestedYachts = useCharterStore((s) => s.getSuggestedYachts)
  const yachts = getSuggestedYachts(country, 4)
  if (yachts.length === 0) return null
  return (
    <View style={sy.section}>
      <View style={sy.header}>
        <View style={sy.headerLeft}>
          <Ionicons name="boat-outline" size={16} color={Colors.secondary} />
          <Text style={sy.title}>Charter a Yacht for This Route</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/charter')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={sy.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sy.list}
      >
        {yachts.map((yacht) => (
          <YachtCard key={yacht.id} yacht={yacht} />
        ))}
      </ScrollView>
      <Text style={sy.disclaimer}>Availability subject to change · Prices from per week</Text>
    </View>
  )
}

function YachtCard({ yacht }: { yacht: Yacht }) {
  const typeLabel = BOAT_TYPE_LABELS[yacht.type]
  const typeColor =
    yacht.type === 'CATAMARAN'   ? '#0891B2' :
    yacht.type === 'MOTOR_YACHT' ? '#7C3AED' :
    yacht.type === 'GULET'       ? '#92400E' :
    Colors.secondary

  return (
    <TouchableOpacity
      style={sy.card}
      onPress={() => router.push(`/boat/${yacht.id}`)}
      activeOpacity={0.88}
    >
      <Image
        source={{ uri: yacht.images[0] }}
        style={sy.cardImg}
        resizeMode="cover"
      />

      {/* Type badge — overlaid on image */}
      <View style={[sy.typeBadge, { backgroundColor: typeColor }]}>
        <Text style={sy.typeBadgeText}>{typeLabel}</Text>
      </View>

      <View style={sy.cardBody}>
        <Text style={sy.cardName} numberOfLines={1}>{yacht.name}</Text>
        <Text style={sy.cardModel} numberOfLines={1}>{yacht.model}</Text>

        <View style={sy.specsRow}>
          <View style={sy.specItem}>
            <Ionicons name="bed-outline" size={11} color={Colors.textMuted} />
            <Text style={sy.specText}>{yacht.cabins} cab.</Text>
          </View>
          <View style={sy.specDot} />
          <View style={sy.specItem}>
            <Ionicons name="resize-outline" size={11} color={Colors.textMuted} />
            <Text style={sy.specText}>{yacht.lengthM}m</Text>
          </View>
          <View style={sy.specDot} />
          <View style={sy.specItem}>
            <Ionicons name="people-outline" size={11} color={Colors.textMuted} />
            <Text style={sy.specText}>{yacht.guests} guests</Text>
          </View>
        </View>

        <View style={sy.footer}>
          <View style={sy.ratingRow}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={sy.ratingText}>{yacht.rating.toFixed(1)}</Text>
            <Text style={sy.reviewText}>({yacht.reviewCount})</Text>
          </View>
          <Text style={sy.price}>€{(yacht.pricePerWeekEur / 1000).toFixed(1)}k/wk</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const CARD_W = 188
const sy = StyleSheet.create({
  section: {
    paddingTop: 4,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImg: {
    width: CARD_W,
    height: 118,
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  cardBody: {
    padding: 10,
    gap: 4,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  cardModel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  specText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  specDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.border,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  price: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  disclaimer: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
  },
})
