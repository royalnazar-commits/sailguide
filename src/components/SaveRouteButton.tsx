import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../constants/colors'
import { useProfileStore } from '../store/profileStore'

interface Props {
  routeId: string
  style?: any
  variant?: 'bookmark' | 'heart'
}

export function SaveRouteButton({ routeId, style, variant = 'bookmark' }: Props) {
  const { savedRoutes, saveRoute, unsaveRoute } = useProfileStore()
  const isSaved = savedRoutes.includes(routeId)

  const icons = {
    bookmark: { saved: 'bookmark', unsaved: 'bookmark-outline' },
    heart: { saved: 'heart', unsaved: 'heart-outline' }
  }

  const handleToggleSave = () => {
    if (isSaved) {
      unsaveRoute(routeId)
    } else {
      saveRoute(routeId)
    }
  }

  if (isSaved) {
    return (
      <TouchableOpacity 
        style={[styles.savedBtn, style]} 
        onPress={handleToggleSave}
        activeOpacity={0.85}
      >
        <Ionicons name={icons[variant].saved} size={18} color={Colors.secondary} />
        <Text style={styles.savedText}>Saved</Text>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity 
      style={[styles.saveBtn, style]} 
      onPress={handleToggleSave}
      activeOpacity={0.85}
    >
      <Ionicons name={icons[variant].unsaved} size={18} color={Colors.textSecondary} />
      <Text style={styles.saveText}>Save Route</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  saveBtn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  saveText: { 
    color: Colors.textSecondary, 
    fontSize: 15, 
    fontWeight: '600' 
  },
  savedBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: Colors.secondary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  savedText: { 
    color: Colors.secondary, 
    fontSize: 15, 
    fontWeight: '600' 
  },
})