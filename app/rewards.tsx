import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useContributorStore } from '../src/store/contributorStore'
import { Colors } from '../src/constants/colors'
import { safeStorage } from '../src/utils/storage'

const ORDERS_KEY = 'rewards_orders_v1'

// ── Product catalog ───────────────────────────────────────────────────────────

type ProductId = 'tshirt' | 'cap'

interface Product {
  id: ProductId
  title: string
  subtitle: string
  priceRp: number
  hasSizes: boolean
  icon: string
}

const PRODUCTS: Product[] = [
  {
    id: 'tshirt',
    title: 'Skipperway T-Shirt',
    subtitle: 'Classic fit, premium cotton',
    priceRp: 300,
    hasSizes: true,
    icon: 'shirt-outline',
  },
  {
    id: 'cap',
    title: 'Skipperway Cap',
    subtitle: 'Adjustable, one size fits all',
    priceRp: 200,
    hasSizes: false,
    icon: 'sunny-outline',
  },
]

const SIZES = ['S', 'M', 'L', 'XL'] as const
type Size = typeof SIZES[number]

const MIN_LEVEL_TO_REDEEM = 2 // Skipper

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShippingForm {
  fullName: string
  phone: string
  address: string
  city: string
  postalCode: string
  country: string
}

const EMPTY_SHIPPING: ShippingForm = {
  fullName: '', phone: '', address: '', city: '', postalCode: '', country: '',
}

const FIELD_LABELS: Record<keyof ShippingForm, string> = {
  fullName: 'Full Name',
  phone: 'Phone',
  address: 'Address',
  city: 'City',
  postalCode: 'Postal Code',
  country: 'Country',
}

const FIELD_PLACEHOLDERS: Record<keyof ShippingForm, string> = {
  fullName: 'Your full name',
  phone: '+1 234 567 8900',
  address: 'Street address',
  city: 'City',
  postalCode: 'Postal / ZIP code',
  country: 'Country',
}

export interface RewardOrder {
  id: string
  productId: ProductId
  productTitle: string
  size?: Size
  quantity: number
  priceRp: number
  status: 'Processing'
  city: string
  country: string
  createdAt: string
}

