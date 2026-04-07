/**
 * BookingPaymentScreen — Stripe payment confirmation for charter bookings.
 *
 * Setup (run once after cloning):
 *   npx expo install @stripe/stripe-react-native
 *
 * Then wrap your root layout with <StripeProvider> (see app/_layout.tsx):
 *   import { StripeProvider } from '@stripe/stripe-react-native'
 *   <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
 *     <Stack />
 *   </StripeProvider>
 *
 * Flow:
 *   BookingScreen (creates BM reservation + backend booking, gets clientSecret)
 *     → navigate here with clientSecret + booking metadata
 *   BookingPaymentScreen
 *     → calls stripe.confirmPayment(clientSecret, { type: 'Card', ... })
 *     → on success: navigate to BookingConfirmationScreen (or back to charter tab)
 *     → on failure: show inline error, allow retry
 *
 * The backend confirms payment server-side via the payment_intent.succeeded webhook.
 * We NEVER mark a booking as PAID from the client — we only poll or navigate on
 * the optimistic assumption that the webhook will fire within a few seconds.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  useStripe,
  CardField,
  CardFieldInput,
} from '@stripe/stripe-react-native'
import { Colors } from '../constants/colors'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number, currency: string): string {
  const amount = cents / 100
  const symbol = currency.toLowerCase() === 'usd' ? '$' : '€'
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateRange(from: string, to: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
  return `${new Date(from).toLocaleDateString('en-GB', opts)} – ${new Date(to).toLocaleDateString('en-GB', opts)}`
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookingPaymentScreen() {
  const insets = useSafeAreaInsets()
  const { confirmPayment } = useStripe()

  // Route params injected by BookingScreen when navigating here
  const params = useLocalSearchParams<{
    clientSecret: string
    bookingId: string
    bookingReference: string
    yachtName: string
    dateFrom: string
    dateTo: string
    totalCents: string
    currency: string
  }>()

  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null)
  const [loading, setLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const totalCents = parseInt(params.totalCents ?? '0', 10)
  const currency = params.currency ?? 'eur'

  // ── Payment handler ─────────────────────────────────────────────────────────

  const handlePay = async () => {
    if (!cardDetails?.complete) {
      setPaymentError('Please enter your complete card details.')
      return
    }
    if (!params.clientSecret) {
      setPaymentError('Payment session expired. Please go back and try again.')
      return
    }

    setPaymentError(null)
    setLoading(true)

    try {
      /**
       * confirmPayment sends the card details to Stripe and confirms the
       * PaymentIntent identified by clientSecret.
       *
       * The platform backend is NOT involved at this point — Stripe handles
       * card authorisation and routes the funds to the connected account.
       *
       * If the card requires 3DS authentication, Stripe automatically opens
       * an in-app browser for the bank challenge before resolving.
       */
      const { error, paymentIntent } = await confirmPayment(params.clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: {
            // The server already set receipt_email; no need to re-collect here
          },
        },
      })

      if (error) {
        // Stripe-provided localised error message — safe to show directly
        setPaymentError(error.message ?? 'Payment failed. Please try a different card.')
        return
      }

      if (paymentIntent?.status === 'Succeeded') {
        /**
         * Payment confirmed client-side.
         * The webhook (payment_intent.succeeded) will mark the booking PAID
         * on the server — this usually fires within 1-2 seconds.
         *
         * We navigate to the success screen immediately (optimistic) rather
         * than polling, keeping the UX fast.
         */
        router.replace({
          pathname: '/booking-success',
          params: {
            bookingReference: params.bookingReference,
            yachtName: params.yachtName,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            totalCents: params.totalCents,
            currency: params.currency,
          },
        })
      }
    } catch (err: any) {
      setPaymentError('An unexpected error occurred. Please try again.')
      console.error('[BookingPaymentScreen] confirmPayment error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Booking summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.yachtName}>{params.yachtName}</Text>
          <Text style={styles.dateRange}>
            {formatDateRange(params.dateFrom ?? '', params.dateTo ?? '')}
          </Text>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatCents(totalCents, currency)}</Text>
          </View>
          <Text style={styles.refNote}>Booking ref: {params.bookingReference}</Text>
        </View>

        {/* Card input */}
        <Text style={styles.sectionLabel}>Card details</Text>
        <CardField
          postalCodeEnabled={false}
          placeholders={{ number: '4242 4242 4242 4242' }}
          cardStyle={{
            backgroundColor: Colors.surface,
            textColor: Colors.text,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: Colors.border,
            placeholderColor: Colors.textMuted,
          }}
          style={styles.cardField}
          onCardChange={setCardDetails}
        />

        {/* Error message */}
        {paymentError && (
          <View style={styles.errorBox}>
            <Ionicons name="warning-outline" size={16} color="#F87171" />
            <Text style={styles.errorText}>{paymentError}</Text>
          </View>
        )}

        {/* Stripe badge */}
        <View style={styles.stripeBadge}>
          <Ionicons name="lock-closed-outline" size={13} color={Colors.textMuted ?? '#6B7B8D'} />
          <Text style={styles.stripeText}>Secured by Stripe · 256-bit TLS encryption</Text>
        </View>
      </ScrollView>

      {/* Pay button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.payButton,
            (!cardDetails?.complete || loading) && styles.payButtonDisabled,
          ]}
          onPress={handlePay}
          disabled={!cardDetails?.complete || loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payButtonText}>
              Pay {formatCents(totalCents, currency)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border ?? '#2A3A4A',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  yachtName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  dateRange: {
    fontSize: 14,
    color: Colors.textSecondary ?? '#8FA3B1',
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border ?? '#2A3A4A',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  refNote: {
    fontSize: 12,
    color: Colors.textMuted ?? '#6B7B8D',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary ?? '#8FA3B1',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: -12,
  },
  cardField: {
    width: '100%',
    height: 52,
    borderRadius: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#F87171',
    flex: 1,
  },
  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 4,
  },
  stripeText: {
    fontSize: 12,
    color: Colors.textMuted ?? '#6B7B8D',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border ?? '#2A3A4A',
    backgroundColor: Colors.background,
  },
  payButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    opacity: 0.45,
  },
  payButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
})
