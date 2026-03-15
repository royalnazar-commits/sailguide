import React, { useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'
import { router } from 'expo-router'

const { width, height } = Dimensions.get('window')

const slides = [
  {
    icon: 'map-outline',
    title: 'Curated Sailing Routes',
    subtitle: 'Expert-made routes for Greece, Croatia, Turkey and more. Every waypoint planned.',
    color: Colors.primary,
  },
  {
    icon: 'navigate-outline',
    title: 'Follow Your Route',
    subtitle: 'GPS-guided waypoint tracking with smart alerts as you approach each stop.',
    color: Colors.secondary,
  },
  {
    icon: 'anchor-outline',
    title: 'Marina Guide',
    subtitle: 'Full marina details — VHF, fuel, depth, contacts. Call or email directly from the app.',
    color: '#0D9488',
  },
]

export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current

  const next = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      if (current < slides.length - 1) {
        setCurrent(c => c + 1)
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start()
      } else {
        router.replace('/login')
      }
    })
  }

  const slide = slides[current]

  return (
    <View style={[styles.container, { backgroundColor: slide.color }]}>
      <TouchableOpacity style={styles.skip} onPress={() => router.replace('/login')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.iconWrap, { opacity: fadeAnim }]}>
        <Ionicons name={slide.icon as any} size={100} color="rgba(255,255,255,0.9)" />
      </Animated.View>

      <View style={styles.bottom}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </Animated.View>

        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
          ))}
        </View>

        <Animated.View style={[styles.disclaimer, { opacity: fadeAnim }]}>
          <Text style={styles.disclaimerText}>
            SailGuide is an advisory tool. Always use official nautical charts and GMDSS equipment. Skipper is responsible for safe navigation.
          </Text>
        </Animated.View>

        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: Colors.primary }]} onPress={next}>
          <Text style={styles.nextText}>{current === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
          <Ionicons name="arrow-forward" size={18} color={slide.color} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skip: { position: 'absolute', top: 56, right: 24, zIndex: 10 },
  skipText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  iconWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  subtitle: { fontSize: 16, color: Colors.textSecondary, lineHeight: 24, marginBottom: 24 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },
  disclaimer: {
    backgroundColor: '#FFF9E6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  disclaimerText: { fontSize: 11, color: '#78350F', lineHeight: 16 },
  nextBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})