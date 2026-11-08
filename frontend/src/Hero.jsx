import { ArrowRight, RotateCw } from 'lucide-react'
import { addMonths, currentMonth, formatMoney, formatMonth, formatMonthName, formatWholeMoney } from './format.js'
import { daysElapsed, monthAmount, paceFactor, receiptsFor, sumOf } from './stats.js'

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true }

function DeltaText({ amount, whole = true }) {
  const fmt = whole ? formatWholeMoney : formatMoney
  return (
    <span className={amount < 0 ? 'delta-text is-down' : 'delta-text is-up'}>
      {amount < 0 ? '↓' : '↑'} {fmt(Math.abs(amount))} {amount < 0 ? 'less' : 'more'}
    </span>
  )
}

function MiniBars({ trend, month, category, onSelectMonth }) {
  const max = Math.max(...trend.map((row) => monthAmount(row, category) * paceFactor(row.month)), 1)
  return (
    <div className="mini">
      <div className="mini-bars">
        {trend.map((row) => {
          const amount = monthAmount(row, category)
          const factor = paceFactor(row.month)
          const partial = factor > 1
          const selected = row.month === month
          return (
            <button
              key={row.month}
              type="button"
              className="mini-col"
              aria-pressed={selected}
              aria-label={`${formatMonth(row.month)}: ${formatWholeMoney(amount)}${partial ? ' so far' : ''}`}
              onClick={() => onSelectMonth(row.month)}
            >
              <span
                className={`mini-bar${partial ? ' is-partial' : ''}${selected ? ' is-selected' : ''}`}
                style={{ height: `${Math.max(4, (amount * factor * 100) / max)}%` }}
              >
                {partial && <span className="mini-fill" style={{ height: `${100 / factor}%` }} />}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mini-labels mono" aria-hidden="true">
        {trend.map((row) => (
          <span key={row.month} className={row.month === month ? 'is-selected' : undefined}>
            {formatMonthName(row.month)[0]}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Hero({ month, category, receipts, trend, error, onRetry, onSelectMonth }) {
  if (error) {
    return (
      <section className="hero" aria-label="Month summary">
        <div className="card-error" role="alert">
          <p>Couldn’t load the month total. {error}</p>
          <button type="button" className="button" onClick={onRetry}>
            <RotateCw {...ICON} />
            Retry
          </button>
        </div>
      </section>
    )
  }
  if (!trend) {
    return (
      <section className="hero" aria-label="Month summary" aria-busy="true">
        <span className="skeleton skeleton-hero" />
      </section>
    )
  }

  const row = trend.find((r) => r.month === month)
  const prevMonth = addMonths(month, -1)
  const prevRow = trend.find((r) => r.month === prevMonth)
  const total = monthAmount(row, category)
  const prevTotal = prevRow ? monthAmount(prevRow, category) : null
  const partial = month === currentMonth()
  const elapsed = daysElapsed(month)
  const name = formatMonthName(month)
  const prevName = formatMonthName(prevMonth)
  const on = category ? ` on ${category}` : ''

  const list = receiptsFor(receipts, month, { category })
  const waiting = sumOf(list.filter((r) => r.status === 'review'))
  const stats = [
    `${list.length} receipt${list.length === 1 ? '' : 's'}`,
    `${formatMoney(total / elapsed)} a day`,
    prevTotal != null && `${formatMoney(prevTotal)} in ${prevName}`,
    waiting > 0 && `includes ${formatMoney(waiting)} waiting on you`,
  ].filter(Boolean)

  let line
  if (partial) {
    const projected = total * paceFactor(month)
    line = prevTotal ? (
      <>
        {elapsed} days into {name}, you’ve spent {Math.round((total / prevTotal) * 100)}% of {prevName}’s total. At this pace
        you’ll end near <span className="mono">{formatWholeMoney(projected)}</span>, <DeltaText amount={projected - prevTotal} /> than{' '}
        {prevName}.
      </>
    ) : (
      <>Nothing here in {prevName}, so there’s no comparison yet.</>
    )
  } else {
    line = prevTotal != null ? (
      <>
        <DeltaText amount={total - prevTotal} whole={false} /> than {prevName}.
      </>
    ) : null
  }

  return (
    <section className="hero" aria-label="Month summary">
      <div className="hero-text">
        <h1 className="hero-title" data-testid="month-total">
          {partial ? 'You’ve spent ' : 'You spent '}
          <strong className="mono-figures">{formatMoney(total)}</strong>
          {on} in {name}
          {partial ? ' so far.' : '.'}
        </h1>
        {line && <p className="hero-line">{line}</p>}
        <p className="hero-stats mono">{stats.join(' · ')}</p>
      </div>
      <MiniBars trend={trend} month={month} category={category} onSelectMonth={onSelectMonth} />
    </section>
  )
}

export function ReviewStrip({ count, onReview }) {
  if (!count) return null
  return (
    <section className="review-strip" aria-label="Receipts that need a look">
      <p>
        <strong>{count === 1 ? '1 receipt needs a look.' : `${count} receipts need a look.`}</strong> We couldn’t read part of{' '}
        {count === 1 ? 'it' : 'them'}, so these totals may be off until you check.
      </p>
      <button type="button" className="button" onClick={onReview}>
        Review
        <ArrowRight {...ICON} />
      </button>
    </section>
  )
}
