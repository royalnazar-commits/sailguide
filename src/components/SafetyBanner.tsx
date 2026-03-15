import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'

interface Props {
  compact?: boolean
}

export function SafetyBanner({ compact = false }: Props) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <Ionicons name="warning-outline" size={compact ? 14 : 18} color={Colors.warning} />
      <Text style={[styles.text, compact && styles.textCompact]}>
        {compact
          ? 'Advisory only. Not a substitute for official charts.'
          : 'SailGuide is an advisory tool only. Always use official nautical charts and GMDSS equipment. The skipper is solely responsible for safe navigation.'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    alignItems: 'flex-start',
  },
  compact: {
    padding: 8,
    marginHorizontal: 0,
    marginVertical: 0,
    borderRadius: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#7A5F00',
    lineHeight: 18,
  },
  textCompact: {
    fontSize: 11,
  },
})