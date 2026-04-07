import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Switch, Alert,
  Image, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { AvailabilityCalendar } from '../components/charter/AvailabilityCalendar'
import { useCharterStore } from '../store/charterStore'
import { BookingDraft, EMPTY_BOOKING } from '../types/charter'
import { Colors } from '../constants/colors'
import { bookingApi } from '../services/bookingApi'

type Step = 'dates' | 'extras' | 'details' | 'confirm'

const STEPS: Step[] = ['dates', 'extras', 'details', 'confirm']

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookingScreen() {
  const { id, checkIn } = useLocalSearchParams<{ id: string; checkIn?: string }>()
  const insets = useSafeAreaInsets()

  const { getYachtById, createReservation, bookingLoading, bookingError, clearBooking, bookedWeeks } = useCharterStore()
  const yacht = getYachtById(id ?? '')

  const [step, setStep]       = useState<Step>('dates')
  const [draft, setDraft]     = useState<BookingDraft>({
    ...EMPTY_BOOKING,
    yachtId: id ?? '',
    startDate: checkIn ?? null,
    endDate: checkIn ? addDays(checkIn, 7) : null,
  })
  const [errors, setErrors]   = useState<Partial<Record<keyof BookingDraft, string>>>({})

  // ── Navigation ─────────────────────────────────────────────────────────────

  const currentStepIndex = STEPS.indexOf(step)

  const canProceed = (): boolean => {
    if (step === 'dates') return !!(draft.startDate && draft.endDate && draft.guests >= 1)
    if (step === 'extras') return true
    if (step === 'details') {
      return !!(draft.firstName.trim() && draft.lastName.trim() && draft.email.trim() && draft.phone.trim())
    }
    return true
  }

  const validateDetails = (): boolean => {
    const newErrors: typeof errors = {}
    if (!draft.firstName.trim()) newErrors.firstName = 'Required'
    if (!draft.lastName.trim())  newErrors.lastName  = 'Required'
    if (!draft.email.includes('@')) newErrors.email = 'Valid email required'
    if (draft.phone.trim().length < 6) newErrors.phone = 'Valid phone required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 'details' && !validateDetails()) return
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const handleBack = () => {
    const idx = STEPS.indexOf(step)
    if (idx === 0) router.back()
    else setStep(STEPS[idx - 1])
  }

  const handleConfirm = async () => {
    if (!yacht) return

    try {
      // Step 1: Create a BM reservation option (holds the yacht)
      const summary = await createReservation(draft)

      // Step 2: Build the booking payload with fully validated fields.

      const totalCents = Math.round(total * 100)

      // Convert date-only strings ("2024-06-01") to full ISO 8601 datetimes
      // ("2024-06-01T00:00:00.000Z"). Zod's z.string().datetime() rejects
      // date-only format — this normalisation is required.
      const dateFrom = new Date(draft.startDate!).toISOString()
      const dateTo   = new Date(draft.endDate!).toISOString()

      // Normalise expiresAt the same way regardless of what BM returns.
      const expiresAt = summary.expiresAt
        ? new Date(summary.expiresAt).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      // charterCompanyId is sent as-is (BM numeric string or our UUID).
      // The backend resolves it via resolveCharterCompany(). In dev/mock mode
      // it falls back to the seeded dev company when nothing matches.
      // An empty string signals "use dev default" to the service.
      const charterCompanyId = yacht.charterCompanyId ?? ''
      const payload = {
        yachtId:          yacht.id,
        yachtName:        yacht.name,
        charterCompanyId,
        dateFrom,
        dateTo,
        guests:           draft.guests,
        currency:         'eur',
        totalCents,
        expiresAt,
        bmReservationId:  String(summary.reservationId),
        bmReservationCode: summary.reservationCode,
      }

      if (__DEV__) {
        console.log('[BookingScreen] POST /api/bookings payload:', JSON.stringify(payload, null, 2))
      }

      const bookingResult = await bookingApi.create(payload)

      // Step 3: Navigate to payment screen with client_secret
      clearBooking()
      router.replace({
        pathname: '/booking-payment',
        params: {
          clientSecret: bookingResult.clientSecret,
          bookingId: bookingResult.bookingId,
          bookingReference: bookingResult.bookingReference,
          yachtName: yacht.name,
          dateFrom: draft.startDate!,
          dateTo: draft.endDate!,
          totalCents: String(bookingResult.totalCents),
          currency: bookingResult.currency,
        },
      })
    } catch (err: any) {
      Alert.alert(
        'Booking Failed',
        err.message ?? 'Something went wrong. Please try again.',
        [{ text: 'OK' }],
      )
    }
  }

  const update = <K extends keyof BookingDraft>(key: K, val: BookingDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: val }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  if (!yacht) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.notFoundText}>Yacht not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Price calculation ──────────────────────────────────────────────────────
  const weeks = draft.startDate && draft.endDate
    ? Math.round((new Date(draft.endDate).getTime() - new Date(draft.startDate).getTime()) / (7 * 24 * 3600 * 1000))
    : 1
  const basePrice = yacht.pricePerWeekEur * weeks
  const skipperFee = draft.skipperRequired && yacht.skipperCostPerDayEur
    ? yacht.skipperCostPerDayEur * 7 * weeks : 0
  const linenFee  = draft.linenPackage ? 30 * (yacht.guests) : 0
  const total = basePrice + skipperFee + linenFee

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'dates'   ? 'Choose Dates'
            : step === 'extras'  ? 'Add Extras'
            : step === 'details' ? 'Your Details'
            : 'Confirm Booking'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* ── Progress indicator ── */}
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.progressStep}>
            <View style={[
              styles.progressDot,
              i < currentStepIndex  && styles.progressDotDone,
              i === currentStepIndex && styles.progressDotActive,
            ]}>
              {i < currentStepIndex
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[styles.progressNum, i === currentStepIndex && { color: '#fff' }]}>{i + 1}</Text>
              }
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.progressLine, i < currentStepIndex && styles.progressLineDone]} />
            )}
          </View>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* ── Yacht mini card ── */}
        <View style={styles.yachtCard}>
          <Image source={{ uri: yacht.images[0] }} style={styles.yachtCardImage} />
          <View style={styles.yachtCardBody}>
            <Text style={styles.yachtCardName}>{yacht.name}</Text>
            <Text style={styles.yachtCardModel}>{yacht.model}</Text>
            <View style={styles.yachtCardMeta}>
              <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.yachtCardLocation}>{yacht.city}, {yacht.country}</Text>
            </View>
          </View>
          <View style={styles.yachtCardPrice}>
            <Text style={styles.yachtCardPriceVal}>€{yacht.pricePerWeekEur.toLocaleString()}</Text>
            <Text style={styles.yachtCardPriceUnit}>/week</Text>
          </View>
        </View>

        {/* ── Step: Dates ── */}
        {step === 'dates' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>
              Select your charter week and number of guests.
            </Text>

            {/* Guests selector */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Guests</Text>
              <View style={styles.guestSelector}>
                <TouchableOpacity
                  style={[styles.guestBtn, draft.guests <= 1 && styles.guestBtnDisabled]}
                  onPress={() => draft.guests > 1 && update('guests', draft.guests - 1)}
                >
                  <Ionicons name="remove" size={18} color={draft.guests <= 1 ? Colors.textMuted : Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.guestCount}>{draft.guests}</Text>
                <TouchableOpacity
                  style={[styles.guestBtn, draft.guests >= yacht.guests && styles.guestBtnDisabled]}
                  onPress={() => draft.guests < yacht.guests && update('guests', draft.guests + 1)}
                >
                  <Ionicons name="add" size={18} color={draft.guests >= yacht.guests ? Colors.textMuted : Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.guestMax}>/ {yacht.guests} max</Text>
              </View>
            </View>

            {/* Calendar */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Select Week</Text>
              <AvailabilityCalendar
                bookedWeeks={bookedWeeks[yacht.id] ?? yacht.bookedWeeks}
                selectedCheckIn={draft.startDate}
                onSelectWeek={(checkIn, checkOut) => {
                  update('startDate', checkIn)
                  update('endDate', checkOut)
                }}
              />
            </View>

            {/* Selected week summary */}
            {draft.startDate && draft.endDate && (
              <View style={styles.dateSummary}>
                <DateSummaryItem
                  icon="log-in-outline"
                  label="Check-in"
                  value={formatDate(draft.startDate)}
                />
                <View style={styles.dateSummaryArrow}>
                  <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
                </View>
                <DateSummaryItem
                  icon="log-out-outline"
                  label="Check-out"
                  value={formatDate(draft.endDate)}
                />
              </View>
            )}
          </View>
        )}

        {/* ── Step: Extras ── */}
        {step === 'extras' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>
              Customise your charter with optional add-ons.
            </Text>

            {/* Skipper */}
            {yacht.skipper === 'optional' && yacht.skipperCostPerDayEur && (
              <View style={styles.extraCard}>
                <View style={styles.extraIcon}>
                  <Ionicons name="person" size={22} color={Colors.secondary} />
                </View>
                <View style={styles.extraBody}>
                  <Text style={styles.extraTitle}>Professional Skipper</Text>
                  <Text style={styles.extraDesc}>
                    Experienced local skipper guides your trip.{'\n'}
                    €{yacht.skipperCostPerDayEur}/day · €{yacht.skipperCostPerDayEur * 7} for the week
                  </Text>
                </View>
                <Switch
                  value={draft.skipperRequired}
                  onValueChange={(v) => update('skipperRequired', v)}
                  trackColor={{ false: '#CBD5E1', true: Colors.secondary }}
                  thumbColor="#fff"
                />
              </View>
            )}

            {yacht.skipper === 'required' && (
              <View style={[styles.extraCard, styles.extraCardIncluded]}>
                <View style={[styles.extraIcon, { backgroundColor: Colors.success + '15' }]}>
                  <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                </View>
                <View style={styles.extraBody}>
                  <Text style={styles.extraTitle}>Skipper — Included</Text>
                  <Text style={styles.extraDesc}>Professional captain and crew included in price.</Text>
                </View>
              </View>
            )}

            {/* Linen */}
            <View style={styles.extraCard}>
              <View style={styles.extraIcon}>
                <Ionicons name="bed" size={22} color="#C9963A" />
              </View>
              <View style={styles.extraBody}>
                <Text style={styles.extraTitle}>Linen & Towel Package</Text>
                <Text style={styles.extraDesc}>
                  Fresh bedding and towels for all guests.{'\n'}
                  €30 per person · €{30 * yacht.guests} total
                </Text>
              </View>
              <Switch
                value={draft.linenPackage}
                onValueChange={(v) => update('linenPackage', v)}
                trackColor={{ false: '#CBD5E1', true: Colors.secondary }}
                thumbColor="#fff"
              />
            </View>

            {/* Price summary */}
            <View style={styles.priceSummaryCard}>
              <Text style={styles.priceSummaryTitle}>Price Summary</Text>
              <PriceRow label={`Charter (${weeks} week${weeks > 1 ? 's' : ''})`} value={`€${basePrice.toLocaleString()}`} />
              {skipperFee > 0 && <PriceRow label="Skipper" value={`€${skipperFee.toLocaleString()}`} />}
              {linenFee > 0 && <PriceRow label="Linen package" value={`€${linenFee.toLocaleString()}`} />}
              <View style={styles.priceDivider} />
              <PriceRow label="Total" value={`€${total.toLocaleString()}`} bold />
              <PriceRow label="Security deposit (refundable)" value={`€${yacht.depositEur.toLocaleString()}`} muted />
            </View>
          </View>
        )}

        {/* ── Step: Details ── */}
        {step === 'details' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>
              Tell the charter company about yourself so they can prepare your boat.
            </Text>

            <View style={styles.formRow}>
              <FormField
                label="First name"
                value={draft.firstName}
                onChangeText={(v) => update('firstName', v)}
                placeholder="Alex"
                error={errors.firstName}
                style={{ flex: 1 }}
              />
              <FormField
                label="Last name"
                value={draft.lastName}
                onChangeText={(v) => update('lastName', v)}
                placeholder="Smith"
                error={errors.lastName}
                style={{ flex: 1 }}
              />
            </View>

            <FormField
              label="Email address"
              value={draft.email}
              onChangeText={(v) => update('email', v)}
              placeholder="alex@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <FormField
              label="Phone number"
              value={draft.phone}
              onChangeText={(v) => update('phone', v)}
              placeholder="+44 7911 123456"
              keyboardType="phone-pad"
              error={errors.phone}
            />

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Additional notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={draft.notes}
                onChangeText={(v) => update('notes', v)}
                placeholder="Sailing experience, special requests, dietary requirements…"
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        )}

        {/* ── Step: Confirm ── */}
        {step === 'confirm' && (
          <View style={styles.stepContent}>
            <Text style={styles.stepDesc}>
              Review your booking request before sending.
            </Text>

            {/* Booking summary */}
            <View style={styles.summaryCard}>
              <SummaryRow icon="calendar-outline"    label="Check-in"  value={draft.startDate ? formatDate(draft.startDate) : '—'} />
              <SummaryRow icon="calendar"            label="Check-out" value={draft.endDate ? formatDate(draft.endDate) : '—'} />
              <SummaryRow icon="people-outline"      label="Guests"    value={`${draft.guests} person${draft.guests > 1 ? 's' : ''}`} />
              {draft.skipperRequired && (
                <SummaryRow icon="person-outline"    label="Skipper"   value="Yes (optional)" />
              )}
              {draft.linenPackage && (
                <SummaryRow icon="bed-outline"       label="Linen"     value="Included" />
              )}
            </View>

            <View style={styles.summaryCard}>
              <SummaryRow icon="person-circle-outline" label="Name" value={`${draft.firstName} ${draft.lastName}`} />
              <SummaryRow icon="mail-outline"           label="Email" value={draft.email} />
              <SummaryRow icon="call-outline"           label="Phone" value={draft.phone} />
            </View>

            {/* Price total */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Charter Cost</Text>
              <Text style={styles.totalValue}>€{total.toLocaleString()}</Text>
              <Text style={styles.totalNote}>
                Deposit of €{yacht.depositEur.toLocaleString()} payable upon confirmation.{'\n'}
                No payment is taken at this stage — this is an enquiry only.
              </Text>
            </View>

            {/* Disclaimer */}
            <View style={styles.disclaimer}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.disclaimerText}>
                This is a booking request only. The charter company will confirm availability and contact you within 24 hours to finalise payment arrangements.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky footer ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step !== 'confirm' ? (
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>
              {step === 'details' ? 'Review Booking' : 'Continue'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.confirmBtn, bookingLoading && { opacity: 0.7 }]}
            onPress={handleConfirm}
            activeOpacity={0.85}
            disabled={bookingLoading}
          >
            {bookingLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send-outline" size={18} color="#fff" />
            )}
            <Text style={styles.confirmBtnText}>
              {bookingLoading ? 'Processing…' : 'Send Booking Request'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DateSummaryItem({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={date_styles.item}>
      <Ionicons name={icon} size={16} color={Colors.secondary} />
      <Text style={date_styles.label}>{label}</Text>
      <Text style={date_styles.value}>{value}</Text>
    </View>
  )
}

function PriceRow({
  label, value, bold, muted,
}: {
  label: string; value: string; bold?: boolean; muted?: boolean
}) {
  return (
    <View style={price_styles.row}>
      <Text style={[price_styles.label, muted && { color: Colors.textMuted }]}>{label}</Text>
      <Text style={[price_styles.value, bold && price_styles.bold, muted && { color: Colors.textMuted }]}>
        {value}
      </Text>
    </View>
  )
}

function FormField({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize, error, style, ...rest
}: any) {
  return (
    <View style={[styles.fieldGroup, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'words'}
        {...rest}
      />
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  )
}

function SummaryRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={summary_styles.row}>
      <Ionicons name={icon} size={16} color={Colors.secondary} />
      <Text style={summary_styles.label}>{label}</Text>
      <Text style={summary_styles.value} numberOfLines={1}>{value}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 18, fontWeight: '700', color: Colors.text },
  backLink: { backgroundColor: Colors.primary + '12', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  backLinkText: { color: Colors.primary, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },

  progress: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  progressStep: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  progressDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.background, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  progressDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  progressDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  progressNum: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  progressLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  progressLineDone: { backgroundColor: Colors.success },

  yachtCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', margin: 16, borderRadius: 14,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  yachtCardImage: { width: 80, height: 80 },
  yachtCardBody: { flex: 1, padding: 10 },
  yachtCardName: { fontSize: 14, fontWeight: '800', color: Colors.text },
  yachtCardModel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  yachtCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  yachtCardLocation: { fontSize: 11, color: Colors.textMuted },
  yachtCardPrice: { paddingRight: 14, alignItems: 'flex-end' },
  yachtCardPriceVal: { fontSize: 16, fontWeight: '900', color: Colors.primary },
  yachtCardPriceUnit: { fontSize: 10, color: Colors.textMuted },

  stepContent: { paddingHorizontal: 16, paddingTop: 4 },
  stepDesc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 20 },

  field: { marginBottom: 20 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text, backgroundColor: '#fff',
  },
  inputMultiline: { minHeight: 96, paddingTop: 12 },
  inputError: { borderColor: '#EF4444' },
  fieldError: { fontSize: 11, color: '#EF4444', marginTop: 4 },
  formRow: { flexDirection: 'row', gap: 12 },

  guestSelector: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  guestBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  guestBtnDisabled: { borderColor: Colors.border },
  guestCount: { fontSize: 22, fontWeight: '800', color: Colors.text, minWidth: 32, textAlign: 'center' },
  guestMax: { fontSize: 13, color: Colors.textMuted },

  dateSummary: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary + '08',
    borderRadius: 14, padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: Colors.primary + '20',
  },
  dateSummaryArrow: { paddingHorizontal: 8 },

  extraCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 12, gap: 12,
  },
  extraCardIncluded: { borderColor: Colors.success + '40', backgroundColor: Colors.success + '06' },
  extraIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  extraBody: { flex: 1 },
  extraTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  extraDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },

  priceSummaryCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  priceSummaryTitle: { fontSize: 14, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  priceDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 10 },

  summaryCard: {
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 12, overflow: 'hidden',
  },
  totalCard: {
    backgroundColor: Colors.primary,
    borderRadius: 14, padding: 18, marginBottom: 12, alignItems: 'center',
  },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6 },
  totalValue: { fontSize: 36, fontWeight: '900', color: '#fff', marginBottom: 10 },
  totalNote: { fontSize: 12, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 18 },

  disclaimer: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.background, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  disclaimerText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  footer: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 6,
  },
  nextBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  confirmBtn: {
    backgroundColor: Colors.success, borderRadius: 14,
    paddingVertical: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})

const date_styles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 11, color: Colors.textMuted },
  value: { fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'center' },
})

const price_styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 13, color: Colors.textSecondary },
  value: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  bold: { fontSize: 16, fontWeight: '800', color: Colors.primary },
})

const summary_styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  label: { width: 80, fontSize: 13, color: Colors.textSecondary },
  value: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
})
