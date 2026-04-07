import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'

function formatCents(cents: number, currency: string): string {
  const symbol = currency.toLowerCase() === 'usd' ? '$' : '€'
  return `${symbol}${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function formatDateRange(from: string, to: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  return `${new Date(from).toLocaleDateString('en-GB', opts)} – ${new Date(to).toLocaleDateString('en-GB', opts)}`
}

export default function BookingSuccessScreen() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    bookingReference: string
    yachtName: string
    dateFrom: string
    dateTo: string
    totalCents: string
    currency: string
  }>()

  const totalCents = parseInt(params.totalCents ?? '0', 10)

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
      </View>

      <Text style={styles.title}>Booking Confirmed!</Text>
      <Text style={styles.subtitle}>Your payment was successful and your charter is reserved.</Text>

      <View style={styles.card}>
        <Row label="Yacht"      value={params.yachtName ?? ''} />
        <Row label="Dates"      value={formatDateRange(params.dateFrom ?? '', params.dateTo ?? '')} />
        <Row label="Total paid" value={formatCents(totalCents, params.currency ?? 'eur')} />
        <Row label="Reference"  value={params.bookingReference ?? ''} mono />
      </View>

      <Text style={styles.note}>
        A receipt has been sent to your email. The charter company will contact you with
        boarding instructions closer to your departure date.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(tabs)/charter')}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Back to Charter</Text>
      </TouchableOpacity>
    </View>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, mono && rowStyles.mono]}>{value}</Text>
    </View>
  )
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label: { fontSize: 14, color: Colors.textSecondary ?? '#8FA3B1' },
  value: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'right' },
  mono: { fontVariant: ['tabular-nums'] },
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    marginTop: 48,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary ?? '#8FA3B1',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 22,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  note: {
    fontSize: 13,
    color: Colors.textMuted ?? '#6B7B8D',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  button: {
    marginTop: 'auto',
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
})
