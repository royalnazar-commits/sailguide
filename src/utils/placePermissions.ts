import { Place } from '../types/place'
import { UserRole } from '../types'

/**
 * Permission rules for user-contributed map markers.
 *
 * ADMIN  — full access to all markers
 * Owner  — can manage only markers where place.createdBy === userId
 * Others — read-only; never see edit/delete controls
 */

export function canEditPlace(
  place: Place,
  userId: string | undefined,
  role: UserRole | undefined,
): boolean {
  if (!userId) return false
  if (role === 'ADMIN') return true
  return !!place.isUserCreated && place.createdBy === userId
}

export function canRepositionPlace(
  place: Place,
  userId: string | undefined,
  role: UserRole | undefined,
): boolean {
  return canEditPlace(place, userId, role)
}

export function canDeletePlace(
  place: Place,
  userId: string | undefined,
  role: UserRole | undefined,
): boolean {
  if (!userId) return false
  if (role === 'ADMIN') return true
  return !!place.isUserCreated && place.createdBy === userId
}
