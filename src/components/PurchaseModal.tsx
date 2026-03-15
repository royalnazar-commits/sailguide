import React from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'

interface PurchaseModalProps {
  visible: boolean
  onClose: () => void
  /** Title shown in the modal header */
  title: string
  /** Subtitle / description */
  subtitle: string
  /** Price to display and pass to onConfirm */
  priceUsd: number
  /** Label for the confirm button, e.g. "Buy Route" or "Subscribe" */
  confirmLabel: string
  onConfirm: () => void
}

/**
 * A bottom-sheet style confirmation modal for purchasing a route, place, or
 * captain subscription.
 */
export function PurchaseModal({
  visible,
  onClose,
  title,
  subtitle,
  priceUsd,
  confirmLabel,
  onConfirm,
}: PurchaseModalProps) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Lock icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={28} color={Colors.primary} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Price chip */}
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Price</Text>
          <View style={styles.pricePill}>
            <Text style={styles.priceValue}>
              {priceUsd === 0 ? 'Free' : `$${priceUsd.toFixed(2)}`}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
          <Ionicons name="lock-open-outline" size={18} color="#fff" />
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 20,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  pricePill: {
    backgroundColor: Colors.primary + '12',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: {
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 15,
    color: Colors.textMuted,
    fontWeight: '500',
  },
})
