import React, { useState } from 'react'
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'
import { purchasesApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  routeId: string
  priceUsd: number
  hasPurchased: boolean
  onSuccess?: () => void
  onRequireLogin?: () => void
}

export function PurchaseButton({ routeId, priceUsd, hasPurchased, onSuccess, onRequireLogin }: Props) {
  const [loading, setLoading] = useState(false)
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  if (hasPurchased) {
    return (
      <TouchableOpacity style={styles.ownedBtn} disabled>
        <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
        <Text style={styles.ownedText}>Route purchased</Text>
      </TouchableOpacity>
    )
  }

  const handleBuy = async () => {
    if (!user) {
      onRequireLogin?.()
      return
    }

    Alert.alert(
      'Purchase Route',
      priceUsd === 0
        ? 'Get this free route?'
        : `Purchase this route for $${priceUsd}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: priceUsd === 0 ? 'Get Free' : `Pay $${priceUsd}`,
          onPress: async () => {
            setLoading(true)
            try {
              // In dev: use mock confirm. In prod: use create-intent + Stripe SDK
              await purchasesApi.confirmMock(routeId)
              queryClient.invalidateQueries({ queryKey: ['route', routeId] })
              queryClient.invalidateQueries({ queryKey: ['my-purchases'] })
              onSuccess?.()
              Alert.alert('🎉 Route unlocked!', 'You can now access all waypoints and start navigating.')
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Purchase failed')
            } finally {
              setLoading(false)
            }
          },
        },
      ]
    )
  }

  return (
    <TouchableOpacity style={styles.buyBtn} onPress={handleBuy} disabled={loading} activeOpacity={0.85}>
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          <Ionicons name="lock-open-outline" size={18} color="#fff" />
          <Text style={styles.buyText}>
            {priceUsd === 0 ? 'Get Free Route' : `Buy for $${priceUsd}`}
          </Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  buyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  buyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ownedBtn: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  ownedText: { color: Colors.success, fontSize: 16, fontWeight: '700' },
})