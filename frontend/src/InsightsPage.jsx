import { useEffect, useState } from 'react'
import { api } from './api.js'
import { addMonths, currentMonth, formatMoney, formatMonth, formatShortMonth } from './format.js'

// Spending stats for one month, drawn from the /api/insights endpoints.
// Charts are plain HTML and CSS so the frontend stays dependency-free.

function useInsights(month) {
  const [state, setState] = useState({ data: null, error: '' })

  useEffect(() => {
    let cancelled = false
    const year = Number(month.slice(0, 4))
    setState((prev) => ({ data: prev.data, error: '' }))
    Promise.all([
      api(`/insights/categories?month=${month}`),
      api(`/insights/trend?month=${month}&months=6`),
      api(`/insights/merchants?month=${month}&limit=5`),
      api(`/insights/weekdays?month=${month}`),
      api(`/insights/receipt-size?month=${month}`),
      api(`/insights/savings?year=${year}`),
    ])
      .then(([categories, trend, merchants, weekdays, receiptSize, savings]) => {
        if (!cancelled) setState({ data: { categories, trend, merchants, weekdays, receiptSize, savings }, error: '' })
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, error: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [month])

  return state
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0)
}

// "+$62" / "-$18" with the sign always shown
function formatChange(amount) {
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : ''
  return `${sign}${formatMoney(Math.abs(amount))}`
}

function percent(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

function Headline({ month, total, prevTotal }) {
  const prev = formatShortMonth(addMonths(month, -1))
  const diff = total - prevTotal

  let compare = `Nothing recorded in ${prev} to compare with.`
  if (prevTotal > 0) {
    if (Math.abs(diff) < 0.005) compare = `Exactly the same as ${prev}.`
    else compare = `${formatMoney(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than ${prev}.`
  }

  // Mid-month, compare how far through the month we are with how much of last month's total is spent
  let pace = null
  if (month === currentMonth() && prevTotal > 0) {
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const timePct = percent(now.getDate(), daysInMonth)
    const spendPct = percent(total, prevTotal)
    pace = (
      <p className={spendPct > timePct ? 'pace warn-text' : 'pace good-text'}>
        You’re {timePct}% through {formatMonth(month).split(' ')[0]} and have spent {spendPct}% of {prev}’s total.
      </p>
    )
  }

  return (
    <section className="summary insight-hero">
      <div>
        <p className="summary-total">{formatMoney(total)}</p>
        <p className="muted">spent in {formatMonth(month)}</p>
      </div>
      <div className="hero-notes">
        <p>{compare}</p>
        {pace}
      </div>
    </section>
  )
}

function CategoryBreakdown({ month, categories }) {
  const current = categories.filter((c) => c.total > 0)
  if (current.length === 0) return null
  const max = Math.max(...current.map((c) => c.total))
  const prev = formatShortMonth(addMonths(month, -1))
  const mover = [...categories].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0]

  return (
    <section className="panel">
      <h2>Where it went</h2>
      {mover && Math.abs(mover.change) >= 1 && (
        <p className="panel-lead">
          {mover.category} moved the most: {formatChange(mover.change)} vs {prev}.
        </p>
      )}
      <ul className="bar-list">
        {current.map((c) => (
          <li key={c.category}>
            <span className="bar-label">
              <span className="swatch" data-category={c.category} />
              {c.category}
            </span>
            <span className="bar-track">
              <span className="bar-fill" data-category={c.category} style={{ width: `${(c.total / max) * 100}%` }} />
            </span>
            <span className="num">{formatMoney(c.total)}</span>
            <span className={`num change ${c.change > 0 ? 'up' : c.change < 0 ? 'down' : ''}`}>
              {c.prevTotal > 0 || c.change !== 0 ? formatChange(c.change) : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Same stacking order every month, so a color sits at the same height across the bars
const CATEGORY_ORDER = ['Groceries', 'Dining', 'Shopping', 'Transportation', 'Travel', 'Health', 'Entertainment', 'Other']
const orderOf = (category) => {
  const i = CATEGORY_ORDER.indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

function Trend({ month, trend }) {
  const max = Math.max(...trend.map((m) => m.total), 1)
  const withSpend = trend.filter((m) => m.total > 0)
  if (withSpend.length < 2) return null
  const present = [...new Set(trend.flatMap((m) => Object.keys(m.byCategory)))].sort((a, b) => orderOf(a) - orderOf(b))

  return (
    <section className="panel">
      <h2>Last six months</h2>
      <div className="trend" role="img" aria-label={`Monthly spending, ${trend.map((m) => `${formatShortMonth(m.month)} ${formatMoney(m.total)}`).join(', ')}`}>
        {trend.map((m) => {
          const categories = Object.entries(m.byCategory).sort((a, b) => orderOf(a[0]) - orderOf(b[0]))
          return (
            <div key={m.month} className={`trend-col${m.month === month ? ' is-current' : ''}`}>
              <span className="trend-total">{m.total > 0 ? formatMoney(Math.round(m.total)).replace('.00', '') : ''}</span>
              <span className="trend-stack" style={{ height: `${(m.total / max) * 100}%` }}>
                {categories.map(([category, amount]) => (
                  <span key={category} data-category={category} style={{ flexGrow: amount }} title={`${category}: ${formatMoney(amount)}`} />
                ))}
              </span>
              <span className="trend-month">{formatShortMonth(m.month)}</span>
            </div>
          )
        })}
      </div>
      <ul className="split-legend">
        {present.map((category) => (
          <li key={category}>
            <span className="swatch" data-category={category} />
            {category}
          </li>
        ))}
      </ul>
    </section>
  )
}

function TopMerchants({ merchants }) {
  if (merchants.length === 0) return null
  return (
    <section className="panel">
      <h2>Top merchants</h2>
      <ol className="merchant-list">
        {merchants.map((m) => (
          <li key={m.merchantKey}>
            <span>
              <span className="merchant-name">{m.name ?? m.merchantKey}</span>
              <span className="note">
                {m.visits} visit{m.visits === 1 ? '' : 's'}
                {m.visits > 1 && <> · about {formatMoney(m.avgPerVisit)} each</>}
              </span>
            </span>
            <span className="num">{formatMoney(m.total)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Weekdays({ weekdays }) {
  const max = Math.max(...weekdays.map((d) => d.total), 0)
  if (max === 0) return null
  const top = weekdays.find((d) => d.total === max)

  return (
    <section className="panel">
      <h2>By day of the week</h2>
      <p className="panel-lead">{top.weekday}s are your biggest day.</p>
      <div className="weekdays" role="img" aria-label={weekdays.map((d) => `${d.weekday} ${formatMoney(d.total)}`).join(', ')}>
        {weekdays.map((d) => (
          <div key={d.weekday} className={`weekday${d.total === max ? ' is-top' : ''}`} title={`${formatMoney(d.total)} across ${d.visits} receipt${d.visits === 1 ? '' : 's'}`}>
            <span className="weekday-bar" style={{ height: `${(d.total / max) * 100}%` }} />
            <span className="weekday-name">{d.weekday.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ReceiptSize({ sizes }) {
  if (sizes.length === 0) return null
  return (
    <section className="panel">
      <h2>A typical receipt</h2>
      <ul className="size-list">
        {sizes.map((s) => (
          <li key={s.category}>
            <span className="bar-label">
              <span className="swatch" data-category={s.category} />
              {s.category}
            </span>
            <span className="num">{formatMoney(s.median)}</span>
            <span className="note num">{s.count} receipt{s.count === 1 ? '' : 's'}</span>
          </li>
        ))}
      </ul>
      <p className="hint">Middle value per category, so one big trip doesn’t skew it.</p>
    </section>
  )
}

function Savings({ year, savings }) {
  if (savings.receiptCount === 0) return null
  return (
    <section className="panel savings">
      <h2>{year} so far</h2>
      <div className="savings-row">
        <div>
          <p className="savings-figure good-text">{formatMoney(savings.discountTotal)}</p>
          <p className="muted">saved with discounts</p>
        </div>
        <div>
          <p className="savings-figure">{formatMoney(savings.taxTotal)}</p>
          <p className="muted">paid in tax</p>
        </div>
        <div>
          <p className="savings-figure">{savings.receiptCount}</p>
          <p className="muted">receipts counted</p>
        </div>
      </div>
    </section>
  )
}

export default function InsightsPage({ onShowReceipts }) {
  const [month, setMonth] = useState(currentMonth)
  const { data, error } = useInsights(month)

  const total = data ? sum(data.categories, 'total') : 0
  const prevTotal = data ? sum(data.categories, 'prevTotal') : 0
  const isEmpty = data && total === 0

  return (
    <>
      <div className="month-bar">
        <div className="month-nav">
          <h1>{formatMonth(month)}</h1>
          <button type="button" className="step" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            ‹
          </button>
          <button
            type="button"
            className="step"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={month >= currentMonth()}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}

      {isEmpty && (
        <p className="empty">
          No spending recorded in {formatMonth(month)}.{' '}
          <button type="button" className="link" onClick={onShowReceipts}>Add a receipt</button>
        </p>
      )}

      {data && !isEmpty && (
        <>
          <Headline month={month} total={total} prevTotal={prevTotal} />
          <CategoryBreakdown month={month} categories={data.categories} />
          <Trend month={month} trend={data.trend} />
          <div className="panel-grid">
            <TopMerchants merchants={data.merchants} />
            <Weekdays weekdays={data.weekdays} />
          </div>
          <ReceiptSize sizes={data.receiptSize} />
          <Savings year={month.slice(0, 4)} savings={data.savings} />
        </>
      )}
    </>
  )
}
