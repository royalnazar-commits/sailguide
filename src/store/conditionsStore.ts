import { create } from 'zustand'
import { ConditionReport, ConditionCategory, ConditionSeverity } from '../types/conditionReport'
import { safeStorage } from '../utils/storage'

const STORAGE_KEY = 'conditionReports_v1'
const DEFAULT_TTL_HOURS = 48

// ── Seed reports ──────────────────────────────────────────────────────────────
// Pre-populated so the map feels live on first launch.
// Expire well after the app's reference date of 2026-03-15.

const SEED_REPORTS: ConditionReport[] = [
  {
    id: 'cr-1', placeId: 'hydra-marina', isLocal: false,
    authorName: 'Captain Lars', category: 'CROWDING', severity: 'CAUTION',
    text: 'Town quay nearly full — arrived 15:00 and just got the last stern-to berth. Get here before noon.',
    createdAt: '2026-03-15T06:00:00Z', expiresAt: '2026-03-17T06:00:00Z',
  },
  {
    id: 'cr-2', placeId: 'santorini-caldera', isLocal: false,
    authorName: 'MariaVela', category: 'WIND', severity: 'WARNING',
    text: 'NW Meltemi building — 25–30 kn gusting 35 inside the caldera. Not recommended for boats under 35ft to anchor tonight.',
    createdAt: '2026-03-15T08:30:00Z', expiresAt: '2026-03-17T08:30:00Z',
  },
  {
    id: 'cr-3', placeId: 'santorini-caldera', isLocal: false,
    authorName: 'JohnSails', category: 'SWELL', severity: 'CAUTION',
    text: 'Residual 1.5m swell from yesterday\'s blow still running into the anchorage. Rolly overnight.',
    createdAt: '2026-03-15T07:00:00Z', expiresAt: '2026-03-17T07:00:00Z',
  },
  {
    id: 'cr-4', placeId: 'navagio-beach', isLocal: false,
    authorName: 'Adria Skipper', category: 'CROWDING', severity: 'INFO',
    text: 'Quiet this morning — only 3 boats in the bay. Tour boats start arriving around 10:30.',
    createdAt: '2026-03-15T07:45:00Z', expiresAt: '2026-03-16T07:45:00Z',
  },
  {
    id: 'cr-5', placeId: 'hvar-marina', isLocal: false,
    authorName: 'Mirko C.', category: 'CROWDING', severity: 'WARNING',
    text: 'Marina is fully booked for the weekend. Call ahead — harbourmaster confirmed no availability until Monday.',
    createdAt: '2026-03-14T17:00:00Z', expiresAt: '2026-03-17T17:00:00Z',
  },
  {
    id: 'cr-6', placeId: 'oludeniz-bay', isLocal: false,
    authorName: 'Blue Voyage', category: 'VISIBILITY', severity: 'INFO',
    text: 'Exceptional visibility today — 20m+ underwater. Perfect conditions for snorkelling around the lagoon entrance.',
    createdAt: '2026-03-15T09:00:00Z', expiresAt: '2026-03-16T09:00:00Z',
  },
  {
    id: 'cr-7', placeId: 'portofino-marina', isLocal: false,
    authorName: 'Riviera Sailor', category: 'HAZARD', severity: 'CAUTION',
    text: 'Unlit tender left anchored in entrance channel since last night. Pass to starboard on approach.',
    createdAt: '2026-03-15T05:30:00Z', expiresAt: '2026-03-16T05:30:00Z',
  },
  {
    id: 'cr-8', placeId: 'gocek-marina', isLocal: false,
    authorName: 'Aegean Anna', category: 'GENERAL', severity: 'INFO',
    text: 'Fuel dock operational and well-stocked. Diesel €1.42/L. No queues this morning.',
    createdAt: '2026-03-15T08:00:00Z', expiresAt: '2026-03-17T08:00:00Z',
  },
]

// ── Category & severity metadata ──────────────────────────────────────────────

