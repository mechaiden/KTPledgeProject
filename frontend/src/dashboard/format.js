const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatMoney(amount) {
  return amount == null ? '—' : money.format(amount)
}

// "2026-10-20" -> "Oct 20"
export function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// "2026-10-14" -> "2026-10"
export function monthOf(isoDate) {
  return isoDate.slice(0, 7)
}

// "2026-10" -> "2026-09"
export function prevMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number)
  const d = new Date(year, month - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
