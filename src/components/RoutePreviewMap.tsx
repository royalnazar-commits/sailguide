import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import MapView, { Polyline, Marker } from 'react-native-maps'
import { RoutePoint } from '../types'
import { Colors } from '../constants/colors'

const PIN_COLOR: Record<string, string> = {
  MARINA:    Colors.marinaPin,
  ANCHORAGE: Colors.anchoragePin,
  WAYPOINT:  Colors.textMuted,
  POI:       Colors.accent,
  DANGER:    '#EF4444',
  FUEL:      '#F59E0B',
}

interface Props {
  points: RoutePoint[]
  height?: number
}

function computeRegion(points: RoutePoint[]) {
  if (points.length === 0) {
    return { latitude: 37.5, longitude: 23.0, latitudeDelta: 2, longitudeDelta: 2 }
  }

  let minLat = points[0].lat
  let maxLat = points[0].lat
  let minLng = points[0].lng
  let maxLng = points[0].lng

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }

  // Add 25 % padding so markers are never clipped at the frame edge
  const PADDING = 0.28
  const latSpan = Math.max(maxLat - minLat, 0.04)
  const lngSpan = Math.max(maxLng - minLng, 0.04)

  return {
    latitude:      (minLat + maxLat) / 2,
    longitude:     (minLng + maxLng) / 2,
    latitudeDelta:  latSpan * (1 + PADDING),
    longitudeDelta: lngSpan * (1 + PADDING),
  }
}

export function RoutePreviewMap({ points, height = 200 }: Props) {
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.sequence - b.sequence),
    [points],
  )

  const region = useMemo(() => computeRegion(sorted), [sorted])

  const polylineCoords = useMemo(
    () => sorted.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [sorted],
  )

  if (sorted.length === 0) {
    return <View style={[styles.placeholder, { height }]} />
  }

  return (
    <View style={[styles.container, { height }]} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        showsCompass={false}
        showsScale={false}
        showsUserLocation={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsTraffic={false}
        moveOnMarkerPress={false}
        liteMode
      >
        {/* Route polyline */}
        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={Colors.routeLine}
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            lineDashPattern={[10, 5]}
          />
        )}

        {/* Numbered stop markers */}
        {sorted.map((point, index) => {
          const color = PIN_COLOR[point.type] ?? PIN_COLOR.WAYPOINT
          const isFirst = index === 0
          const isLast  = index === sorted.length - 1
          const ringColor = isFirst ? '#22C55E' : isLast ? '#EF4444' : color
          return (
            <Marker
              key={point.id}
              coordinate={{ latitude: point.lat, longitude: point.lng }}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.markerOuter, { borderColor: ringColor }]}>
                <View style={[styles.markerInner, { backgroundColor: ringColor }]}>
                  <Text style={styles.markerNum}>{index + 1}</Text>
                </View>
              </View>
            </Marker>
          )
        })}
      </MapView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#E8F4FD',
  },
  placeholder: {
    width: '100%',
    backgroundColor: '#E8F4FD',
  },
  markerOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  markerInner: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerNum: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
})