export const CATEGORY_META: Record<ConditionCategory, { label: string; icon: string; color: string }> = {
  WIND:       { label: 'Wind',       icon: 'flag-outline',               color: '#3B82F6' },
  SWELL:      { label: 'Swell',      icon: 'water-outline',              color: '#0EA5E9' },
  CROWDING:   { label: 'Crowding',   icon: 'people-outline',             color: '#8B5CF6' },
  HAZARD:     { label: 'Hazard',     icon: 'warning-outline',            color: '#EF4444' },
  VISIBILITY: { label: 'Visibility', icon: 'eye-outline',                color: '#64748B' },
  GENERAL:    { label: 'General',    icon: 'information-circle-outline', color: '#F59E0B' },
}

export const SEVERITY_META: Record<ConditionSeverity, { label: string; color: string; bg: string }> = {
  INFO:    { label: 'Info',    color: '#22C55E', bg: '#22C55E18' },
  CAUTION: { label: 'Caution', color: '#F59E0B', bg: '#F59E0B18' },
  WARNING: { label: 'Warning', color: '#EF4444', bg: '#EF444418' },
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface ConditionsState {
  reports: ConditionReport[]

  // Reads — automatically filters expired reports
  getActiveReportsForPlace: (placeId: string) => ConditionReport[]
  getHighestSeverityForPlace: (placeId: string) => ConditionSeverity | null

  // Writes
  addReport: (
    placeId: string,
    authorName: string,
    category: ConditionCategory,
    severity: ConditionSeverity,
    text: string,
    authorId?: string,
    ttlHours?: number,
  ) => ConditionReport
  deleteReport: (reportId: string) => void

  // Persistence
  loadReports: () => Promise<void>
  saveReports: () => Promise<void>
}

const isActive = (r: ConditionReport) => new Date(r.expiresAt).getTime() > Date.now()

const SEVERITY_RANK: Record<ConditionSeverity, number> = { INFO: 0, CAUTION: 1, WARNING: 2 }

export const useConditionsStore = create<ConditionsState>((set, get) => ({
  reports: SEED_REPORTS,

  getActiveReportsForPlace: (placeId) =>
    get().reports
      .filter((r) => r.placeId === placeId && isActive(r))
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  getHighestSeverityForPlace: (placeId) => {
    const active = get().getActiveReportsForPlace(placeId)
    if (active.length === 0) return null
    return active.reduce((best, r) =>
      SEVERITY_RANK[r.severity] > SEVERITY_RANK[best] ? r.severity : best,
      active[0].severity,
    )
  },

  addReport: (placeId, authorName, category, severity, text, authorId, ttlHours = DEFAULT_TTL_HOURS) => {
    const now = new Date()
    const expires = new Date(now.getTime() + ttlHours * 60 * 60 * 1000)
    const report: ConditionReport = {
      id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      placeId,
      authorName: authorName.trim(),
      authorId,
      category,
      severity,
      text: text.trim(),
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      isLocal: true,
    }
    set((state) => ({ reports: [report, ...state.reports] }))
    get().saveReports()
    return report
  },

  deleteReport: (reportId) => {
    set((state) => ({ reports: state.reports.filter((r) => r.id !== reportId) }))
    get().saveReports()
  },

  loadReports: async () => {
    try {
      const raw = await safeStorage.getItem(STORAGE_KEY)
      if (raw) {
        const local: ConditionReport[] = JSON.parse(raw)
        const localIds = new Set(local.map((r) => r.id))
        const merged = [
          ...local,
          ...SEED_REPORTS.filter((r) => !localIds.has(r.id)),
        ]
        set({ reports: merged })
      }
    } catch {
      // corrupt — keep seeds
    }
  },

  saveReports: async () => {
    try {
      const local = get().reports.filter((r) => r.isLocal !== false)
      await safeStorage.setItem(STORAGE_KEY, JSON.stringify(local))
    } catch {
      // in-memory only
    }
  },
}))
