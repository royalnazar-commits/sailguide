/**
 * Shared module-level map region.
 * Any map screen writes here on onRegionChangeComplete.
 * RouteBuilderScreen reads it on mount to open where the user last was.
 */
import { Region } from 'react-native-maps'

export let sharedMapRegion: Region = {
  latitude: 43.2, longitude: 16.5,
  latitudeDelta: 5, longitudeDelta: 6,
}

export function setSharedMapRegion(r: Region) {
  sharedMapRegion = r
}
