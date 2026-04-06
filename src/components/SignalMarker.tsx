import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Signal, getCategoryMeta } from '../lib/signalService'

interface Props {
  signal: Signal
  selected?: boolean
}

export function SignalMarker({ signal, selected }: Props) {
  const meta = getCategoryMeta(signal.category)
  const size = selected ? 50 : 42

  return (
    <View style={{ width: size + 20, height: size + 20, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer pulse ring */}
      {selected && (
        <View style={[
          styles.pulseRing,
          { width: size + 20, height: size + 20, borderRadius: (size + 20) / 2, borderColor: meta.color + '28' },
        ]} />
      )}
      {/* Inner pulse ring */}
      {selected && (
        <View style={[
          styles.pulseRing,
          { width: size + 10, height: size + 10, borderRadius: (size + 10) / 2, borderColor: meta.color + '50',
            position: 'absolute' },
        ]} />
      )}
      {/* Main pin */}
      <View style={[
        styles.pin,
        {
          width: size, height: size, borderRadius: size / 2,
          borderColor: meta.color,
          borderWidth: selected ? 3 : 2.5,
          shadowColor: meta.color,
          shadowOpacity: selected ? 0.35 : 0.18,
        },
      ]}>
        <View style={[styles.fill, { backgroundColor: meta.color + '14' }]}>
          <Text style={{ fontSize: selected ? 20 : 17 }}>{meta.emoji}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  pulseRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  pin: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
