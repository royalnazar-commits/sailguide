import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'

interface Props {
  tips: string[]
  title?: string
}

export function TipList({ tips, title = 'Tips' }: Props) {
  if (!tips.length) return null
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="bulb-outline" size={16} color="#D97706" />
        <Text style={styles.title}>{title}</Text>
      </View>
      {tips.map((t, i) => (
        <Text key={i} style={styles.item}>• {t}</Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  item: { fontSize: 13, color: '#78350F', lineHeight: 20 },
})