import React, { useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { PlaceType } from '../types/place'
import { PLACE_TYPE_OPTIONS, normalizePlaceType } from '../constants/placeTypes'
import { usePlacesStore } from '../store/placesStore'
import { useAuthStore } from '../store/authStore'
import { Colors } from '../constants/colors'

// ── Form state ──────────────────────────────────────────────────────────────

interface FormState {
  name: string
  type: PlaceType
  region: string
  country: string
  lat: string
  lng: string
  description: string
  notes: string
  photoUrl: string
  tagInput: string
  tags: string[]
}

const EMPTY_FORM: FormState = {
  name: '',
  type: 'MARINA',
  region: '',
  country: '',
  lat: '',
  lng: '',
  description: '',
  notes: '',
  photoUrl: '',
  tagInput: '',
  tags: [],
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function CreatePlaceScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const { addPlace, localUserId } = usePlacesStore()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const descRef = useRef<TextInput>(null)
  const notesRef = useRef<TextInput>(null)
  const latRef = useRef<TextInput>(null)
  const lngRef = useRef<TextInput>(null)

  const set = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // ── Tag helpers ───────────────────────────────────────────────────────────

  const addTag = () => {
    const raw = form.tagInput.trim().replace(/,+$/, '')
    if (!raw) return
    const newTags = raw.split(/[\s,]+/).map((t) => t.toLowerCase()).filter(Boolean)
    const merged = Array.from(new Set([...form.tags, ...newTags]))
    setForm((f) => ({ ...f, tags: merged, tagInput: '' }))
  }

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) e.name = 'Title is required'
    if (!form.region.trim()) e.region = 'Region is required'
    if (!form.country.trim()) e.country = 'Country is required'
    if (!form.description.trim()) e.description = 'Description is required'
    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)
    if (!form.lat.trim() || isNaN(lat) || lat < -90 || lat > 90)
      e.lat = 'Valid latitude required (−90 to 90)'
    if (!form.lng.trim() || isNaN(lng) || lng < -180 || lng > 180)
      e.lng = 'Valid longitude required (−180 to 180)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const place = addPlace(
        {
          name: form.name.trim(),
          type: normalizePlaceType(form.type),
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
          description: form.description.trim(),
          country: form.country.trim(),
          region: form.region.trim(),
          notes: form.notes.trim() || undefined,
          tags: form.tags,
          photos: form.photoUrl.trim() ? [form.photoUrl.trim()] : [],
        },
        user?.id ?? localUserId,
        user?.role,
      )
      // Navigate to the new place's detail screen
      router.replace(`/place/${place.id}`)
    } catch {
      Alert.alert('Error', 'Could not save place. Please try again.')
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Place</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Basic info ───────────────────────────────────────────── */}
        <Section title="Basic Info">
          <Field label="Title" error={errors.name}>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="e.g. Porto Heli Anchorage"
              placeholderTextColor={Colors.textMuted}
              value={form.name}
              onChangeText={(v) => set('name', v)}
              returnKeyType="next"
              onSubmitEditing={() => descRef.current?.focus()}
            />
          </Field>

          <Field label="Place Type">
            <View style={styles.typeGrid}>
              {PLACE_TYPE_OPTIONS.map((opt) => {
                const active = form.type === opt.type
                return (
                  <TouchableOpacity
                    key={opt.type}
                    style={[
                      styles.typeBtn,
                      active && { borderColor: opt.color, backgroundColor: opt.color + '14' },
                    ]}
                    onPress={() => setForm((f) => ({ ...f, type: opt.type }))}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={opt.icon as any} size={20} color={active ? opt.color : Colors.textMuted} />
                    <Text style={[styles.typeBtnLabel, active && { color: opt.color, fontWeight: '700' }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </Field>
        </Section>

        {/* ── Location ─────────────────────────────────────────────── */}
        <Section title="Location">
          <Field label="Region" error={errors.region}>
            <TextInput
              style={[styles.input, errors.region && styles.inputError]}
              placeholder="e.g. Saronic Gulf"
              placeholderTextColor={Colors.textMuted}
              value={form.region}
              onChangeText={(v) => set('region', v)}
              returnKeyType="next"
            />
          </Field>

          <Field label="Country" error={errors.country}>
            <TextInput
              style={[styles.input, errors.country && styles.inputError]}
              placeholder="e.g. Greece"
              placeholderTextColor={Colors.textMuted}
              value={form.country}
              onChangeText={(v) => set('country', v)}
              returnKeyType="next"
              onSubmitEditing={() => latRef.current?.focus()}
            />
          </Field>

          <View style={styles.coordRow}>
            <View style={{ flex: 1 }}>
              <Field label="Latitude" error={errors.lat}>
                <TextInput
                  ref={latRef}
                  style={[styles.input, errors.lat && styles.inputError]}
                  placeholder="37.3497"
                  placeholderTextColor={Colors.textMuted}
                  value={form.lat}
                  onChangeText={(v) => set('lat', v)}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="next"
                  onSubmitEditing={() => lngRef.current?.focus()}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Longitude" error={errors.lng}>
                <TextInput
                  ref={lngRef}
                  style={[styles.input, errors.lng && styles.inputError]}
                  placeholder="23.4750"
                  placeholderTextColor={Colors.textMuted}
                  value={form.lng}
                  onChangeText={(v) => set('lng', v)}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="next"
                  onSubmitEditing={() => descRef.current?.focus()}
                />
              </Field>
            </View>
          </View>

          <View style={styles.mapPickerHint}>
            <Ionicons name="map-outline" size={15} color={Colors.textMuted} />
            <Text style={styles.mapPickerHintText}>Map picker coming soon — enter coordinates manually for now</Text>
          </View>
        </Section>

        {/* ── Description & notes ──────────────────────────────────── */}
        <Section title="Details">
          <Field label="Description" error={errors.description}>
            <TextInput
              ref={descRef}
              style={[styles.input, styles.multiline, errors.description && styles.inputError]}
              placeholder="A short description of this place visible to all sailors…"
              placeholderTextColor={Colors.textMuted}
              value={form.description}
              onChangeText={(v) => set('description', v)}
              multiline
              numberOfLines={4}
              returnKeyType="next"
              onSubmitEditing={() => notesRef.current?.focus()}
              blurOnSubmit={false}
            />
          </Field>

          <Field label="Private Notes" hint="Only visible to you">
            <TextInput
              ref={notesRef}
              style={[styles.input, styles.multiline]}
              placeholder="Fuel dock hours, holding quality, entry tips…"
              placeholderTextColor={Colors.textMuted}
              value={form.notes}
              onChangeText={(v) => set('notes', v)}
              multiline
              numberOfLines={3}
              blurOnSubmit={false}
            />
          </Field>
        </Section>

        {/* ── Photo ────────────────────────────────────────────────── */}
        <Section title="Photo">
          <Field label="Photo URL" hint="Optional — paste a link to an image">
            <TextInput
              style={styles.input}
              placeholder="https://images.unsplash.com/…"
              placeholderTextColor={Colors.textMuted}
              value={form.photoUrl}
              onChangeText={(v) => set('photoUrl', v)}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>
        </Section>

        {/* ── Tags ─────────────────────────────────────────────────── */}
        <Section title="Tags">
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="anchorage, calm, fuel…"
              placeholderTextColor={Colors.textMuted}
              value={form.tagInput}
              onChangeText={(v) => setForm((f) => ({ ...f, tagInput: v }))}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={addTag}
            />
            <TouchableOpacity style={styles.tagAddBtn} onPress={addTag}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {form.tags.length > 0 && (
            <View style={styles.tagPills}>
              {form.tags.map((tag) => (
                <TouchableOpacity key={tag} style={styles.tagPill} onPress={() => removeTag(tag)}>
                  <Text style={styles.tagPillText}>#{tag}</Text>
                  <Ionicons name="close" size={12} color={Colors.secondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Section>

      </ScrollView>

      {/* ── Submit bar ──────────────────────────────────────────────── */}
      <View style={[styles.submitBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.submitBtn, saving && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Create Place</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

// ── Helper components ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

function Field({
  label, hint, error, children,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint && <Text style={styles.fieldHint}>{hint}</Text>}
      </View>
      {children}
      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={13} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 12 },

  // Sections
  section: { marginBottom: 4, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', padding: 16, gap: 14 },

  // Fields
  field: { gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  fieldHint: { fontSize: 12, color: Colors.textMuted },
  input: {
    backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  inputError: { borderColor: Colors.danger },
  multiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 11 },

  // Validation errors
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  errorText: { fontSize: 12, color: Colors.danger },

  // Type selector
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: {
    width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  typeBtnLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },

  // Coordinates
  coordRow: { flexDirection: 'row', gap: 12 },
  mapPickerHint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapPickerHintText: { fontSize: 12, color: Colors.textMuted, flex: 1 },

  // Tags
  tagInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  tagAddBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  tagPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.secondary + '15', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  tagPillText: { fontSize: 13, color: Colors.secondary },

  // Submit
  submitBar: {
    backgroundColor: '#fff', padding: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
