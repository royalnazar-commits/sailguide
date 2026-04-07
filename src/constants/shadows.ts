/**
 * Standardized shadow design tokens — use these across all cards, modals,
 * and floating elements so iOS shadows and Android elevation stay in sync.
 *
 * iOS  → shadowColor / shadowOffset / shadowOpacity / shadowRadius
 * Android → elevation
 * Include both in every token so both platforms render correctly.
 */
export const Shadows = {
  /** Hairline lift — subtle list items, tight containers */
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  /** Standard card shadow */
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  /** Prominent card / floating map control */
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  /** Modal / bottom sheet */
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 16,
  },
  /** Upward shadow — sticky footers, tab bars, bottom sheets */
  up: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
} as const
