import React, { useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Pressable, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Place } from '../types/place'
import { getPlaceTypeMeta } from '../constants/placeTypes'
import { useCommentsStore } from '../store/commentsStore'
import { useConditionsStore, SEVERITY_META, CATEGORY_META } from '../store/conditionsStore'
import { usePlacesStore } from '../store/placesStore'
import { useAuthStore } from '../store/authStore'
import { canDeletePlace, canRepositionPlace } from '../utils/placePermissions'
import { Colors } from '../constants/colors'

interface Props {
  place: Place
  onClose: () => void
  /** Called when the user taps "Reposition" — ExploreScreen enters drag mode */
  onReposition?: (place: Place) => void
}

export function PlacePopup({ place, onClose, onReposition }: Props) {
  const meta = getPlaceTypeMeta(place.type)
  const translateY = useRef(new Animated.Value(280)).current

  const { getCommentsForPlace, getAvgRatingForPlace } = useCommentsStore()
  const { getActiveReportsForPlace } = useConditionsStore()
  const { deletePlace, localUserId } = usePlacesStore()
  const authUser = useAuthStore((s) => s.user)

  const commentCount  = getCommentsForPlace(place.id).length
  const liveRating    = getAvgRatingForPlace(place.id)
  const activeReports = getActiveReportsForPlace(place.id)

  // Resolve the current user: prefer real auth user, fall back to device-local ID
  const currentUserId = authUser?.id ?? localUserId
  const currentRole   = authUser?.role

  const showDelete     = canDeletePlace(place, currentUserId, currentRole)
  const showReposition = canRepositionPlace(place, currentUserId, currentRole) && !!onReposition

  // Slide in on mount
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: 0,
      tension: 68,
      friction: 10,
      useNativeDriver: true,
    }).start()
  }, [place.id])

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: 280,
      duration: 210,
      useNativeDriver: true,
    }).start(() => onClose())
  }

  const handleViewDetails = () => {
    dismiss()
    router.push(`/place/${place.id}`)
  }

  const handleReposition = () => {
    dismiss()
    onReposition?.(place)
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete place',
      `Remove "${place.name}" from the map? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePlace(place.id, currentUserId, currentRole)
            onClose()
          },
        },
      ],
    )
  }

  return (
    // Backdrop — tapping outside dismisses
    <Pressable style={styles.backdrop} onPress={dismiss}>
      <Animated.View
        style={[styles.card, { transform: [{ translateY }] }]}
        onStartShouldSetResponder={() => true}
      >
        {/* Header row */}
        <View style={styles.header}>
          <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={13} color={meta.color} />
            <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {(liveRating || place.rating !== undefined) && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {liveRating ? liveRating.avg.toFixed(1) : place.rating!.toFixed(1)}
              </Text>
              {liveRating && (
                <Text style={styles.ratingCount}>({liveRating.count})</Text>
              )}
            </View>
          )}
          <TouchableOpacity
            onPress={dismiss}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Place name */}
        <Text style={styles.name}>{place.name}</Text>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.location}>
            {[place.region, place.country].filter(Boolean).join(' · ') || 'Unknown location'}
          </Text>
          {place.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color={Colors.verified} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {!!place.description && (
          <Text style={styles.description} numberOfLines={2}>{place.description}</Text>
        )}

        {/* Active conditions banner */}
        {activeReports.length > 0 && (() => {
          const top = activeReports[0]
          const sevMeta = SEVERITY_META[top.severity]
          const catMeta = CATEGORY_META[top.category]
          return (
            <TouchableOpacity
              style={[styles.conditionsBanner, { backgroundColor: sevMeta.bg, borderColor: sevMeta.color + '40' }]}
              onPress={handleViewDetails}
              activeOpacity={0.8}
            >
              <Ionicons name={catMeta.icon as any} size={13} color={sevMeta.color} />
              <Text style={[styles.conditionsText, { color: sevMeta.color }]} numberOfLines={1}>
                {sevMeta.label}: {top.text}
              </Text>
              {activeReports.length > 1 && (
                <Text style={[styles.conditionsMore, { color: sevMeta.color }]}>+{activeReports.length - 1}</Text>
              )}
            </TouchableOpacity>
          )
        })()}

        {/* Comment count */}
        <TouchableOpacity style={styles.commentRow} onPress={handleViewDetails} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.commentCount}>
            {commentCount === 0
              ? 'No comments yet — be the first'
              : `${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Owner actions row (reposition + delete) */}
        {(showReposition || showDelete) && (
          <View style={styles.ownerActions}>
            {showReposition && (
              <TouchableOpacity style={styles.ownerBtn} onPress={handleReposition} activeOpacity={0.8}>
                <Ionicons name="move-outline" size={15} color={Colors.primary} />
                <Text style={[styles.ownerBtnText, { color: Colors.primary }]}>Reposition</Text>
              </TouchableOpacity>
            )}
            {showDelete && (
              <TouchableOpacity style={[styles.ownerBtn, styles.ownerBtnDanger]} onPress={handleDelete} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
                <Text style={[styles.ownerBtnText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* View details button */}
        <TouchableOpacity style={styles.detailsBtn} onPress={handleViewDetails} activeOpacity={0.85}>
          <Text style={styles.detailsBtnText}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  typeLabel: { fontSize: 12, fontWeight: '600' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  ratingCount: { fontSize: 12, color: Colors.textMuted },
  closeBtn: {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  location: { fontSize: 13, color: Colors.textSecondary },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 6,
  },
  verifiedText: { fontSize: 11, color: Colors.verified, fontWeight: '600' },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  commentCount: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  // Owner action row
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  ownerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 10,
    paddingVertical: 9,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  ownerBtnDanger: {
    backgroundColor: '#EF444412',
    borderColor: '#EF444430',
  },
  ownerBtnText: { fontSize: 13, fontWeight: '600' },
  // View details
  detailsBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  detailsBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  conditionsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  conditionsText: { flex: 1, fontSize: 12, fontWeight: '600' },
  conditionsMore: { fontSize: 12, fontWeight: '700' },
})
