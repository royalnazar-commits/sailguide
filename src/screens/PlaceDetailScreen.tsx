import React, { useRef, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, Linking, Platform, Alert,
  TextInput, KeyboardAvoidingView,
} from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { seedPlaces } from '../data/seedPlaces'
import { usePlacesStore } from '../store/placesStore'
import { useCommentsStore } from '../store/commentsStore'
import { useConditionsStore, CATEGORY_META, SEVERITY_META } from '../store/conditionsStore'
import { useAuthStore } from '../store/authStore'
import { PlaceMarker } from '../components/PlaceMarker'
import { LevelBadge } from '../components/LevelBadge'
import { getPlaceTypeMeta } from '../constants/placeTypes'
import { Comment } from '../types/comment'
import { ConditionCategory, ConditionReport, ConditionSeverity } from '../types/conditionReport'
import { Colors } from '../constants/colors'
import { useProfileStore } from '../store/profileStore'
import { useCaptainStore } from '../store/captainStore'
import { PurchaseModal } from '../components/PurchaseModal'

// Avatar colors generated from author name initial
const AVATAR_COLORS = ['#1B6CA8', '#22C55E', '#00B4D8', '#8B5CF6', '#EC4899', '#F59E0B']
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

// ── Screen ─────────────────────────────────────────────────────────────────

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const { savedPlaces, savePlace, unsavePlace } = useProfileStore()
  const { userPlaces } = usePlacesStore()
  const { getCommentsForPlace, addComment, getAvgRatingForPlace } = useCommentsStore()
  const { getActiveReportsForPlace, addReport, deleteReport } = useConditionsStore()
  const { user } = useAuthStore()

  // Conditions state
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportCategory, setReportCategory] = useState<ConditionCategory>('GENERAL')
  const [reportSeverity, setReportSeverity] = useState<ConditionSeverity>('INFO')
  const [reportText, setReportText] = useState('')
  const [reportTextError, setReportTextError] = useState('')

  // Comment composer state
  const [commentName, setCommentName] = useState(user?.name ?? '')
  const [commentText, setCommentText] = useState('')
  const [commentRating, setCommentRating] = useState(0)
  const [nameError, setNameError] = useState('')
  const [textError, setTextError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { hasAccessToPlace, purchaseItem } = useCaptainStore()
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)

  const textRef = useRef<TextInput>(null)
  const scrollRef = useRef<ScrollView>(null)

  const place = seedPlaces.find((p) => p.id === id) ?? userPlaces.find((p) => p.id === id)

  if (!place) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="map-outline" size={56} color={Colors.textMuted} />
        <Text style={styles.notFoundText}>Place not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Premium access check
  const captainId = place.createdBy ?? ''
  const isLocked = !!(place.isPremium && !hasAccessToPlace(place.id, captainId, user?.id))

  const meta = getPlaceTypeMeta(place.type)
  const isSaved = savedPlaces.includes(place.id)
  const heroPhoto = place.photos[0] || 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800'
  const bottomPad = Math.max(insets.bottom + 88, 110)
  const comments = getCommentsForPlace(place.id)
  const liveRating = getAvgRatingForPlace(place.id)
  const activeReports = getActiveReportsForPlace(place.id)

  const handlePostReport = () => {
    if (reportText.trim().length < 5) {
      setReportTextError('Please describe the conditions (at least 5 characters)')
      return
    }
    setReportTextError('')
    addReport(
      place.id,
      user?.name ?? 'Anonymous',
      reportCategory,
      reportSeverity,
      reportText.trim(),
      user?.id,
    )
    setReportText('')
    setReportCategory('GENERAL')
    setReportSeverity('INFO')
    setShowReportForm(false)
  }

  const handleDirections = () => {
    const { lat, lng, name } = place
    const label = encodeURIComponent(name)
    const url = Platform.OS === 'ios'
      ? `maps://app?daddr=${lat},${lng}&dirflg=d`
      : `geo:${lat},${lng}?q=${lat},${lng}(${label})`
    Linking.canOpenURL(url)
      .then((ok) => ok
        ? Linking.openURL(url)
        : Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`))
      .catch(() => Alert.alert('Could not open maps app'))
  }

  const handleSaveToggle = () => {
    isSaved ? unsavePlace(place.id) : savePlace(place.id)
  }

  const handlePostComment = () => {
    let valid = true
    if (!commentName.trim()) { setNameError('Your name is required'); valid = false }
    else setNameError('')
    if (commentText.trim().length < 5) { setTextError('Comment is too short'); valid = false }
    else setTextError('')
    if (!valid) return

    setSubmitting(true)
    addComment(place.id, commentName.trim(), commentText.trim(), user?.id, commentRating || undefined)
    setCommentText('')
    setCommentRating(0)
    setSubmitting(false)
    // Scroll up to show the new comment at the top of the list
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  // Show locked gate for premium places the user hasn't purchased
  if (isLocked) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        {/* Back button */}
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Hero image blurred-ish overlay */}
        <Image
          source={{ uri: place.photos[0] || 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800' }}
          style={{ width: '100%', height: 260 }}
          blurRadius={8}
        />

        {/* Lock content */}
        <View style={styles.lockedContent}>
          <View style={styles.lockedIconWrap}>
            <Ionicons name="lock-closed" size={32} color={Colors.warning} />
          </View>
          <Text style={styles.lockedTitle}>{place.name}</Text>
          <Text style={styles.lockedSub}>
            This is a premium place by a captain.
            {place.priceUsd ? ` Unlock it for $${place.priceUsd.toFixed(2)}.` : ''}
          </Text>
          <TouchableOpacity
            style={styles.lockedBtn}
            onPress={() => setShowPurchaseModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="lock-open-outline" size={18} color="#fff" />
            <Text style={styles.lockedBtnText}>
              {place.priceUsd ? `Unlock for $${place.priceUsd.toFixed(2)}` : 'Get Access'}
            </Text>
          </TouchableOpacity>
        </View>

        <PurchaseModal
          visible={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
          title={`Unlock "${place.name}"`}
          subtitle={place.description}
          priceUsd={place.priceUsd ?? 0}
          confirmLabel={place.priceUsd ? `Buy for $${place.priceUsd.toFixed(2)}` : 'Get Free Access'}
          onConfirm={() => {
            purchaseItem({
              type: 'PLACE',
              itemId: place.id,
              captainId,
              priceUsd: place.priceUsd ?? 0,
            })
          }}
        />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {/* ── Hero image ──────────────────────────────────────────────── */}
        <View>
          <Image source={{ uri: heroPhoto }} style={styles.hero} />
          <View style={styles.heroScrim} />
          <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroTypeBadge}>
            <Ionicons name={meta.icon as any} size={13} color="#fff" />
            <Text style={styles.heroTypeLabel}>{meta.label}</Text>
          </View>
        </View>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Name + verified */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>{place.name}</Text>
            {place.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={13} color={Colors.verified} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={15} color={Colors.textMuted} />
            <Text style={styles.location}>{place.region} · {place.country}</Text>
          </View>

          {/* Rating — live average from community ratings, falls back to curated */}
          {(liveRating || place.rating !== undefined) && (() => {
            const displayAvg = liveRating ? liveRating.avg : place.rating!
            const filled = Math.round(displayAvg)
            return (
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name={s <= filled ? 'star' : 'star-outline'} size={16}
                    color={s <= filled ? '#F59E0B' : Colors.border} />
                ))}
                <Text style={styles.ratingValue}>{displayAvg.toFixed(1)}</Text>
                {liveRating && (
                  <Text style={styles.ratingCount}>({liveRating.count} rating{liveRating.count !== 1 ? 's' : ''})</Text>
                )}
              </View>
            )
          })()}

          <View style={styles.divider} />

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{place.description}</Text>
          </View>

          {/* User-created badge */}
          {place.isUserCreated && (
            <View style={styles.yourPlaceBadge}>
              <Ionicons name="person-circle-outline" size={15} color={Colors.secondary} />
              <Text style={styles.yourPlaceText}>Your Place</Text>
              <TouchableOpacity onPress={() => router.push('/my-places')} style={styles.yourPlaceLink}>
                <Text style={styles.yourPlaceLinkText}>Manage →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tips */}
          {place.tips && place.tips.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skipper Tips</Text>
              {place.tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <View style={styles.tipIcon}>
                    <Ionicons name="compass-outline" size={15} color={Colors.secondary} />
                  </View>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Private notes */}
          {place.notes && (
            <View style={styles.section}>
              <View style={styles.notesHeader}>
                <Ionicons name="lock-closed-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.sectionTitle}>Private Notes</Text>
              </View>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{place.notes}</Text>
              </View>
            </View>
          )}

          {/* Tags */}
          {place.tags && place.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {place.tags.map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Mini map */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.miniMap}
                initialRegion={{ latitude: place.lat, longitude: place.lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
                scrollEnabled={false} zoomEnabled={false} pitchEnabled={false}
                rotateEnabled={false} showsCompass={false} showsScale={false}
              >
                <Marker coordinate={{ latitude: place.lat, longitude: place.lng }}
                  tracksViewChanges={false} anchor={{ x: 0.5, y: 1 }}>
                  <PlaceMarker type={place.type} selected />
                </Marker>
              </MapView>
              <TouchableOpacity style={styles.mapOpenBtn} onPress={handleDirections} activeOpacity={0.85}>
                <Ionicons name="open-outline" size={13} color={Colors.secondary} />
                <Text style={styles.mapOpenText}>Open in Maps</Text>
              </TouchableOpacity>
              <View style={styles.coordPill}>
                <Text style={styles.coordText}>
                  {place.lat.toFixed(4)}° N · {place.lng.toFixed(4)}° E
                </Text>
              </View>
            </View>
          </View>

          {/* ── Conditions reports ────────────────────────────────────── */}
          <View style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.conditionsSectionHeader}>
              <Text style={styles.sectionTitle}>
                Current Conditions{activeReports.length > 0 ? ` (${activeReports.length})` : ''}
              </Text>
              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => setShowReportForm((v) => !v)}
                activeOpacity={0.8}
              >
                <Ionicons name={showReportForm ? 'close' : 'add'} size={14} color={Colors.secondary} />
                <Text style={styles.reportBtnText}>{showReportForm ? 'Cancel' : 'Report'}</Text>
              </TouchableOpacity>
            </View>

            {/* Active reports list */}
            {activeReports.length === 0 && !showReportForm && (
              <View style={styles.conditionsEmpty}>
                <Ionicons name="partly-sunny-outline" size={28} color={Colors.textMuted} />
                <Text style={styles.conditionsEmptyText}>No active reports — conditions appear normal.</Text>
              </View>
            )}
            {activeReports.length > 0 && (
              <View style={styles.reportsList}>
                {activeReports.map((report) => (
                  <ConditionCard
                    key={report.id}
                    report={report}
                    canDelete={report.isLocal === true}
                    onDelete={() => deleteReport(report.id)}
                  />
                ))}
              </View>
            )}

            {/* Inline report form */}
            {showReportForm && (
              <View style={styles.reportForm}>
                {/* Category */}
                <Text style={styles.reportFormLabel}>Category</Text>
                <View style={styles.categoryGrid}>
                  {(Object.keys(CATEGORY_META) as ConditionCategory[]).map((cat) => {
                    const m = CATEGORY_META[cat]
                    const active = reportCategory === cat
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.categoryChip, active && { backgroundColor: m.color + '18', borderColor: m.color }]}
                        onPress={() => setReportCategory(cat)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={m.icon as any} size={14} color={active ? m.color : Colors.textMuted} />
                        <Text style={[styles.categoryChipText, active && { color: m.color }]}>{m.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Severity */}
                <Text style={[styles.reportFormLabel, { marginTop: 12 }]}>Severity</Text>
                <View style={styles.severityRow}>
                  {(Object.keys(SEVERITY_META) as ConditionSeverity[]).map((sev) => {
                    const m = SEVERITY_META[sev]
                    const active = reportSeverity === sev
                    return (
                      <TouchableOpacity
                        key={sev}
                        style={[styles.severityChip, active && { backgroundColor: m.bg, borderColor: m.color }]}
                        onPress={() => setReportSeverity(sev)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.severityChipText, active && { color: m.color }]}>{m.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Description */}
                <Text style={[styles.reportFormLabel, { marginTop: 12 }]}>Description</Text>
                <TextInput
                  style={[styles.reportTextInput, reportTextError ? styles.composerInputError : null]}
                  placeholder="Describe current conditions briefly…"
                  placeholderTextColor={Colors.textMuted}
                  value={reportText}
                  onChangeText={(v) => { setReportText(v); setReportTextError('') }}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={280}
                />
                {reportTextError ? <Text style={styles.composerError}>{reportTextError}</Text> : null}
                <Text style={styles.reportTTLHint}>Reports expire automatically after 48 hours.</Text>

                <TouchableOpacity style={styles.reportSubmitBtn} onPress={handlePostReport} activeOpacity={0.85}>
                  <Ionicons name="send" size={15} color="#fff" />
                  <Text style={styles.reportSubmitText}>Post Conditions Report</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ── Comments ──────────────────────────────────────────────── */}
          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.commentsSectionHeader}>
              <Text style={styles.sectionTitle}>
                Comments{comments.length > 0 ? ` (${comments.length})` : ''}
              </Text>
              {comments.length > 0 && (
                <View style={styles.commentCountPill}>
                  <Ionicons name="chatbubble-outline" size={12} color={Colors.secondary} />
                  <Text style={styles.commentCountPillText}>{comments.length}</Text>
                </View>
              )}
            </View>

            {comments.length === 0 ? (
              <View style={styles.commentsEmpty}>
                <Ionicons name="chatbubbles-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.commentsEmptyTitle}>No comments yet</Text>
                <Text style={styles.commentsEmptyText}>Be the first to share your experience of this place.</Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {comments.map((comment, idx) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    isLast={idx === comments.length - 1}
                  />
                ))}
              </View>
            )}
          </View>

          {/* ── Composer ────────────────────────────────────────────── */}
          <View style={styles.composer}>
            <Text style={styles.composerTitle}>Leave a Comment</Text>

            {/* Name field — read-only if logged in */}
            <View style={styles.composerField}>
              <Text style={styles.composerLabel}>Your name</Text>
              <TextInput
                style={[styles.composerInput, nameError ? styles.composerInputError : null,
                  user ? styles.composerInputReadonly : null]}
                placeholder="e.g. Captain Jan"
                placeholderTextColor={Colors.textMuted}
                value={commentName}
                onChangeText={(v) => { setCommentName(v); setNameError('') }}
                editable={!user}
                returnKeyType="next"
                onSubmitEditing={() => textRef.current?.focus()}
              />
              {nameError ? <Text style={styles.composerError}>{nameError}</Text> : null}
              {user && (
                <Text style={styles.composerHint}>Posting as {user.name}</Text>
              )}
            </View>

            {/* Comment text */}
            <View style={styles.composerField}>
              <Text style={styles.composerLabel}>Comment</Text>
              <TextInput
                ref={textRef}
                style={[styles.composerInput, styles.composerTextArea,
                  textError ? styles.composerInputError : null]}
                placeholder="Share your experience, tips, or warnings…"
                placeholderTextColor={Colors.textMuted}
                value={commentText}
                onChangeText={(v) => { setCommentText(v); setTextError('') }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                blurOnSubmit={false}
              />
              {textError ? <Text style={styles.composerError}>{textError}</Text> : null}
            </View>

            {/* Star rating picker */}
            <View style={styles.composerField}>
              <Text style={styles.composerLabel}>Rating <Text style={styles.composerLabelOptional}>(optional)</Text></Text>
              <StarPicker value={commentRating} onChange={setCommentRating} />
            </View>

            <TouchableOpacity
              style={[styles.composerSubmit, submitting && { opacity: 0.6 }]}
              onPress={handlePostComment}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={styles.composerSubmitText}>Post Comment</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

      {/* ── Bottom action bar ────────────────────────────────────────── */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.saveBtn, isSaved && styles.saveBtnActive]}
          onPress={handleSaveToggle}
          activeOpacity={0.82}
        >
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20}
            color={isSaved ? Colors.primary : Colors.textSecondary} />
          <Text style={[styles.saveBtnText, isSaved && styles.saveBtnTextActive]}>
            {isSaved ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.directionsBtn} onPress={handleDirections} activeOpacity={0.85}>
          <Ionicons name="navigate" size={18} color="#fff" />
          <Text style={styles.directionsBtnText}>Get Directions</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

// ── Comment card ───────────────────────────────────────────────────────────

function CommentCard({ comment, isLast }: { comment: Comment; isLast: boolean }) {
  const color = avatarColor(comment.authorName)
  const initial = comment.authorName.charAt(0).toUpperCase()
  const date = new Date(comment.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const isNew = comment.isLocal === true || comment.isLocal === undefined

  return (
    <View style={[styles.commentCard, !isLast && styles.commentCardBorder]}>
      <View style={[styles.commentAvatar, { backgroundColor: color }]}>
        <Text style={styles.commentAvatarText}>{initial}</Text>
      </View>
      <View style={styles.commentBody}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentAuthor}>{comment.authorName}</Text>
          {comment.authorLevel != null && (
            <LevelBadge level={comment.authorLevel} size="xs" />
          )}
          {isNew && comment.isLocal && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>New</Text>
            </View>
          )}
          <Text style={styles.commentDate}>{date}</Text>
        </View>
        {comment.rating != null && (
          <View style={styles.commentRatingRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons key={s} name={s <= comment.rating! ? 'star' : 'star-outline'} size={12}
                color={s <= comment.rating! ? '#F59E0B' : Colors.border} />
            ))}
          </View>
        )}
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
    </View>
  )
}

// ── Condition card ─────────────────────────────────────────────────────────

function ConditionCard({
  report, canDelete, onDelete,
}: { report: ConditionReport; canDelete: boolean; onDelete: () => void }) {
  const catMeta = CATEGORY_META[report.category]
  const sevMeta = SEVERITY_META[report.severity]
  const timeAgo = (() => {
    const mins = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`
  })()
  const expiresIn = (() => {
    const hrs = Math.ceil((new Date(report.expiresAt).getTime() - Date.now()) / 3600000)
    return hrs > 0 ? `Expires in ${hrs}h` : 'Expiring soon'
  })()

  return (
    <View style={[styles.conditionCard, { borderLeftColor: sevMeta.color }]}>
      <View style={styles.conditionCardHeader}>
        <View style={[styles.conditionCatBadge, { backgroundColor: catMeta.color + '18' }]}>
          <Ionicons name={catMeta.icon as any} size={12} color={catMeta.color} />
          <Text style={[styles.conditionCatText, { color: catMeta.color }]}>{catMeta.label}</Text>
        </View>
        <View style={[styles.conditionSevBadge, { backgroundColor: sevMeta.bg }]}>
          <Text style={[styles.conditionSevText, { color: sevMeta.color }]}>{sevMeta.label}</Text>
        </View>
        <Text style={styles.conditionTime}>{timeAgo}</Text>
        {canDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.conditionText}>{report.text}</Text>
      <Text style={styles.conditionMeta}>{report.authorName} · {expiresIn}</Text>
    </View>
  )
}

