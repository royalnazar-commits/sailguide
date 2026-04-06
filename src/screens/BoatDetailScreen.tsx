import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BoatGallery } from '../components/charter/BoatGallery'
import { AvailabilityCalendar } from '../components/charter/AvailabilityCalendar'
import { useCharterStore } from '../store/charterStore'
import { BOAT_TYPE_LABELS, SkipperOption } from '../types/charter'
import { Colors } from '../constants/colors'

const { width: SCREEN_W } = Dimensions.get('window')

const TYPE_COLORS: Record<string, string> = {
  SAILBOAT:    '#1B6CA8',
  CATAMARAN:   '#22C55E',
  MOTOR_YACHT: '#C9963A',
  GULET:       '#8B5CF6',
}

const SKIPPER_LABEL: Record<SkipperOption, string> = {
  required:      'Skipper required (included)',
  optional:      'Skipper available (optional)',
  not_available: 'Bareboat only',
}

// ── Mock reviews ──────────────────────────────────────────────────────────────

const MOCK_REVIEWS = [
  { id: 'r1', author: 'James & Sarah', date: 'August 2025', rating: 5, avatar: '👨‍👩‍👧', text: 'Absolutely incredible week. The boat was in perfect condition, spotlessly clean and fully equipped. We sailed from Athens to Santorini and back — the crew was helpful before departure and the charter company was very responsive. Would book again in a heartbeat.' },
  { id: 'r2', author: 'Marco Ferretti', date: 'July 2025', rating: 5, avatar: '🇮🇹', text: 'Barca in ottimo stato. La settimana alle Cicladi è stata perfetta — vento costante, poca gente nei posti segreti. Ho noleggiato molte barche e questa era sicuramente una delle migliori. Skipper opzionale ben consigliato per chi non conosce le correnti locali.' },
  { id: 'r3', author: 'The Hansen Family', date: 'June 2025', rating: 4, avatar: '🇩🇰', text: 'Great boat for a family of 6. Plenty of space, good safety equipment and the kids loved the snorkelling gear. Only minor issue was the outboard had a small fuel leak (fixed same day). Really happy overall — Croatia exceeded all expectations.' },
]

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BoatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [isSaved, setIsSaved] = useState(false)
  const [selectedCheckIn, setSelectedCheckIn] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'specs' | 'equipment' | 'reviews' | 'availability'>('specs')

  const { getYachtById, loadYachtDetail, loadAvailability, bookedWeeks, detailLoading } = useCharterStore()

  const yachtId = id ?? ''
  const isLoading = detailLoading[yachtId] ?? false
  const yacht = getYachtById(yachtId)
  const availabilityWeeks = bookedWeeks[yachtId] ?? yacht?.bookedWeeks ?? []

  useEffect(() => {
    if (yachtId) {
      loadYachtDetail(yachtId)
      loadAvailability(yachtId, new Date().getFullYear())
    }
  }, [yachtId])

  if (isLoading && !yacht) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (!yacht) {
    return (
      <View style={[styles.notFound, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={52} color={Colors.textMuted} />
        <Text style={styles.notFoundText}>Yacht not found</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const typeColor = TYPE_COLORS[yacht.type] ?? Colors.secondary
  const totalNights = 7  // always weekly charter
  const skipperFee = yacht.skipper === 'optional' && yacht.skipperCostPerDayEur
    ? yacht.skipperCostPerDayEur * 7
    : 0

  const handleBook = () => {
    router.push(`/booking/${yacht.id}${selectedCheckIn ? `?checkIn=${selectedCheckIn}` : ''}`)
  }

  return (
    <View style={styles.container}>
      {/* Gallery */}
      <BoatGallery images={yacht.images} height={320} />

      {/* Back button overlay */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Save button overlay */}
      <TouchableOpacity
        style={[styles.saveBtn, { top: insets.top + 8 }]}
        onPress={() => setIsSaved((s) => !s)}
      >
        <Ionicons
          name={isSaved ? 'heart' : 'heart-outline'}
          size={20}
          color={isSaved ? '#EF4444' : '#fff'}
        />
      </TouchableOpacity>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title block ── */}
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.yachtName}>{yacht.name}</Text>
            <View style={[styles.typePill, { backgroundColor: typeColor + '18', borderColor: typeColor + '40' }]}>
              <Text style={[styles.typeText, { color: typeColor }]}>{BOAT_TYPE_LABELS[yacht.type]}</Text>
            </View>
          </View>
          <Text style={styles.model}>{yacht.model}</Text>

          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color={Colors.secondary} />
            <Text style={styles.location}>{yacht.marina}</Text>
            <Text style={styles.locationDot}>·</Text>
            <Text style={styles.country}>{yacht.country}</Text>
          </View>

          {/* Rating + reviews */}
          <View style={styles.ratingRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Ionicons
                key={i}
                name={i < Math.floor(yacht.rating) ? 'star' : 'star-outline'}
                size={15}
                color="#F59E0B"
              />
            ))}
            <Text style={styles.ratingVal}>{yacht.rating.toFixed(1)}</Text>
            <Text style={styles.reviewCount}>({yacht.reviewCount} reviews)</Text>
          </View>
        </View>

        {/* ── Quick specs strip ── */}
        <View style={styles.quickSpecs}>
          <QuickSpec icon="resize-outline"     value={`${yacht.lengthM}m`}  label="Length" />
          <View style={styles.qsDivider} />
          <QuickSpec icon="bed-outline"         value={`${yacht.cabins}`}    label="Cabins" />
          <View style={styles.qsDivider} />
          <QuickSpec icon="people-outline"      value={`${yacht.guests}`}    label="Guests" />
          <View style={styles.qsDivider} />
          <QuickSpec icon="calendar-outline"    value={`${yacht.yearBuilt}`} label="Year" />
        </View>

        {/* ── Section tabs ── */}
        <View style={styles.sectionTabs}>
          {(['specs', 'equipment', 'availability', 'reviews'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sectionTab, activeSection === s && styles.sectionTabActive]}
              onPress={() => setActiveSection(s)}
            >
              <Text style={[styles.sectionTabText, activeSection === s && styles.sectionTabTextActive]}>
                {s === 'specs' ? 'Specs'
                  : s === 'equipment' ? 'Equipment'
                  : s === 'availability' ? 'Calendar'
                  : 'Reviews'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Specs section ── */}
        {activeSection === 'specs' && (
          <View style={styles.section}>
            {/* Description */}
            <Text style={styles.description}>{yacht.description}</Text>

            {/* Technical specs */}
            <Text style={styles.subSectionTitle}>Technical Specifications</Text>
            <View style={styles.specsGrid}>
              <SpecRow label="Model"       value={yacht.model} />
              <SpecRow label="Type"        value={BOAT_TYPE_LABELS[yacht.type]} />
              <SpecRow label="Year built"  value={String(yacht.yearBuilt)} />
              <SpecRow label="Length"      value={`${yacht.lengthM} m`} />
              <SpecRow label="Cabins"      value={String(yacht.cabins)} />
              <SpecRow label="Berths"      value={String(yacht.berths)} />
              <SpecRow label="Guests"      value={String(yacht.guests)} />
              <SpecRow label="Toilets"     value={String(yacht.toilets)} />
              {yacht.engineHp && <SpecRow label="Engine"   value={`${yacht.engineHp} HP`} />}
              {yacht.fuelTankL && <SpecRow label="Fuel tank"  value={`${yacht.fuelTankL} L`} />}
              {yacht.waterTankL && <SpecRow label="Water tank" value={`${yacht.waterTankL} L`} />}
            </View>

            {/* Charter info */}
            <Text style={styles.subSectionTitle}>Charter Information</Text>
            <View style={styles.specsGrid}>
              <SpecRow label="Base marina"  value={yacht.marina} />
              <SpecRow label="Check-in"     value={yacht.checkInDay} />
              <SpecRow label="Check-out"    value={yacht.checkOutDay} />
              <SpecRow label="Deposit"      value={`€${yacht.depositEur.toLocaleString()}`} />
              <SpecRow label="Skipper"      value={SKIPPER_LABEL[yacht.skipper]} />
              {yacht.skipperCostPerDayEur && yacht.skipper === 'optional' && (
                <SpecRow label="Skipper cost" value={`€${yacht.skipperCostPerDayEur}/day`} />
              )}
            </View>

            {/* Tags */}
            {yacht.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {yacht.tags.map((tag) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Equipment section ── */}
        {activeSection === 'equipment' && (
          <View style={styles.section}>
            <Text style={styles.description}>
              All equipment is included in the charter price at no extra cost.
            </Text>
            <View style={styles.equipmentGrid}>
              {yacht.equipment.map((item) => (
                <View key={item} style={styles.equipItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.equipText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Availability / calendar section ── */}
        {activeSection === 'availability' && (
          <View style={styles.section}>
            <Text style={styles.description}>
              Select your charter week. Availability is updated in real time.
            </Text>
            <AvailabilityCalendar
              bookedWeeks={availabilityWeeks}
              selectedCheckIn={selectedCheckIn}
              onSelectWeek={(checkIn) => {
                setSelectedCheckIn(checkIn)
              }}
            />
            {selectedCheckIn && (
              <View style={styles.selectedWeekBanner}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.selectedWeekText}>
                  {new Date(selectedCheckIn).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })} — selected
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Reviews section ── */}
        {activeSection === 'reviews' && (
          <View style={styles.section}>
            {/* Overall rating */}
            <View style={styles.overallRating}>
              <Text style={styles.overallRatingVal}>{yacht.rating.toFixed(1)}</Text>
              <View style={styles.overallStars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i} name="star" size={20} color="#F59E0B" />
                ))}
                <Text style={styles.overallReviewCount}>{yacht.reviewCount} reviews</Text>
              </View>
            </View>

            {MOCK_REVIEWS.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAvatar}>{review.avatar}</Text>
                  <View style={styles.reviewMeta}>
                    <Text style={styles.reviewAuthor}>{review.author}</Text>
                    <Text style={styles.reviewDate}>{review.date}</Text>
                  </View>
                  <View style={styles.reviewStars}>
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Ionicons key={i} name="star" size={12} color="#F59E0B" />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewText}>{review.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Sticky footer ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.footerPrice}>
          <Text style={styles.footerPriceVal}>€{yacht.pricePerWeekEur.toLocaleString()}</Text>
          <Text style={styles.footerPriceUnit}>/week</Text>
          {selectedCheckIn && (
            <Text style={styles.footerDateHint}>
              {new Date(selectedCheckIn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.bookBtn} onPress={handleBook} activeOpacity={0.88}>
          <Text style={styles.bookBtnText}>
            {selectedCheckIn ? 'Start Booking' : 'Check Availability'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuickSpec({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.quickSpecItem}>
      <Ionicons name={icon} size={18} color={Colors.secondary} />
      <Text style={styles.quickSpecVal}>{value}</Text>
      <Text style={styles.quickSpecLabel}>{label}</Text>
    </View>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 18, fontWeight: '700', color: Colors.text },
  backLink: { backgroundColor: Colors.primary + '12', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  backLinkText: { color: Colors.primary, fontWeight: '700' },

  backBtn: {
    position: 'absolute', left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: {
    position: 'absolute', right: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  scroll: { flex: 1 },

  titleBlock: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  yachtName: { fontSize: 24, fontWeight: '900', color: Colors.text, flex: 1 },
  typePill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 12, fontWeight: '700' },
  model: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  location: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  locationDot: { color: Colors.textMuted, marginHorizontal: 2 },
  country: { fontSize: 13, color: Colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingVal: { fontSize: 14, fontWeight: '700', color: Colors.text, marginLeft: 4 },
  reviewCount: { fontSize: 13, color: Colors.textMuted },

  quickSpecs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: Colors.border,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: 14, marginTop: 1,
  },
  quickSpecItem: { flex: 1, alignItems: 'center', gap: 4 },
  quickSpecVal: { fontSize: 16, fontWeight: '800', color: Colors.text },
  quickSpecLabel: { fontSize: 11, color: Colors.textMuted },
  qsDivider: { width: 1, height: 36, backgroundColor: Colors.border, alignSelf: 'center' },

  sectionTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 1,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectionTab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sectionTabActive: { borderBottomColor: Colors.primary },
  sectionTabText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  sectionTabTextActive: { color: Colors.primary, fontWeight: '700' },

  section: { backgroundColor: '#fff', marginTop: 1, padding: 16 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, marginBottom: 20 },
  subSectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, marginBottom: 12, marginTop: 4 },

  specsGrid: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    overflow: 'hidden', marginBottom: 16,
  },
  specRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  specLabel: { fontSize: 13, color: Colors.textSecondary },
  specValue: { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'right' },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tagPill: {
    backgroundColor: Colors.primary + '10', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.primary + '25',
  },
  tagText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },

  equipmentGrid: { gap: 10 },
  equipItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  equipText: { fontSize: 14, color: Colors.text, flex: 1, lineHeight: 20 },

  selectedWeekBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.success + '12',
    borderRadius: 12, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: Colors.success + '30',
  },
  selectedWeekText: { fontSize: 13, color: Colors.success, fontWeight: '600' },

  overallRating: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  overallRatingVal: { fontSize: 52, fontWeight: '900', color: Colors.text },
  overallStars: { gap: 4 },
  overallReviewCount: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },

  reviewCard: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, marginBottom: 14,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  reviewAvatar: { fontSize: 28 },
  reviewMeta: { flex: 1 },
  reviewAuthor: { fontSize: 14, fontWeight: '700', color: Colors.text },
  reviewDate: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: 16, paddingTop: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 8,
  },
  footerPrice: { flex: 1 },
  footerPriceVal: { fontSize: 24, fontWeight: '900', color: Colors.primary },
  footerPriceUnit: { fontSize: 12, color: Colors.textMuted },
  footerDateHint: { fontSize: 11, color: Colors.success, fontWeight: '600', marginTop: 2 },
  bookBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  bookBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})
