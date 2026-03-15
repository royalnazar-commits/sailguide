import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, TextInput, Alert, Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCaptainStore } from '../store/captainStore'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { usePlacesStore } from '../store/placesStore'
import { useAuthStore } from '../store/authStore'
import { Colors } from '../constants/colors'
import { UserRoute } from '../types/userRoute'
import { Place } from '../types/place'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(val: number) {
  return val === 0 ? 'Free' : `$${val.toFixed(2)}`
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CaptainDashboardScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { captainSettings, updateCaptainSettings } = useCaptainStore()
  const { savedRoutes, setRoutePremium, publishRoute, unpublishRoute } = useRouteBuilderStore()
  const { userPlaces, setPlacePremium } = usePlacesStore()

  const [subPriceInput, setSubPriceInput] = useState(
    captainSettings.subscriptionPriceUsd.toString(),
  )

  // Price-setting modal state
  const [priceModal, setPriceModal] = useState<{
    type: 'ROUTE' | 'PLACE'
    id: string
    name: string
    current: string
  } | null>(null)
  const [priceModalInput, setPriceModalInput] = useState('')

  const captainId = user?.id ?? ''

  // My published + draft routes (captain's own content)
  const myRoutes = savedRoutes

  // My places
  const myPlaces = userPlaces.filter((p) => p.createdBy === captainId)

  const premiumRoutes = myRoutes.filter((r) => r.isPremium).length
  const premiumPlaces = myPlaces.filter((p) => p.isPremium).length

  const handleSaveSubPrice = () => {
    const val = parseFloat(subPriceInput)
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid price', 'Please enter a valid price.')
      return
    }
    updateCaptainSettings({ subscriptionPriceUsd: parseFloat(val.toFixed(2)) })
    Alert.alert('Saved', 'Subscription price updated.')
  }

  const handleToggleRoutePremium = (route: UserRoute) => {
    if (route.isPremium) {
      Alert.alert(
        'Make Free',
        `Remove the $${route.priceUsd} price from "${route.title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Make Free', onPress: () => setRoutePremium(route.id, false, 0) },
        ],
      )
    } else {
      const defaultPrice = route.priceUsd?.toString() || '4.99'
      setPriceModalInput(defaultPrice)
      setPriceModal({ type: 'ROUTE', id: route.id, name: route.title || 'Untitled', current: defaultPrice })
    }
  }

  const handleTogglePlacePremium = (place: Place) => {
    if (place.isPremium) {
      Alert.alert(
        'Make Free',
        `Remove the $${place.priceUsd} price from "${place.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Make Free', onPress: () => setPlacePremium(place.id, false, 0) },
        ],
      )
    } else {
      const defaultPrice = place.priceUsd?.toString() || '1.99'
      setPriceModalInput(defaultPrice)
      setPriceModal({ type: 'PLACE', id: place.id, name: place.name, current: defaultPrice })
    }
  }

  const handleConfirmPrice = () => {
    if (!priceModal) return
    const price = parseFloat(priceModalInput)
    if (isNaN(price) || price < 0) {
      Alert.alert('Invalid price', 'Enter a number greater than or equal to 0.')
      return
    }
    const rounded = parseFloat(price.toFixed(2))
    if (priceModal.type === 'ROUTE') {
      setRoutePremium(priceModal.id, true, rounded)
    } else {
      setPlacePremium(priceModal.id, true, rounded)
    }
    setPriceModal(null)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Captain Dashboard</Text>
        <View style={styles.verifiedBadge}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.verified} />
          <Text style={styles.verifiedText}>Captain</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard icon="map-outline" value={myRoutes.length} label="Routes" color={Colors.primary} />
          <StatCard icon="location-outline" value={myPlaces.length} label="Places" color="#00B4D8" />
          <StatCard icon="lock-closed-outline" value={premiumRoutes + premiumPlaces} label="Premium" color={Colors.warning} />
        </View>

        {/* ── Subscription ── */}
        <SectionHeader title="Subscription" icon="card-outline" />
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardRowLeft}>
              <Text style={styles.cardTitle}>Enable Subscription</Text>
              <Text style={styles.cardSub}>
                Let sailors subscribe for access to all your premium content
              </Text>
            </View>
            <Switch
              value={captainSettings.subscriptionEnabled}
              onValueChange={(val) => updateCaptainSettings({ subscriptionEnabled: val })}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {captainSettings.subscriptionEnabled && (
            <View style={styles.priceInputRow}>
              <Text style={styles.priceInputLabel}>Monthly price (USD)</Text>
              <View style={styles.priceInputWrap}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.priceInput}
                  value={subPriceInput}
                  onChangeText={setSubPriceInput}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSaveSubPrice}
                />
              </View>
              <TouchableOpacity style={styles.savePriceBtn} onPress={handleSaveSubPrice}>
                <Text style={styles.savePriceText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── My Routes ── */}
        <SectionHeader title="My Routes" icon="map" />

        {myRoutes.length === 0 ? (
          <EmptyCard
            message="No routes yet. Build a route and publish it to offer it here."
            action="Build a Route"
            onAction={() => router.push('/route-builder')}
          />
        ) : (
          myRoutes.map((route) => (
            <RouteRow
              key={route.id}
              route={route}
              onTogglePremium={() => handleToggleRoutePremium(route)}
              onTogglePublish={() =>
                route.status === 'PUBLISHED'
                  ? unpublishRoute(route.id)
                  : publishRoute(route.id, user?.name)
              }
            />
          ))
        )}

        {/* ── My Places ── */}
        <SectionHeader title="My Places" icon="location" />

        {myPlaces.length === 0 ? (
          <EmptyCard
            message="No places yet. Add a place on the Explore map to offer it here."
            action="Add a Place"
            onAction={() => router.push('/create-place')}
          />
        ) : (
          myPlaces.map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              onTogglePremium={() => handleTogglePlacePremium(place)}
            />
          ))
        )}
      </ScrollView>

      {/* Price-setting modal */}
      <Modal
        visible={!!priceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPriceModal(null)}
      >
        <TouchableWithoutFeedback onPress={() => setPriceModal(null)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              Set Price for "{priceModal?.name}"
            </Text>
            <Text style={styles.modalSub}>Enter 0 to offer it for free.</Text>
            <View style={styles.modalInputRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.modalInput}
                value={priceModalInput}
                onChangeText={setPriceModalInput}
                keyboardType="decimal-pad"
                placeholder="4.99"
                placeholderTextColor={Colors.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirmPrice}
              />
            </View>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleConfirmPrice}>
              <Text style={styles.modalConfirmText}>Set Price</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPriceModal(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <View style={[statStyles.card, { borderTopColor: color }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  )
}

function SectionHeader({ title, icon }: { title: string; icon: any }) {
  return (
    <View style={secStyles.row}>
      <Ionicons name={icon} size={16} color={Colors.secondary} />
      <Text style={secStyles.title}>{title}</Text>
    </View>
  )
}

function EmptyCard({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyCardText}>{message}</Text>
      <TouchableOpacity style={styles.emptyCardBtn} onPress={onAction}>
        <Text style={styles.emptyCardBtnText}>{action}</Text>
      </TouchableOpacity>
    </View>
  )
}

