import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, TouchableWithoutFeedback,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { CharterFilters as FilterState, BOAT_TYPE_LABELS, BoatType, DEFAULT_FILTERS } from '../../types/charter'
import { Colors } from '../../constants/colors'

interface Props {
  visible: boolean
  filters: FilterState
  onApply: (filters: FilterState) => void
  onClose: () => void
}

const BOAT_TYPES: Array<BoatType | 'ALL'> = ['ALL', 'SAILBOAT', 'CATAMARAN', 'MOTOR_YACHT', 'GULET']
const CABIN_OPTIONS = [0, 2, 3, 4, 5]
const PRICE_OPTIONS = [3000, 5000, 7500, 10000, 20000]
const LENGTH_OPTIONS = [0, 10, 12, 14, 16]
const YEAR_OPTIONS = [2010, 2015, 2018, 2020, 2022]
const RATING_OPTIONS = [0, 3.5, 4.0, 4.5, 4.8]

function formatPrice(v: number) {
  return v >= 20000 ? 'Any' : `€${v.toLocaleString()}`
}
function formatLength(v: number) {
  return v === 0 ? 'Any' : `${v}m+`
}
function formatYear(v: number) {
  return v <= 2010 ? 'Any' : `${v}+`
}
function formatRating(v: number) {
  return v === 0 ? 'Any' : `${v}+`
}

export function CharterFilters({ visible, filters, onApply, onClose }: Props) {
  const [local, setLocal] = useState<FilterState>(filters)

  const update = <K extends keyof FilterState>(key: K, val: FilterState[K]) => {
    setLocal((s) => ({ ...s, [key]: val }))
  }

  const handleApply = () => {
    onApply(local)
    onClose()
  }

  const handleReset = () => {
    setLocal({ ...DEFAULT_FILTERS })
  }

  const activeCount = [
    local.boatType !== 'ALL',
    local.minCabins > 0,
    local.maxPricePerWeek < 20000,
    local.minYear > 2010,
    local.minRating > 0,
    local.minLengthM > 0,
  ].filter(Boolean).length

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          <Text style={styles.sheetTitle}>Filters {activeCount > 0 ? `· ${activeCount}` : ''}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Boat type */}
          <Section title="Boat Type">
            <View style={styles.chips}>
              {BOAT_TYPES.map((t) => (
                <ChipBtn
                  key={t}
                  label={t === 'ALL' ? 'All types' : BOAT_TYPE_LABELS[t as BoatType]}
                  active={local.boatType === t}
                  onPress={() => update('boatType', t)}
                />
              ))}
            </View>
          </Section>

          {/* Cabins */}
          <Section title="Minimum Cabins">
            <View style={styles.chips}>
              {CABIN_OPTIONS.map((n) => (
                <ChipBtn
                  key={n}
                  label={n === 0 ? 'Any' : `${n}+`}
                  active={local.minCabins === n}
                  onPress={() => update('minCabins', n)}
                />
              ))}
            </View>
          </Section>

          {/* Max price */}
          <Section title="Max Price / Week">
            <View style={styles.chips}>
              {PRICE_OPTIONS.map((p) => (
                <ChipBtn
                  key={p}
                  label={formatPrice(p)}
                  active={local.maxPricePerWeek === p}
                  onPress={() => update('maxPricePerWeek', p)}
                />
              ))}
            </View>
          </Section>

          {/* Minimum length */}
          <Section title="Minimum Length">
            <View style={styles.chips}>
              {LENGTH_OPTIONS.map((l) => (
                <ChipBtn
                  key={l}
                  label={formatLength(l)}
                  active={local.minLengthM === l}
                  onPress={() => update('minLengthM', l)}
                />
              ))}
            </View>
          </Section>

          {/* Year built */}
          <Section title="Year Built">
            <View style={styles.chips}>
              {YEAR_OPTIONS.map((y) => (
                <ChipBtn
                  key={y}
                  label={formatYear(y)}
                  active={local.minYear === y}
                  onPress={() => update('minYear', y)}
                />
              ))}
            </View>
          </Section>

          {/* Rating */}
          <Section title="Minimum Rating">
            <View style={styles.chips}>
              {RATING_OPTIONS.map((r) => (
                <ChipBtn
                  key={r}
                  label={formatRating(r)}
                  active={local.minRating === r}
                  onPress={() => update('minRating', r)}
                />
              ))}
            </View>
          </Section>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Apply button */}
        <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.85}>
          <Text style={styles.applyText}>Show Results</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function ChipBtn({
  label, active, onPress,
}: {
  label: string; active: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.40)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  resetText: { fontSize: 14, color: Colors.secondary, fontWeight: '600' },

  section: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 24, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  applyBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center',
  },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
