// Client-side numbers computed from the receipt list, using the same rule as the backend stats:
// a receipt counts once it is not processing and has a date and a total.
import { addMonths, currentMonth, monthOf } from './format.js'

export const counted = (r) => r.status !== 'processing' && r.date && r.total != null
export const sumOf = (list) => list.reduce((t, r) => t + r.total, 0)
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function daysIn(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// Days of the month that have happened: today's date for the current month, all of them otherwise
export function daysElapsed(month) {
  return month === currentMonth() ? new Date().getDate() : daysIn(month)
}

// Monday = 0
export function weekdayIndex(isoDate) {
  return (new Date(`${isoDate}T00:00:00`).getDay() + 6) % 7
}

const dayOf = (isoDate) => Number(isoDate.slice(8, 10))

// Receipts in a month, optionally one category and a merchant search, optionally only the first N days
export function receiptsFor(receipts, month, { category = null, query = '', throughDay = 31 } = {}) {
  const q = query.trim().toLowerCase()
  return (receipts ?? []).filter(
    (r) =>
      counted(r) &&
      monthOf(r.date) === month &&
      dayOf(r.date) <= throughDay &&
      (!category || r.category === category) &&
      (!q || (r.merchant ?? '').toLowerCase().includes(q)),
  )
}

export function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Spend per day of the month; null for days that haven't happened yet
export function dailyTotals(list, month) {
  const days = daysIn(month)
  const elapsed = daysElapsed(month)
  const out = Array.from({ length: days }, (_, i) => (i < elapsed ? 0 : null))
  for (const r of list) out[dayOf(r.date) - 1] += r.total
  return out
}

export function weekdayTotals(list) {
  const rows = WEEKDAYS.map((weekday) => ({ weekday, total: 0, visits: 0 }))
  for (const r of list) {
    const row = rows[weekdayIndex(r.date)]
    row.total += r.total
    row.visits += 1
  }
  return rows
}

export function merchantTotals(list) {
  const byName = new Map()
  for (const r of list) {
    const name = r.merchant ?? 'Unknown'
    const key = name.toLowerCase()
    const row = byName.get(key) ?? { name, category: r.category, visits: 0, total: 0 }
    row.visits += 1
    row.total += r.total
    byName.set(key, row)
  }
  return [...byName.values()].sort((a, b) => b.total - a.total)
}

export function categorySizes(list) {
  const byCat = new Map()
  for (const r of list) {
    const c = r.category ?? 'Other'
    byCat.set(c, [...(byCat.get(c) ?? []), r.total])
  }
  return [...byCat.entries()]
    .map(([category, totals]) => ({ category, count: totals.length, average: sumOf(totals.map((total) => ({ total }))) / totals.length, median: median(totals) }))
    .sort((a, b) => b.count - a.count)
}

// Category totals this month vs the same stretch of last month (all of it for past months)
export function categoryRows(receipts, month) {
  const elapsed = daysElapsed(month)
  const partial = elapsed < daysIn(month)
  const now = receiptsFor(receipts, month)
  const before = receiptsFor(receipts, addMonths(month, -1), { throughDay: partial ? elapsed : 31 })
  const cats = new Set([...now, ...before].map((r) => r.category ?? 'Other'))
  return [...cats]
    .map((category) => {
      const total = sumOf(now.filter((r) => (r.category ?? 'Other') === category))
      const prev = sumOf(before.filter((r) => (r.category ?? 'Other') === category))
      const waiting = sumOf(now.filter((r) => (r.category ?? 'Other') === category && r.status === 'review'))
      return { category, total, prev, change: total - prev, waiting }
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
}

// A month's total from the trend rows, for one category or all of them
export function monthAmount(row, category) {
  if (!row) return 0
  return category ? (row.byCategory[category] ?? 0) : row.total
}

// Projection multiplier: 30 days / 8 elapsed for the current month, 1 for finished months
export function paceFactor(month) {
  return daysIn(month) / daysElapsed(month)
}