function RouteRow({
  route,
  onTogglePremium,
  onTogglePublish,
}: {
  route: UserRoute
  onTogglePremium: () => void
  onTogglePublish: () => void
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <View style={styles.itemIconWrap}>
          <Ionicons name="map-outline" size={18} color={Colors.primary} />
        </View>
        <View style={styles.itemTextBlock}>
          <Text style={styles.itemTitle} numberOfLines={1}>{route.title || 'Untitled'}</Text>
          <View style={styles.itemMetaRow}>
            <StatusPill published={route.status === 'PUBLISHED'} />
            {route.isPremium && (
              <PricePill price={route.priceUsd ?? 0} />
            )}
          </View>
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.actionBtn, route.isPremium && styles.actionBtnActive]}
          onPress={onTogglePremium}
        >
          <Ionicons
            name={route.isPremium ? 'lock-closed' : 'lock-open-outline'}
            size={14}
            color={route.isPremium ? Colors.warning : Colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, route.status === 'PUBLISHED' && styles.actionBtnPublished]}
          onPress={onTogglePublish}
        >
          <Ionicons
            name={route.status === 'PUBLISHED' ? 'eye' : 'eye-off-outline'}
            size={14}
            color={route.status === 'PUBLISHED' ? Colors.success : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

function PlaceRow({
  place,
  onTogglePremium,
}: {
  place: Place
  onTogglePremium: () => void
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <View style={styles.itemIconWrap}>
          <Ionicons name="location-outline" size={18} color="#00B4D8" />
        </View>
        <View style={styles.itemTextBlock}>
          <Text style={styles.itemTitle} numberOfLines={1}>{place.name}</Text>
          <View style={styles.itemMetaRow}>
            <Text style={styles.itemRegion}>{place.region}</Text>
            {place.isPremium && (
              <PricePill price={place.priceUsd ?? 0} />
            )}
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.actionBtn, place.isPremium && styles.actionBtnActive]}
        onPress={onTogglePremium}
      >
        <Ionicons
          name={place.isPremium ? 'lock-closed' : 'lock-open-outline'}
          size={14}
          color={place.isPremium ? Colors.warning : Colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  )
}

