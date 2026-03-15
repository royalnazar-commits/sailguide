import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'

interface Props {
  warnings: string[]
  title?: string
}

export function WarningBox({ warnings, title = 'Warnings' }: Props) {
  if (!warnings.length) return null
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="warning" size={16} color={Colors.danger} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {warnings.map((w, i) => (
        <Text key={i} style={styles.item}>• {w}</Text>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.danger },
  item: { fontSize: 13, color: '#991B1B', lineHeight: 20 },
})