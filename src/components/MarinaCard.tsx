import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../constants/colors'

type Marina = {
  id?: string
  name?: string
  country?: string
  region?: string
  phone?: string
  email?: string
  website?: string
  vhfChannel?: string | number
}

type Props = {
  marina?: Marina
}

export function MarinaCard({ marina }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{marina?.name || 'Marina'}</Text>

      {!!marina?.region && (
        <Text style={styles.text}>Region: {marina.region}</Text>
      )}

      {!!marina?.country && (
        <Text style={styles.text}>Country: {marina.country}</Text>
      )}

      {!!marina?.phone && (
        <Text style={styles.text}>Phone: {marina.phone}</Text>
      )}

      {!!marina?.email && (
        <Text style={styles.text}>Email: {marina.email}</Text>
      )}

      {!!marina?.website && (
        <Text style={styles.text}>Website: {marina.website}</Text>
      )}

      {!!marina?.vhfChannel && (
        <Text style={styles.text}>VHF: {marina.vhfChannel}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
})