function StatusPill({ published }: { published: boolean }) {
  return (
    <View style={[pillStyles.pill, published ? pillStyles.published : pillStyles.draft]}>
      <Text style={[pillStyles.text, published ? pillStyles.publishedText : pillStyles.draftText]}>
        {published ? 'Published' : 'Draft'}
      </Text>
    </View>
  )
}

function PricePill({ price }: { price: number }) {
  return (
    <View style={pillStyles.pricePill}>
      <Ionicons name="lock-closed" size={9} color={Colors.warning} />
      <Text style={pillStyles.priceText}>{formatPrice(price)}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  backBtn: { marginRight: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.text },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.verified + '15',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedText: { fontSize: 12, fontWeight: '600', color: Colors.verified },

  content: { padding: 16, gap: 12 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardRowLeft: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },

  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 14,
  },
  priceInputLabel: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  dollarSign: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  priceInput: { fontSize: 15, color: Colors.text, minWidth: 60, fontWeight: '700' },
  savePriceBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  savePriceText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 12,
  },
  emptyCardText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyCardBtn: {
    backgroundColor: Colors.primary + '12',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyCardBtnText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  itemRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    marginBottom: 8,
  },
  itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextBlock: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  itemRegion: { fontSize: 12, color: Colors.textMuted },
  itemActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnActive: { backgroundColor: Colors.warning + '15', borderColor: Colors.warning + '40' },
  actionBtnPublished: { backgroundColor: Colors.success + '15', borderColor: Colors.success + '40' },

  // Price-setting modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  modalSub: { fontSize: 13, color: Colors.textSecondary, marginTop: -8 },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  modalInput: { flex: 1, fontSize: 18, color: Colors.text, fontWeight: '700' },
  modalConfirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalCancelBtn: { alignItems: 'center', paddingVertical: 6 },
  modalCancelText: { color: Colors.textMuted, fontSize: 15 },
})

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  value: { fontSize: 22, fontWeight: '800', color: Colors.text },
  label: { fontSize: 12, color: Colors.textSecondary },
})

const secStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  title: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
})

const pillStyles = StyleSheet.create({
  pill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  published: { backgroundColor: Colors.success + '18' },
  draft: { backgroundColor: Colors.border },
  text: { fontSize: 11, fontWeight: '600' },
  publishedText: { color: Colors.success },
  draftText: { color: Colors.textMuted },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.warning + '18',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  priceText: { fontSize: 11, fontWeight: '700', color: Colors.warning },
})
