const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatMoney(amount) {
  return amount == null ? '–' : money.format(amount)
}

// "2026-10-14" -> "Oct 14"
export function formatDate(isoDate) {
  if (!isoDate) return '–'
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Months are handled as "YYYY-MM" strings so they compare and sort as plain text

export function monthOf(isoDate) {
  return isoDate?.slice(0, 7) ?? ''
}

export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(month, n) {
  const [year, m] = month.split('-').map(Number)
  const d = new Date(year, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// "2026-10" -> "Oct"
export function formatShortMonth(month) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

// "2026-10" -> "October 2026"
export function formatMonth(month) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// "2026-10" -> "October"
export function formatMonthName(month) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
}

// Whole dollars, for chart labels where cents are noise: 1234.5 -> "$1,235"
const wholeMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
export function formatWholeMoney(amount) {
  return amount == null ? '–' : wholeMoney.format(amount)
}
