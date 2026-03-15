import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export default function NavigationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Navigation</Text>
      <Text style={styles.text}>
        Навигационный экран временно отключён, потому что Mapbox убран для первого запуска.
      </Text>
      <Text style={styles.note}>
        Когда всё остальное заработает, карту можно будет вернуть отдельно.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    color: '#444',
    lineHeight: 22,
    marginBottom: 12,
  },
  note: {
    fontSize: 14,
    textAlign: 'center',
    color: '#777',
    lineHeight: 20,
  },
})