type CheckoutStep = 'config' | 'shipping' | 'confirm' | 'success'

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RewardsScreen() {
  const insets = useSafeAreaInsets()
  const { contributionScore, currentLevel, spendPoints } = useContributorStore()

  // ── Orders (persisted) ─────────────────────────────────────────────────────

  const [orders, setOrders] = useState<RewardOrder[]>([])

  useEffect(() => {
    safeStorage.getItem(ORDERS_KEY).then((raw) => {
      if (raw) {
        try { setOrders(JSON.parse(raw)) } catch { /* corrupt — ignore */ }
      }
    })
  }, [])

  const saveOrders = (next: RewardOrder[]) => {
    setOrders(next)
    safeStorage.setItem(ORDERS_KEY, JSON.stringify(next))
  }

  // ── Checkout state ─────────────────────────────────────────────────────────

  const [selected, setSelected] = useState<Product | null>(null)
  const [step, setStep] = useState<CheckoutStep>('config')
  const [selectedSize, setSelectedSize] = useState<Size>('M')
  const [quantity, setQuantity] = useState(1)
  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_SHIPPING)

  const canRedeem = currentLevel.level >= MIN_LEVEL_TO_REDEEM
  const totalCost = selected ? selected.priceRp * quantity : 0
  const canAfford = contributionScore >= totalCost
  const shippingValid = (Object.values(shipping) as string[]).every((v) => v.trim().length > 0)

  const openProduct = (product: Product) => {
    if (!canRedeem) return
    setSelected(product)
    setSelectedSize('M')
    setQuantity(1)
    setShipping(EMPTY_SHIPPING)
    setStep('config')
  }

  const closeModal = () => setSelected(null)

  const handleRedeem = () => {
    if (!selected) return
    spendPoints(totalCost)
    const order: RewardOrder = {
      id: `order-${Date.now()}`,
      productId: selected.id,
      productTitle: selected.title,
      size: selected.hasSizes ? selectedSize : undefined,
      quantity,
      priceRp: totalCost,
      status: 'Processing',
      city: shipping.city,
      country: shipping.country,
      createdAt: new Date().toISOString(),
    }
    saveOrders([order, ...orders])
    setStep('success')
  }

  // ── Modal steps ────────────────────────────────────────────────────────────

  const renderConfig = () => (
    <View style={styles.stepContent}>
      <Text style={styles.modalTitle}>{selected?.title}</Text>
      <Text style={styles.modalSub}>{selected?.subtitle}</Text>

      <View style={styles.pricePill}>
        <Ionicons name="flash" size={13} color="#F59E0B" />
        <Text style={styles.pricePillText}>{selected?.priceRp} RP each</Text>
      </View>

      {selected?.hasSizes && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Size</Text>
          <View style={styles.sizeRow}>
            {SIZES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.sizeChip, selectedSize === s && styles.sizeChipActive]}
                onPress={() => setSelectedSize(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sizeText, selectedSize === s && styles.sizeTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Quantity</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={18} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQuantity((q) => Math.min(10, q + 1))}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <View style={styles.totalRight}>
          <Ionicons name="flash" size={15} color="#F59E0B" />
          <Text style={styles.totalValue}>{totalCost} RP</Text>
        </View>
      </View>

      {!canAfford && (
        <View style={styles.warningBox}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.warningText}>
            You need {totalCost - contributionScore} more RP to redeem this reward.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryBtn, !canAfford && styles.primaryBtnDisabled]}
        onPress={() => { if (canAfford) setStep('shipping') }}
        activeOpacity={0.85}
        disabled={!canAfford}
      >
        <Text style={styles.primaryBtnText}>Continue to Shipping</Text>
        <Ionicons name="arrow-forward" size={15} color="#fff" />
      </TouchableOpacity>
    </View>
  )

  const renderShipping = () => (
    <View style={styles.stepContent}>
      <Text style={styles.modalTitle}>Shipping Details</Text>
      <Text style={styles.modalSub}>Where should we send your reward?</Text>

      {(Object.keys(EMPTY_SHIPPING) as (keyof ShippingForm)[]).map((field) => (
        <View key={field} style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{FIELD_LABELS[field]}</Text>
          <TextInput
            style={styles.textInput}
            value={shipping[field]}
            onChangeText={(v) => setShipping((prev) => ({ ...prev, [field]: v }))}
            placeholder={FIELD_PLACEHOLDERS[field]}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize={field === 'postalCode' ? 'none' : 'words'}
            keyboardType={field === 'phone' ? 'phone-pad' : 'default'}
          />
        </View>
      ))}

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep('config')} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={15} color={Colors.textSecondary} />
          <Text style={styles.ghostBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, styles.btnFlex, !shippingValid && styles.primaryBtnDisabled]}
          onPress={() => { if (shippingValid) setStep('confirm') }}
          activeOpacity={0.85}
          disabled={!shippingValid}
        >
          <Text style={styles.primaryBtnText}>Review Order</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderConfirm = () => (
    <View style={styles.stepContent}>
      <Text style={styles.modalTitle}>Confirm Order</Text>

      <View style={styles.confirmCard}>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>Item</Text>
          <Text style={styles.confirmValue} numberOfLines={2}>
            {selected?.title}{selected?.hasSizes ? ` · ${selectedSize}` : ''}
          </Text>
        </View>
        <View style={styles.confirmDivider} />
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>Quantity</Text>
          <Text style={styles.confirmValue}>{quantity}</Text>
        </View>
        <View style={styles.confirmDivider} />
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>Ship to</Text>
          <Text style={[styles.confirmValue, { textAlign: 'right', flex: 1 }]}>
            {shipping.fullName}{'\n'}{shipping.address}, {shipping.city}{'\n'}{shipping.postalCode} · {shipping.country}
          </Text>
        </View>
        <View style={styles.confirmDivider} />
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmLabel, { fontWeight: '700' }]}>Total</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="flash" size={14} color="#F59E0B" />
            <Text style={[styles.confirmValue, { fontWeight: '700' }]}>{totalCost} RP</Text>
          </View>
        </View>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => setStep('shipping')} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={15} color={Colors.textSecondary} />
          <Text style={styles.ghostBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryBtn, styles.btnFlex, { backgroundColor: Colors.success }]}
          onPress={handleRedeem}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Redeem</Text>
          <Ionicons name="checkmark" size={15} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderSuccess = () => (
    <View style={[styles.stepContent, { alignItems: 'center', paddingVertical: 36 }]}>
      <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
      <Text style={[styles.modalTitle, { textAlign: 'center', marginTop: 20 }]}>Your reward is on the way</Text>
      <Text style={[styles.modalSub, { textAlign: 'center' }]}>
        We'll ship your {selected?.title} to {shipping.city}. Delivery usually takes 7–14 business days.
      </Text>
      <TouchableOpacity
        style={[styles.primaryBtn, { marginTop: 28, alignSelf: 'stretch' }]}
        onPress={closeModal}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  )

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <View style={styles.balanceIconWrap}>
              <Ionicons name="flash" size={22} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.balanceAmount}>{contributionScore}</Text>
              <Text style={styles.balanceLabel}>Reward Points</Text>
            </View>
          </View>
          <View style={[styles.levelPill, { backgroundColor: currentLevel.color + '20' }]}>
            <Ionicons name={currentLevel.icon as any} size={12} color={currentLevel.color} />
            <Text style={[styles.levelPillText, { color: currentLevel.color }]}>{currentLevel.name}</Text>
          </View>
        </View>

        {/* Level gate */}
        {!canRedeem && (
          <View style={styles.gateBox}>
            <Ionicons name="lock-closed-outline" size={15} color={Colors.textSecondary} />
            <Text style={styles.gateText}>
              Reach <Text style={styles.gateEmphasis}>Skipper</Text> level to redeem rewards. Keep contributing to level up.
            </Text>
          </View>
        )}

        {/* ── Your Orders ──────────────────────────────────────────────────── */}
        <View>
          <Text style={styles.sectionTitle}>Your Orders</Text>

          {orders.length === 0 ? (
            <View style={styles.ordersEmpty}>
              <Ionicons name="bag-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.ordersEmptyTitle}>No rewards yet</Text>
              <Text style={styles.ordersEmptySub}>Earn points and redeem your first reward</Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {orders.map((order, i) => (
                <View key={order.id}>
                  <View style={styles.orderRow}>
                    <View style={styles.orderIconWrap}>
                      <Ionicons
                        name={order.productId === 'tshirt' ? 'shirt-outline' : 'sunny-outline'}
                        size={18}
                        color={Colors.primary}
                      />
                    </View>
                    <View style={styles.orderMeta}>
                      <Text style={styles.orderTitle} numberOfLines={1}>
                        {order.productTitle}
                        {order.size ? ` · ${order.size}` : ''}
                        {order.quantity > 1 ? ` × ${order.quantity}` : ''}
                      </Text>
                      <Text style={styles.orderSub}>
                        {order.city}, {order.country} · {new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.orderStatusPill}>
                      <Text style={styles.orderStatusText}>{order.status}</Text>
                    </View>
                  </View>
                  {i < orders.length - 1 && <View style={styles.orderDivider} />}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Available Rewards ─────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Available Rewards</Text>
        <View style={styles.productGrid}>
          {PRODUCTS.map((product) => {
            const affordable = contributionScore >= product.priceRp
            const tappable = canRedeem && affordable
            return (
              <TouchableOpacity
                key={product.id}
                style={[styles.productCard, !tappable && styles.productCardMuted]}
                onPress={() => openProduct(product)}
                activeOpacity={tappable ? 0.85 : 1}
              >
                <View style={[
                  styles.productIconWrap,
                  { backgroundColor: tappable ? Colors.primary + '10' : '#F1F5F9' },
                ]}>
                  <Ionicons
                    name={product.icon as any}
                    size={36}
                    color={tappable ? Colors.primary : Colors.textMuted}
                  />
                </View>
                <Text style={[styles.productTitle, !tappable && { color: Colors.textSecondary }]} numberOfLines={2}>
                  {product.title}
                </Text>
                <Text style={[styles.productSub, !tappable && { color: Colors.textMuted }]} numberOfLines={1}>
                  {product.subtitle}
                </Text>
                <View style={styles.productPriceRow}>
                  <Ionicons name="flash" size={13} color={affordable ? '#F59E0B' : Colors.textMuted} />
                  <Text style={[styles.productPrice, !affordable && { color: Colors.textMuted }]}>
                    {product.priceRp} RP
                  </Text>
                </View>
                {canRedeem && !affordable && (
                  <Text style={styles.productNeedMore}>
                    Need {product.priceRp - contributionScore} more
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {/* Checkout modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={step === 'success' ? closeModal : undefined}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {step !== 'success' && (
            <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          )}
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
            <View style={styles.sheetHandle} />
            {step !== 'success' && (
              <TouchableOpacity style={styles.sheetClose} onPress={closeModal} hitSlop={12}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {step === 'config' && renderConfig()}
              {step === 'shipping' && renderShipping()}
              {step === 'confirm' && renderConfirm()}
              {step === 'success' && renderSuccess()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },

  scroll: { padding: 20, gap: 20, paddingBottom: 40 },

  // Balance
  balanceCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  balanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  balanceIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center',
  },
  balanceAmount: { fontSize: 28, fontWeight: '800', color: Colors.text, lineHeight: 32 },
  balanceLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  levelPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  levelPillText: { fontSize: 13, fontWeight: '600' },

  // Gate
  gateBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#F8FAFC', borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  gateText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  gateEmphasis: { fontWeight: '600', color: Colors.text },

  // Orders
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  ordersEmpty: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  ordersEmptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary, marginTop: 4 },
  ordersEmptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  ordersList: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },
  orderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  orderIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary + '10',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  orderMeta: { flex: 1, gap: 3 },
  orderTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  orderSub: { fontSize: 12, color: Colors.textMuted },
  orderStatusPill: {
    backgroundColor: Colors.accent + '18', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0,
  },
  orderStatusText: { fontSize: 12, fontWeight: '600', color: Colors.secondary },
  orderDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  // Products
  productGrid: { flexDirection: 'row', gap: 12 },
  productCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 18,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  productCardMuted: { opacity: 0.75 },
  productIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  productTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, textAlign: 'center', lineHeight: 20 },
  productSub: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  productPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  productPrice: { fontSize: 15, fontWeight: '700', color: Colors.text },
  productNeedMore: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 24, maxHeight: '92%',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 8,
  },
  sheetClose: { position: 'absolute', top: 20, right: 24, zIndex: 10, padding: 4 },

  // Step content
  stepContent: { paddingTop: 12, paddingBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20, lineHeight: 20 },

  pricePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FEF3C7', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start', marginBottom: 20,
  },
  pricePillText: { fontSize: 13, fontWeight: '600', color: '#92400E' },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 10 },

  sizeRow: { flexDirection: 'row', gap: 10 },
  sizeChip: {
    width: 52, height: 44, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sizeChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  sizeText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  sizeTextActive: { color: '#fff' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  qtyBtn: {
    width: 40, height: 40, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { width: 48, textAlign: 'center', fontSize: 18, fontWeight: '700', color: Colors.text },

  totalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: 16,
  },
  totalLabel: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  totalRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  totalValue: { fontSize: 20, fontWeight: '800', color: Colors.text },

  warningBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  warningText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // Shipping form
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  textInput: {
    height: 46, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, color: Colors.text, backgroundColor: '#FAFBFC',
  },

  // Confirm card
  confirmCard: {
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 20,
  },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  confirmDivider: { height: 1, backgroundColor: Colors.border },
  confirmLabel: { fontSize: 14, color: Colors.textSecondary },
  confirmValue: { fontSize: 14, fontWeight: '600', color: Colors.text },

  // Buttons
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 20, marginTop: 8,
  },
  primaryBtnDisabled: { backgroundColor: Colors.border },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  btnFlex: { flex: 1, marginTop: 0 },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 15, paddingHorizontal: 12,
  },
  ghostBtnText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
})
