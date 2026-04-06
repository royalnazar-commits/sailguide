import React, { useState } from 'react'
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  SignalCategory, SIGNAL_CATEGORIES,
  postSignal, findUserSignal, Signal,
} from '../lib/signalService'
import { Colors } from '../constants/colors'

interface Props {
  visible: boolean
  lat: number
  lng: number
  userId: string
  userName: string
  existingSignal: Signal | undefined
  onClose: () => void
  onPosted: () => void
}

export function CreateSignalModal({
  visible, lat, lng, userId, userName,
  existingSignal, onClose, onPosted,
}: Props) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<SignalCategory>('Other')
  const [posting, setPosting] = useState(false)

  const handlePost = async () => {
    const msg = text.trim()
    if (!msg || posting) return
    setPosting(true)
    try {
      await postSignal(userId, userName, msg, category, lat, lng)
      setText('')
      setCategory('Other')
      onPosted()
    } catch (err) {
      Alert.alert('Failed to post', 'Could not post your signal. Please check your connection and try again.')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Post Signal</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* 1-signal limit warning */}
          {existingSignal && (
            <View style={styles.warning}>
              <Ionicons name="warning-outline" size={15} color="#F59E0B" />
              <Text style={styles.warningText}>
                Posting will replace your current active signal
              </Text>
            </View>
          )}

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
            keyboardShouldPersistTaps="handled"
          >
            {SIGNAL_CATEGORIES.map(({ key, emoji, color }) => {
              const active = category === key
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
                  onPress={() => setCategory(key)}
                >
                  <Text style={styles.chipEmoji}>{emoji}</Text>
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{key}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* Text input */}
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Short message for nearby sailors…"
            placeholderTextColor={Colors.textMuted}
            maxLength={120}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            autoFocus
          />
          <Text style={styles.counter}>{text.length}/120</Text>

          {/* Coords */}
          <Text style={styles.coords}>
            📍 {lat.toFixed(4)}° {lng.toFixed(4)}° · expires in 24h
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.postBtn, (!text.trim() || posting) && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!text.trim() || posting}
              activeOpacity={0.85}
            >
              {posting
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="radio-outline" size={16} color="#fff" />
                   <Text style={styles.postText}>Post Signal</Text></>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 20,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  warning: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  warningText: { fontSize: 13, color: '#92400E', flex: 1 },
  categories: { gap: 8, paddingRight: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipEmoji: { fontSize: 13 },
  chipLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipLabelActive: { color: '#fff' },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, padding: 14,
    fontSize: 15, color: Colors.text,
    minHeight: 90,
  },
  counter: { fontSize: 11, color: Colors.textMuted, alignSelf: 'flex-end', marginTop: -8 },
  coords: { fontSize: 12, color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  postBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.primary,
  },
  postBtnDisabled: { opacity: 0.4 },
  postText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
