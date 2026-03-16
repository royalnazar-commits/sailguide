/**
 * Captain's personal saved map points — independent of routes.
 * These live on the planning map alongside route waypoints but are
 * NOT automatically part of any route.
 */

export type MapMarkerCategory =
  | 'ANCHORAGE'
  | 'MARINA'
  | 'BAY'
  | 'FUEL'
  | 'RESTAURANT'
  | 'BEACH'
  | 'SNORKELING'
  | 'WARNING'
  | 'CUSTOM'

export interface MapMarker {
  id: string
  title: string
  note?: string
  category: MapMarkerCategory
  latitude: number
  longitude: number
  createdAt: string
  updatedAt: string
}
