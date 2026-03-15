import React, { useState, useRef } from 'react'
import {
  View, Image, StyleSheet, FlatList, TouchableOpacity,
  Dimensions, Modal, StatusBar,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const { width: SCREEN_W } = Dimensions.get('window')

interface Props {
  images: string[]
  /** Height of the inline gallery strip */
  height?: number
  /** When true, the gallery is full-screen (used inside the modal) */
  fullScreen?: boolean
  onClose?: () => void
}

/**
 * Horizontal swipe gallery for boat images.
 * Tap any image to open a full-screen modal viewer.
 */
export function BoatGallery({ images, height = 300 }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [modalVisible, setModalVisible] = useState(false)
  const flatRef = useRef<FlatList>(null)
  const modalRef = useRef<FlatList>(null)

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W)
    setActiveIndex(idx)
  }

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        ref={flatRef}
        data={images}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.95} onPress={() => setModalVisible(true)}>
            <Image
              source={{ uri: item }}
              style={[styles.image, { width: SCREEN_W, height }]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
      />

      {/* Dot indicators */}
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}

      {/* Counter pill */}
      <View style={styles.counter}>
        <Ionicons name="images-outline" size={12} color="#fff" />
        <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.7)" />
        <View style={{ width: 1 }} />
        {images.map((_, i) => (
          <View
            key={i}
            style={[styles.thumbDot, i === activeIndex && styles.thumbDotActive]}
          />
        ))}
      </View>

      {/* Full-screen modal */}
      <Modal visible={modalVisible} animationType="fade" statusBarTranslucent>
        <View style={styles.modal}>
          <StatusBar hidden />
          <FlatList
            ref={modalRef}
            data={images}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={activeIndex}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', position: 'relative' },
  image: {},
  dots: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    flexDirection: 'row', gap: 5,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: { backgroundColor: '#fff', width: 18 },
  counter: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  thumbDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  thumbDotActive: { backgroundColor: '#fff' },

  modal: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  modalImage: { width: SCREEN_W, height: '100%' as any },
  closeBtn: {
    position: 'absolute', top: 52, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
})
