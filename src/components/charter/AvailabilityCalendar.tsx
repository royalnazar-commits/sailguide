import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Colors } from '../../constants/colors'

interface Props {
  bookedWeeks: string[]  // ISO date strings (check-in Saturdays that are booked)
  onSelectWeek?: (checkIn: string, checkOut: string) => void
  selectedCheckIn?: string | null
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function isoDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function AvailabilityCalendar({ bookedWeeks, onSelectWeek, selectedCheckIn }: Props) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const bookedSet = new Set(bookedWeeks)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  const daysInMonth  = getDaysInMonth(viewYear, viewMonth)
  const firstDayOfWeek = getFirstDayOfMonth(viewYear, viewMonth)

  // Build the grid: leading empty cells + day cells
  const cells: Array<number | null> = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: Array<Array<number | null>> = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  const todayStr = isoDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  const getCellState = (day: number | null): 'empty' | 'past' | 'available' | 'booked' | 'selected' => {
    if (day === null) return 'empty'
    const dateStr = isoDateStr(viewYear, viewMonth, day)
    if (dateStr < todayStr) return 'past'
    if (selectedCheckIn && (dateStr === selectedCheckIn || dateStr === addDays(selectedCheckIn, 7)))
      return 'selected'
    if (bookedSet.has(dateStr)) return 'booked'
    return 'available'
  }

  const handleDayPress = (day: number) => {
    const dateStr = isoDateStr(viewYear, viewMonth, day)
    if (dateStr < todayStr) return
    // Saturday check (day 6)
    const dayOfWeek = new Date(dateStr).getDay()
    if (dayOfWeek !== 6) return // Charter is Saturday-to-Saturday
    if (bookedSet.has(dateStr)) return
    const checkOut = addDays(dateStr, 7)
    onSelectWeek?.(dateStr, checkOut)
  }

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.navArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={styles.daysHeader}>
        {DAYS.map((d) => (
          <Text key={d} style={[styles.dayHeader, d === 'Sa' && styles.satHeader]}>{d}</Text>
        ))}
      </View>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((day, di) => {
            const state = getCellState(day)
            const isSat = di === 6
            const isClickable = state === 'available' && isSat

            return (
              <TouchableOpacity
                key={di}
                style={[
                  styles.cell,
                  state === 'past'      && styles.pastCell,
                  state === 'booked'    && styles.bookedCell,
                  state === 'selected'  && styles.selectedCell,
                  state === 'available' && isSat && styles.availableSatCell,
                ]}
                onPress={isClickable && day ? () => handleDayPress(day) : undefined}
                disabled={!isClickable}
                activeOpacity={isClickable ? 0.7 : 1}
              >
                <Text
                  style={[
                    styles.cellText,
                    state === 'past'      && styles.pastText,
                    state === 'booked'    && styles.bookedText,
                    state === 'selected'  && styles.selectedText,
                    state === 'available' && isSat && styles.availableSatText,
                    day === null          && { opacity: 0 },
                  ]}
                >
                  {day ?? 0}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        <LegendItem color={Colors.success} label="Available (Sat)" />
        <LegendItem color="#EF4444" label="Booked" />
        <LegendItem color={Colors.primary} label="Selected" />
      </View>

      <Text style={styles.note}>
        Charters run Saturday to Saturday. Tap an available Saturday to select.
      </Text>
    </View>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={legend_styles.item}>
      <View style={[legend_styles.dot, { backgroundColor: color }]} />
      <Text style={legend_styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: { padding: 4 },
  navArrow: { fontSize: 24, color: Colors.primary, fontWeight: '400' },
  monthTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },

  daysHeader: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: {
    flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600',
    color: Colors.textMuted, paddingVertical: 4,
  },
  satHeader: { color: Colors.primary, fontWeight: '700' },

  week: { flexDirection: 'row', marginBottom: 2 },
  cell: {
    flex: 1, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, margin: 1,
  },
  cellText: { fontSize: 13, fontWeight: '500', color: Colors.text },

  pastCell: { opacity: 0.3 },
  pastText: { color: Colors.textMuted },

  bookedCell: { backgroundColor: '#FEE2E2' },
  bookedText: { color: '#EF4444', fontWeight: '600' },

  selectedCell: { backgroundColor: Colors.primary },
  selectedText: { color: '#fff', fontWeight: '700' },

  availableSatCell: { backgroundColor: Colors.success + '20', borderWidth: 1.5, borderColor: Colors.success },
  availableSatText: { color: Colors.success, fontWeight: '700' },

  legend: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' },
  note: { fontSize: 11, color: Colors.textMuted, marginTop: 8, lineHeight: 16 },
})

const legend_styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 11, color: Colors.textSecondary },
})