// ── Star picker ────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starPicker}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity key={s} onPress={() => onChange(value === s ? 0 : s)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
          <Ionicons name={s <= value ? 'star' : 'star-outline'} size={28} color={s <= value ? '#F59E0B' : Colors.border} />
        </TouchableOpacity>
      ))}
      {value > 0 && (
        <Text style={styles.starPickerLabel}>
          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][value]}
        </Text>
      )}
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },

  // Premium locked gate
  lockedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    marginTop: -40,
  },
  lockedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F59E0B18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  lockedTitle: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  lockedSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  lockedBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Hero
  hero: { width: '100%', height: 260 },
  heroScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.38)' },
  backBtn: {
    position: 'absolute', left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center',
  },
  heroTypeBadge: {
    position: 'absolute', bottom: 14, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  heroTypeLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Body
  body: { padding: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  name: { flex: 1, fontSize: 24, fontWeight: '800', color: Colors.text, lineHeight: 30 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4,
  },
  verifiedText: { fontSize: 11, color: Colors.verified, fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  location: { fontSize: 14, color: Colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 10 },
  ratingValue: { fontSize: 14, fontWeight: '700', color: Colors.text, marginLeft: 4 },
  ratingCount: { fontSize: 13, color: Colors.textMuted, marginLeft: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 24 },

  tipRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  tipIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFF6FF',
    alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
  },
  tipText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },

  // Your place
  yourPlaceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EFF6FF', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16,
  },
  yourPlaceText: { fontSize: 13, color: Colors.secondary, fontWeight: '600', flex: 1 },
  yourPlaceLink: { paddingLeft: 4 },
  yourPlaceLinkText: { fontSize: 13, color: Colors.secondary, fontWeight: '700' },

  // Notes
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  notesCard: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  notesText: { fontSize: 14, color: Colors.text, lineHeight: 22 },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tagPill: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 13, color: Colors.secondary },

  // Mini map
  mapContainer: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, height: 200 },
  miniMap: { ...StyleSheet.absoluteFillObject },
  mapOpenBtn: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border,
  },
  mapOpenText: { fontSize: 12, color: Colors.secondary, fontWeight: '600' },
  coordPill: {
    position: 'absolute', bottom: 10, left: 10,
    backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border,
  },
  coordText: { fontSize: 11, color: Colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Conditions section
  conditionsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  reportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.secondary + '60',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  reportBtnText: { fontSize: 13, color: Colors.secondary, fontWeight: '600' },
  conditionsEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  conditionsEmptyText: { flex: 1, fontSize: 14, color: Colors.textMuted, lineHeight: 20 },
  reportsList: { gap: 10 },
  conditionCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  conditionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conditionCatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  conditionCatText: { fontSize: 11, fontWeight: '600' },
  conditionSevBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  conditionSevText: { fontSize: 11, fontWeight: '700' },
  conditionTime: { fontSize: 11, color: Colors.textMuted, marginLeft: 'auto' },
  conditionText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  conditionMeta: { fontSize: 12, color: Colors.textMuted },

  // Report form
  reportForm: {
    backgroundColor: Colors.background, borderRadius: 14, padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  reportFormLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff',
  },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: '#fff',
  },
  severityChipText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  reportTextInput: {
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text, minHeight: 76,
  },
  reportTTLHint: { fontSize: 12, color: Colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  reportSubmitBtn: {
    marginTop: 12, backgroundColor: Colors.secondary, borderRadius: 12,
    paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  reportSubmitText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Comments section header
  commentsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  commentCountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  commentCountPillText: { fontSize: 12, color: Colors.secondary, fontWeight: '600' },

  // Empty comments
  commentsEmpty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  commentsEmptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  commentsEmptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },

  // Comment list
  commentsList: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  commentCard: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  commentCardBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  commentAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentAuthor: { fontSize: 14, fontWeight: '700', color: Colors.text },
  commentDate: { fontSize: 12, color: Colors.textMuted, marginLeft: 'auto' },
  newBadge: { backgroundColor: Colors.accent + '25', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.accent },
  commentRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 5 },
  commentText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  // Star picker
  starPicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starPickerLabel: { fontSize: 13, color: Colors.textMuted, marginLeft: 6, fontStyle: 'italic' },

  // Composer
  composer: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  composerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  composerField: { gap: 6 },
  composerLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  composerLabelOptional: { fontWeight: '400', color: Colors.textMuted },
  composerInput: {
    backgroundColor: Colors.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  composerInputError: { borderColor: Colors.danger },
  composerInputReadonly: { color: Colors.textSecondary },
  composerTextArea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 10 },
  composerError: { fontSize: 12, color: Colors.danger },
  composerHint: { fontSize: 12, color: Colors.textMuted },
  composerSubmit: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 13, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  composerSubmitText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Action bar
  actionBar: {
    backgroundColor: '#fff', flexDirection: 'row', gap: 12,
    paddingTop: 14, paddingHorizontal: 16,
    borderTopWidth: 1, borderTopColor: Colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
  },
  saveBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  saveBtnTextActive: { color: Colors.primary },
  directionsBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.secondary, borderRadius: 14, paddingVertical: 13,
  },
  directionsBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Not found
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 16, color: Colors.textMuted },
  backLink: { marginTop: 4 },
  backLinkText: { fontSize: 15, color: Colors.secondary, fontWeight: '600' },
})
