import { RotateCw } from 'lucide-react'
import { CATEGORIES } from './filters.js'
import { formatMoney, formatMonth, formatMonthName, formatShortMonth, formatWholeMoney } from './format.js'
import { dailyTotals, daysIn, monthAmount, paceFactor, receiptsFor, WEEKDAYS, weekdayIndex } from './stats.js'

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true }
const BAR_HEIGHT = 120 // px for the tallest month, projection included

const dateOf = (month, day) => `${month}-${String(day).padStart(2, '0')}`

// Six months as stacked category bars; the selected month opens into its days below
export default function MonthlyChart({ trend, month, category, receipts, weekday, error, onRetry, onSelectMonth }) {
  if (error) {
    return (
      <section className="panel monthly" aria-labelledby="monthly-h">
        <h2 id="monthly-h" className="panel-title">Monthly spending</h2>
        <div className="card-error" role="alert">
          <p>Couldn’t load the months. {error}</p>
          <button type="button" className="button" onClick={onRetry}>
            <RotateCw {...ICON} />
            Retry
          </button>
        </div>
      </section>
    )
  }
  if (!trend) return <section className="panel monthly" aria-busy="true"><span className="skeleton skeleton-chart" /></section>

  const max = Math.max(...trend.map((row) => row.total * paceFactor(row.month)), 1)
  const index = Math.max(0, trend.findIndex((row) => row.month === month))
  const left = (index / trend.length) * 100
  const right = ((index + 1) / trend.length) * 100

  // Days of the selected month
  const days = dailyTotals(receiptsFor(receipts, month, { category }), month)
  const dayMax = Math.max(...days.map((v) => v ?? 0), 1)
  const bigIndex = days.indexOf(Math.max(...days.map((v) => v ?? 0)))
  const bigDate = dateOf(month, bigIndex + 1)
  const hasSpend = days.some((v) => v > 0)
  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= daysIn(month))

  return (
    <section className="panel monthly" aria-labelledby="monthly-h">
      <h2 id="monthly-h" className="panel-title">Monthly spending</h2>

      <div className="months">
        {trend.map((row) => {
          const selected = row.month === month
          const factor = paceFactor(row.month)
          const amount = monthAmount(row, category)
          const ghost = factor > 1 ? ((row.total * factor - row.total) / max) * BAR_HEIGHT : 0
          const segments = CATEGORIES.filter((c) => row.byCategory[c] > 0).reverse()
          return (
            <button
              key={row.month}
              type="button"
              className="month-col"
              aria-pressed={selected}
              aria-label={`${formatMonth(row.month)}: ${formatWholeMoney(amount)}${factor > 1 ? ' so far' : ''}`}
              onClick={() => onSelectMonth(row.month)}
            >
              <span className="month-total mono">{formatWholeMoney(amount)}</span>
              <span className="month-stack">
                {ghost > 0 && (
                  <span className="month-ghost mono" style={{ height: ghost }}>
                    pace {formatWholeMoney(amount * factor)}
                  </span>
                )}
                {segments.map((c) => (
                  <span
                    key={c}
                    className={`seg${selected ? ' is-selected' : ''}${category && category !== c ? ' is-faded' : ''}${category === c ? ' is-focus' : ''}`}
                    style={{ '--cat': `var(--${c.toLowerCase()})`, height: (row.byCategory[c] / max) * BAR_HEIGHT }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <div className="month-labels" aria-hidden="true">
        {trend.map((row, i) => (
          <span key={row.month} className={row.month === month ? 'is-selected' : undefined}>
            {formatShortMonth(row.month)}
            {i === 0 && <span className="mono"> {row.month.slice(0, 4)}</span>}
          </span>
        ))}
      </div>

      <svg className="connector" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={`${left},0 ${right},0 100,10 0,10`} />
      </svg>
      <div
        className="days"
        role="img"
        aria-label={`${formatMonthName(month)} day by day: ${days
          .map((v, i) => (v ? `${i + 1}: ${formatMoney(v)}` : null))
          .filter(Boolean)
          .join(', ') || 'no spending'}`}
      >
        {days.map((v, i) => {
          const wd = weekdayIndex(dateOf(month, i + 1))
          const tone = weekday != null ? (wd === weekday ? 'is-ink' : '') : i === bigIndex && hasSpend ? 'is-ink' : 'is-soft'
          return <span key={i} className={`day ${tone}`} style={{ height: v ? Math.max(2, (v / dayMax) * 64) : 0 }} />
        })}
      </div>
      <div className="day-ticks mono" aria-hidden="true">
        {ticks.map((d) => (
          <span key={d} style={{ left: `${((d - 1) / daysIn(month)) * 100}%` }}>{d}</span>
        ))}
      </div>
      <div className="days-caption">
        <span>{formatMonthName(month)}, day by day</span>
        {hasSpend && (
          <span>
            Biggest day {WEEKDAYS[weekdayIndex(bigDate)].slice(0, 3)}, {formatShortMonth(month)} {bigIndex + 1},{' '}
            <span className="mono">{formatMoney(days[bigIndex])}</span>
          </span>
        )}
      </div>
    </section>
  )
}
