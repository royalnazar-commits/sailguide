import React, { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useRouteBuilderStore } from '../store/routeBuilderStore'
import { usePlacesStore } from '../store/placesStore'
import { seedPlaces } from '../data/seedPlaces'
import { Place } from '../types/place'
import { Colors } from '../constants/colors'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getPlaceById(id: string, allPlaces: Place[]): Place | undefined {
  return allPlaces.find((p) => p.id === id)
}

const STOP_COLORS = ['#1B6CA8', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#00B4D8', '#F97316']

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function RouteBuilderScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const { draftRoute, updateDraftTitle, updateDraftDescription, removeStop, moveStop, saveDraft, discardDraft } = useRouteBuilderStore()
  const { userPlaces } = usePlacesStore()
  const allPlaces = [...seedPlaces, ...userPlaces]

  const [titleFocused, setTitleFocused] = useState(false)

  const getCoords = (id: string) => {
    const p = getPlaceById(id, allPlaces)
    return p ? { lat: p.lat, lng: p.lng, region: p.region, country: p.country } : null
  }

  const stopPlaces = (draftRoute?.stops ?? [])
    .map((s) => ({ stop: s, place: getPlaceById(s.placeId, allPlaces) }))
    .filter((item): item is { stop: typeof item.stop; place: Place } => !!item.place)

  const polylineCoords = stopPlaces.map((item) => ({
    latitude: item.place.lat,
    longitude: item.place.lng,
  }))

  const handleFitMap = () => {
    if (polylineCoords.length === 0) return
    mapRef.current?.fitToCoordinates(polylineCoords, {
      edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
      animated: true,
    })
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    moveStop(index, index - 1, getCoords)
  }

  const handleMoveDown = (index: number) => {
    if (index >= stopPlaces.length - 1) return
    moveStop(index, index + 1, getCoords)
  }

  const handleRemove = (stopId: string) => {
    Alert.alert('Remove Stop', 'Remove this stop from your route?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeStop(stopId, getCoords) },
    ])
  }

  const handleSave = () => {
    if (!draftRoute?.title.trim()) {
      Alert.alert('Name required', 'Please give your route a name before saving.')
      return
    }
    if ((draftRoute?.stops.length ?? 0) < 2) {
      Alert.alert('Too few stops', 'Add at least 2 stops to create a route.')
      return
    }
    const saved = saveDraft(getCoords, 'DRAFT')
    if (saved) router.replace(`/user-route/${saved.id}`)
  }

  const handleDiscard = () => {
    Alert.alert('Discard Route?', 'All unsaved changes will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { discardDraft(); router.back() } },
    ])
  }

  if (!draftRoute) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.centerText}>No active draft. Go back and start a new route.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLinkBtn}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleDiscard} style={styles.headerBtn}>
            <Ionicons name="close" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Route Builder</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, (!draftRoute.title.trim() || draftRoute.stops.length < 2) && styles.saveBtnDisabled]}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Map preview ──────────────────────────────────────────── */}
          <View style={styles.mapWrapper}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: 38.8, longitude: 18.5,
                latitudeDelta: 16, longitudeDelta: 22,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
            >
              {polylineCoords.length >= 2 && (
                <Polyline
                  coordinates={polylineCoords}
                  strokeColor={Colors.primary}
                  strokeWidth={2.5}
                  lineDashPattern={[6, 4]}
                />
              )}
              {stopPlaces.map((item, i) => (
                <Marker
                  key={item.stop.id}
                  coordinate={{ latitude: item.place.lat, longitude: item.place.lng }}
                  tracksViewChanges={false}
                >
                  <View style={[styles.mapPin, { backgroundColor: STOP_COLORS[i % STOP_COLORS.length] }]}>
                    <Text style={styles.mapPinText}>{i + 1}</Text>
                  </View>
                </Marker>
              ))}
            </MapView>
            {polylineCoords.length > 0 && (
              <TouchableOpacity style={styles.fitBtn} onPress={handleFitMap}>
                <Ionicons name="scan-outline" size={18} color={Colors.text} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Route name ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Route Name *</Text>
            <TextInput
              style={[styles.titleInput, titleFocused && styles.titleInputFocused]}
              placeholder="e.g. Greek Island Hop"
              placeholderTextColor={Colors.textMuted}
              value={draftRoute.title}
              onChangeText={updateDraftTitle}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
              maxLength={80}
              returnKeyType="done"
            />
          </View>

          {/* ── Description (optional) ───────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.descInput]}
              placeholder="Share what makes this route special…"
              placeholderTextColor={Colors.textMuted}
              value={draftRoute.description ?? ''}
              onChangeText={updateDraftDescription}
              multiline
              numberOfLines={3}
              maxLength={400}
              textAlignVertical="top"
            />
          </View>

          {/* ── Route stats ──────────────────────────────────────────── */}
          {draftRoute.stops.length >= 2 && (
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Ionicons name="navigate-outline" size={14} color={Colors.primary} />
                <Text style={styles.statPillText}>{draftRoute.totalNm} nm</Text>
              </View>
              <View style={styles.statPill}>
                <Ionicons name="location-outline" size={14} color={Colors.primary} />
                <Text style={styles.statPillText}>{draftRoute.stops.length} stops</Text>
              </View>
              {(draftRoute.estimatedDays ?? 0) > 0 && (
                <View style={styles.statPill}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                  <Text style={styles.statPillText}>{draftRoute.estimatedDays} days</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Stops list ───────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>
                Stops {draftRoute.stops.length > 0 ? `(${draftRoute.stops.length})` : ''}
              </Text>
              <TouchableOpacity
                style={styles.addStopBtn}
                onPress={() => router.push('/place-picker')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addStopText}>Add Stop</Text>
              </TouchableOpacity>
            </View>

            {stopPlaces.length === 0 ? (
              <TouchableOpacity
                style={styles.emptyStops}
                onPress={() => router.push('/place-picker')}
                activeOpacity={0.8}
              >
                <Ionicons name="location-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyStopsTitle}>No stops yet</Text>
                <Text style={styles.emptyStopsSub}>Tap "Add Stop" to search and add places</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.stopsList}>
                {stopPlaces.map((item, i) => (
                  <View key={item.stop.id} style={styles.stopRow}>
                    {/* Sequence indicator with connector line */}
                    <View style={styles.stopSequenceCol}>
                      <View style={[styles.stopDot, { backgroundColor: STOP_COLORS[i % STOP_COLORS.length] }]}>
                        <Text style={styles.stopDotText}>{i + 1}</Text>
                      </View>
                      {i < stopPlaces.length - 1 && <View style={styles.stopConnector} />}
                    </View>

                    {/* Stop card */}
                    <View style={styles.stopCard}>
                      <View style={styles.stopCardTop}>
                        <View style={styles.stopCardInfo}>
                          <Text style={styles.stopName} numberOfLines={1}>{item.place.name}</Text>
                          <Text style={styles.stopLocation}>{item.place.region} · {item.place.country}</Text>
                        </View>
                        {/* Reorder + remove */}
                        <View style={styles.stopActions}>
                          <TouchableOpacity
                            onPress={() => handleMoveUp(i)}
                            style={[styles.reorderBtn, i === 0 && styles.reorderBtnDisabled]}
                            disabled={i === 0}
                          >
                            <Ionicons name="chevron-up" size={16} color={i === 0 ? Colors.border : Colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleMoveDown(i)}
                            style={[styles.reorderBtn, i === stopPlaces.length - 1 && styles.reorderBtnDisabled]}
                            disabled={i === stopPlaces.length - 1}
                          >
                            <Ionicons name="chevron-down" size={16} color={i === stopPlaces.length - 1 ? Colors.border : Colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemove(item.stop.id)}
                            style={styles.removeBtn}
                          >
                            <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Distance to next */}
                      {i < stopPlaces.length - 1 && (() => {
                        const next = stopPlaces[i + 1]
                        const coords1 = { lat: item.place.lat, lng: item.place.lng }
                        const coords2 = { lat: next.place.lat, lng: next.place.lng }
                        const R = 3440.065
                        const dLat = ((coords2.lat - coords1.lat) * Math.PI) / 180
                        const dLng = ((coords2.lng - coords1.lng) * Math.PI) / 180
                        const a = Math.sin(dLat / 2) ** 2 +
                          Math.cos((coords1.lat * Math.PI) / 180) * Math.cos((coords2.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
                        const nm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
                        return (
                          <View style={styles.legRow}>
                            <Ionicons name="arrow-forward" size={11} color={Colors.textMuted} />
                            <Text style={styles.legText}>{nm} nm to next</Text>
                          </View>
                        )
                      })()}
                    </View>
                  </View>
                ))}

                {/* Add more stops shortcut */}
                <TouchableOpacity
                  style={styles.addMoreBtn}
                  onPress={() => router.push('/place-picker')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                  <Text style={styles.addMoreText}>Add another stop</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  backLinkBtn: { paddingVertical: 10, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: 12 },
  backLinkText: { color: '#fff', fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 18,
  },
  saveBtnDisabled: { backgroundColor: Colors.textMuted },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { gap: 0 },

  // Map
  mapWrapper: { height: 220, position: 'relative' },
  map: { flex: 1 },
  mapPin: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
  },
  mapPinText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  fitBtn: {
    position: 'absolute', right: 12, bottom: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },

  // Section
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },

  // Title input
  titleInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: Colors.text,
  },
  titleInputFocused: { borderColor: Colors.primary },
  descInput: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text,
    minHeight: 80,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primary + '12', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  statPillText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  // Add stop btn
  addStopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingVertical: 7, paddingHorizontal: 14,
  },
  addStopText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Empty stops
  emptyStops: {
    backgroundColor: '#fff', borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
  },
  emptyStopsTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  emptyStopsSub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  // Stops list
  stopsList: { gap: 0 },
  stopRow: { flexDirection: 'row', gap: 12, paddingBottom: 0 },
  stopSequenceCol: { width: 28, alignItems: 'center', paddingTop: 14 },
  stopDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2,
  },
  stopDotText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stopConnector: { flex: 1, width: 2, backgroundColor: Colors.border, marginVertical: 2 },
  stopCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  stopCardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  stopCardInfo: { flex: 1 },
  stopName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  stopLocation: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  stopActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reorderBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  reorderBtnDisabled: {},
  removeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  legText: { fontSize: 11, color: Colors.textMuted },

  // Add more
  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
    backgroundColor: Colors.primary + '08', borderRadius: 12, paddingVertical: 12,
    marginTop: 4, borderWidth: 1, borderColor: Colors.primary + '25',
  },
  addMoreText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
})
