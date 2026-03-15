import { useState, useEffect, useRef } from 'react'
import * as Location from 'expo-location'
import { useNavigationStore } from '../store/navigationStore'
import { RoutePoint } from '../types'

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null)
  const alertedPoints = useRef<Set<string>>(new Set())

  const { isActive, points, currentPointIndex, updateLocation, setProximityAlert } =
    useNavigationStore()

  useEffect(() => {
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      setHasPermission(status === 'granted')
      if (status !== 'granted') return

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 20,
        },
        (loc) => {
          setLocation(loc)
          const { latitude, longitude } = loc.coords
          const speedKnots = loc.coords.speed
            ? loc.coords.speed * 1.94384
            : undefined

          updateLocation({
            lat: latitude,
            lng: longitude,
            speed: speedKnots,
            heading: loc.coords.heading ?? undefined,
          })

          // Proximity check
          if (isActive && points.length > 0) {
            const nextPoint: RoutePoint = points[currentPointIndex]
            if (nextPoint && !alertedPoints.current.has(nextPoint.id)) {
              const dist = haversineNm(latitude, longitude, nextPoint.lat, nextPoint.lng)
              if (dist <= nextPoint.proximityAlertNm) {
                alertedPoints.current.add(nextPoint.id)
                setProximityAlert(nextPoint)
              }
            }
          }
        }
      )
    })()

    return () => {
      subscriptionRef.current?.remove()
    }
  }, [isActive, currentPointIndex])

  const distanceToPoint = (point: RoutePoint): number | null => {
    if (!location) return null
    return haversineNm(
      location.coords.latitude,
      location.coords.longitude,
      point.lat,
      point.lng
    )
  }

  const etaHours = (point: RoutePoint, speedKnots: number = 5): number | null => {
    const dist = distanceToPoint(point)
    if (dist === null) return null
    return dist / speedKnots
  }

  return { location, hasPermission, distanceToPoint, etaHours }
}