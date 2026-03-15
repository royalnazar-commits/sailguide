import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { RoutePoint } from '../types'
import { Colors } from '../constants/colors'
import { useNavigationStore } from '../store/navigationStore'

const typeConfig: Record<string, { icon: any; color: string; label: string }> = {
  MARINA: { icon: 'anchor', color: Colors.secondary, label: 'Marina' },
  ANCHORAGE: { icon: 'anchor-outline', color: Colors.success, label: 'Anchorage' },
  POI: { icon: 'star-outline', color: Colors.accent, label: 'Point of Interest' },
  DANGER: { icon: 'warning', color: Colors.danger, label: 'Danger' },
  WAYPOINT: { icon: 'navigate-circle-outline', color: Colors.textSecondary, label: 'Waypoint' },
  FUEL: { icon: 'flame-outline', color: Colors.warning, label: 'Fuel Stop' },
}

export function WaypointModal() {
  const { proximityAlert, dismissAlert, advanceToNextPoint } = useNavigationStore()

  const config = proximityAlert
    ? typeConfig[proximityAlert.type] || typeConfig.WAYPOINT
    : typeConfig.WAYPOINT

  const handleAdvance = () => {
    advanceToNextPoint()
    dismissAlert()
  }

  return (
    <Modal visible={!!proximityAlert} transparent animationType="slide" onRequestClose={dismissAlert}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {proximityAlert && (
            <>
              <View style={[styles.iconCircle, { backgroundColor: config.color + '20' }]}>
                <Ionicons name={config.icon} size={32} color={config.color} />
              </View>

              <Text style={styles.typeLabel}>{config.label}</Text>
              <Text style={styles.pointName}>{proximityAlert.name}</Text>

              {proximityAlert.proximityMessage && (
                <Text style={styles.message}>{proximityAlert.proximityMessage}</Text>
              )}

              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {proximityAlert.description && (
                  <Text style={styles.description}>{proximityAlert.description}</Text>
                )}

                {proximityAlert.warnings.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>⚠️ Warnings</Text>
                    {proximityAlert.warnings.map((w, i) => (
                      <Text key={i} style={styles.warningItem}>• {w}</Text>
                    ))}
                  </View>
                )}

                {proximityAlert.tips.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💡 Tips</Text>
                    {proximityAlert.tips.map((t, i) => (
                      <Text key={i} style={styles.tipItem}>• {t}</Text>
                    ))}
                  </View>
                )}

                {proximityAlert.weatherNotes && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🌊 Weather notes</Text>
                    <Text style={styles.description}>{proximityAlert.weatherNotes}</Text>
                  </View>
                )}

                {proximityAlert.alternativeStopNotes && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>↔️ Alternative stop</Text>
                    <Text style={styles.description}>{proximityAlert.alternativeStopNotes}</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.buttons}>
                <TouchableOpacity style={styles.dismissBtn} onPress={dismissAlert}>
                  <Text style={styles.dismissText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextBtn} onPress={handleAdvance}>
                  <Text style={styles.nextText}>Next waypoint</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
    alignItems: 'center',
  },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  typeLabel: { fontSize: 13, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  pointName: { fontSize: 22, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  message: { fontSize: 15, color: Colors.secondary, textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
  scroll: { width: '100%', maxHeight: 300 },
  description: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  warningItem: { fontSize: 13, color: Colors.danger, lineHeight: 20 },
  tipItem: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  dismissBtn: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  dismissText: { fontSize: 15, color: Colors.text, fontWeight: '600' },
  nextBtn: {
    flex: 2, backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 8,
  },
  nextText: { fontSize: 15, color: '#fff', fontWeight: '600' },
})