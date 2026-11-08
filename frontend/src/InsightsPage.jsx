import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, RotateCw, Upload } from 'lucide-react'
import { api } from './api.js'
import CommandBar from './CommandBar.jsx'
import Hero, { ReviewStrip } from './Hero.jsx'
import {
  addMonths,
  currentMonth,
  formatMoney,
  formatMonth,
  formatMonthName,
  formatShortMonth,
  formatWholeMoney,
} from './format.js'

// Spending stats for one month, drawn from the /api/insights endpoints.
// Charts are plain HTML and CSS; each card loads and fails on its own.

const ENDPOINTS = {
  categories: (month) => `/insights/categories?month=${month}`,
  // A fixed six-month window ending this month, so the chart doesn't shift on every click;
  // it only moves when you step back past its left edge
  trend: (month) => `/insights/trend?month=${month >= addMonths(currentMonth(), -5) ? currentMonth() : month}&months=6`,
  merchants: (month) => `/insights/merchants?month=${month}&limit=5`,
  weekdays: (month) => `/insights/weekdays?month=${month}`,
  receiptSize: (month) => `/insights/receipt-size?month=${month}`,
  savings: (month) => `/insights/savings?year=${month.slice(0, 4)}`,
}
const KEYS = Object.keys(ENDPOINTS)

// While a new month loads, each card keeps showing the last data it had, so nothing jumps.
function useInsights(month) {
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const latest = useRef({}) // newest request per key; older responses are ignored

  const load = useCallback((keys, forMonth) => {
    for (const key of keys) {
      const token = {}
      latest.current[key] = token
      api(ENDPOINTS[key](forMonth)).then(
        (value) => {
          if (latest.current[key] !== token) return
          setData((prev) => ({ ...prev, [key]: { month: forMonth, value } }))
          setErrors((prev) => ({ ...prev, [key]: '' }))
        },
        (err) => {
          if (latest.current[key] === token) setErrors((prev) => ({ ...prev, [key]: err.message }))
        },
      )
    }
  }, [])

  useEffect(() => {
    load(KEYS, month)
  }, [month, load])

  // Retry drops the error and the stale value so the card shows its loading state
  const retry = useCallback(
    (key) => {
      setErrors((prev) => ({ ...prev, [key]: '' }))
      setData((prev) => ({ ...prev, [key]: undefined }))
      load([key], month)
    },
    [load, month],
  )
  // Plain values for rendering, plus which month each one describes (it lags during a switch)
  const values = Object.fromEntries(Object.entries(data).map(([key, entry]) => [key, entry?.value]))
  return { data: values, dataMonth: data.categories?.month ?? month, errors, retry }
}

// True only once `active` has stayed true for `ms`, so fast loads never flash a skeleton
function useDelayedFlag(active, ms = 300) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setShown(true), ms)
    return () => {
      clearTimeout(timer)
      setShown(false)
    }
  }, [active, ms])
  return active && shown
}

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0)

// Same stacking order every month, so a color sits at the same height across the bars
const CATEGORY_ORDER = ['Groceries', 'Dining', 'Shopping', 'Transportation', 'Travel', 'Health', 'Entertainment', 'Other']
const orderOf = (category) => {
  const i = CATEGORY_ORDER.indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true }

// Up means more spending (worse), down means less (better). Color always comes with an arrow.
function Delta({ amount, children }) {
  if (Math.abs(amount) < 0.5) return <span className="delta">{children ?? 'No change'}</span>
  const up = amount > 0
  return (
    <span className={`delta ${up ? 'is-up' : 'is-down'}`}>
      {up ? <ArrowUp {...ICON} /> : <ArrowDown {...ICON} />}
      {children ?? <span className="mono">{formatWholeMoney(Math.abs(amount))}</span>}
    </span>
  )
}

// ---------- Card frame: title, then content, a skeleton, or an inline error ----------

function Card({ title, lead, className = '', error, onRetry, loading, skeleton, children, ...rest }) {
  const showSkeleton = useDelayedFlag(loading)
  let body = children
  if (error) {
    body = (
      <div className="card-error" role="alert">
        <p>Couldn’t load this. {error}</p>
        <button type="button" className="button" onClick={onRetry}>
          <RotateCw {...ICON} />
          Retry
        </button>
      </div>
    )
  } else if (loading) {
    body = showSkeleton ? skeleton : <div style={{ minHeight: 'var(--skeleton-min, 120px)' }} />
  }

  return (
    <section className={`card ${className}`} aria-busy={loading || undefined} {...rest}>
      {title && (
        <header className="card-head">
          <h2>{title}</h2>
          {lead && !error && !loading && <p className="card-lead">{lead}</p>}
        </header>
      )}
      {body}
    </section>
  )
}

function SkeletonRows({ rows = 5 }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  )
}

function SkeletonChart() {
  return <span className="skeleton skeleton-chart" aria-hidden="true" />
}

// ---------- Month switcher ----------


// ---------- Category bars ----------

function CategoryBars({ month, categories, error, onRetry }) {
  const rows = (categories ?? []).filter((c) => c.total > 0).sort((a, b) => b.total - a.total)
  const max = Math.max(...rows.map((c) => c.total), 1)
  const prevShort = formatShortMonth(addMonths(month, -1))
  const lead =
    month === currentMonth()
      ? `Change is against all of ${formatMonthName(addMonths(month, -1))}.`
      : `Change is against ${formatMonthName(addMonths(month, -1))}.`

  return (
    <Card
      title="Where it went"
      lead={lead}
      className="area-categories"
      error={error}
      onRetry={onRetry}
      loading={!categories && !error}
      skeleton={<SkeletonRows rows={6} />}
    >
      <table className="cat-table">
        <thead className="sr-only">
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Share</th>
            <th scope="col">Spent</th>
            <th scope="col">Change vs {prevShort}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.category}>
              <th scope="row" className="cat-name">
                <span className="cat-label">
                  <span className="swatch" data-category={c.category} />
                  {c.category}
                </span>
              </th>
              <td className="cat-bar" aria-hidden="true">
                <span className="bar-track">
                  <span className="bar-fill" data-category={c.category} style={{ transform: `scaleX(${c.total / max})` }} />
                </span>
              </td>
              <td className="num">{formatMoney(c.total)}</td>
              <td className="num cat-change">
                {c.prevTotal > 0 || c.change !== 0 ? <Delta amount={c.change} /> : <span className="delta">New</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ---------- Six-month trend ----------

function Trend({ month, trend, error, onRetry, onSelectMonth }) {
  const months = trend ?? []
  const max = Math.max(...months.map((m) => m.total), 1)
  const present = [...new Set(months.flatMap((m) => Object.keys(m.byCategory)))].sort((a, b) => orderOf(a) - orderOf(b))

  return (
    <Card
      title="Last six months"
      lead="Pick a month to see it."
      className="area-trend"
      error={error}
      onRetry={onRetry}
      loading={!trend && !error}
      skeleton={<SkeletonChart />}
    >
      <div className="trend">
        {months.map((m) => {
          const segments = Object.entries(m.byCategory).sort((a, b) => orderOf(a[0]) - orderOf(b[0]))
          const current = m.month === month
          return (
            <button
              key={m.month}
              type="button"
              className="trend-col"
              aria-pressed={current}
              aria-label={`${formatMonth(m.month)}: ${formatMoney(m.total)}`}
              onClick={() => onSelectMonth(m.month)}
            >
              <span className="trend-total mono" aria-hidden="true">{m.total > 0 ? formatWholeMoney(m.total) : '–'}</span>
              <span className="trend-stack" style={{ height: `${(m.total / max) * 100}%` }} aria-hidden="true">
                {segments.map(([category, amount]) => (
                  <span key={category} data-category={category} style={{ flexGrow: amount }} />
                ))}
              </span>
              <span className="trend-month" aria-hidden="true">{formatShortMonth(m.month)}</span>
            </button>
          )
        })}
      </div>
      <ul className="legend" aria-label="Colors">
        {present.map((category) => (
          <li key={category}>
            <span className="swatch" data-category={category} />
            {category}
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ---------- Top merchants ----------

function TopMerchants({ merchants, error, onRetry }) {
  return (
    <Card
      title="Top merchants"
      className="area-merchants"
      error={error}
      onRetry={onRetry}
      loading={!merchants && !error}
      skeleton={<SkeletonRows rows={5} />}
    >
      {merchants?.length === 0 ? (
        <p className="card-empty">No merchants this month.</p>
      ) : (
        <table className="ledger-table">
          <thead>
            <tr>
              <th scope="col">Merchant</th>
              <th scope="col" className="num">Visits</th>
              <th scope="col" className="num col-avg">Per visit</th>
              <th scope="col" className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {(merchants ?? []).map((m) => (
              <tr key={m.merchantKey}>
                <th scope="row" className="merchant-cell">{m.name ?? m.merchantKey}</th>
                <td className="num">{m.visits}</td>
                <td className="num col-avg">{formatMoney(m.avgPerVisit)}</td>
                <td className="num">{formatMoney(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

// ---------- Day of week ----------

function topTwoDays(weekdays) {
  return [...weekdays].filter((d) => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 2).map((d) => d.weekday)
}

function Weekdays({ weekdays, error, onRetry }) {
  const days = weekdays ?? []
  const max = Math.max(...days.map((d) => d.total), 1)
  const top = topTwoDays(days)
  const lead =
    top.length === 2 ? `${top[0]}s and ${top[1]}s are your biggest days.` : top.length === 1 ? `${top[0]}s are your biggest day.` : null

  return (
    <Card
      title="By day of the week"
      lead={lead}
      className="area-weekdays"
      error={error}
      onRetry={onRetry}
      loading={!weekdays && !error}
      skeleton={<SkeletonChart />}
    >
      <div className="weekdays" role="img" aria-label={days.map((d) => `${d.weekday} ${formatMoney(d.total)}`).join(', ')}>
        {days.map((d) => {
          const isTop = top.includes(d.weekday)
          return (
            <div key={d.weekday} className={`weekday${isTop ? ' is-top' : ''}`}>
              <span className="weekday-amount mono">{isTop ? formatWholeMoney(d.total) : ''}</span>
              <span className="weekday-bar" style={{ height: `${(d.total / max) * 100}%` }} />
              <span className="weekday-name">{d.weekday.slice(0, 3)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ---------- Typical receipt ----------

function ReceiptSize({ sizes, error, onRetry }) {
  return (
    <Card
      title="A typical receipt"
      lead="The middle value per category, so one big trip doesn’t skew it."
      className="area-size"
      error={error}
      onRetry={onRetry}
      loading={!sizes && !error}
      skeleton={<SkeletonRows rows={4} />}
    >
      <table className="ledger-table">
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col" className="num">Receipts</th>
            <th scope="col" className="num">Typical</th>
          </tr>
        </thead>
        <tbody>
          {[...(sizes ?? [])].sort((a, b) => b.count - a.count).map((s) => (
            <tr key={s.category}>
              <th scope="row" className="cat-name">
                <span className="cat-label">
                  <span className="swatch" data-category={s.category} />
                  {s.category}
                </span>
              </th>
              <td className="num">{s.count}</td>
              <td className="num">{formatMoney(s.median)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ---------- Year so far ----------

function Savings({ year, savings, error, onRetry }) {
  return (
    <Card
      title={`${year} so far`}
      className="area-savings"
      error={error}
      onRetry={onRetry}
      loading={!savings && !error}
      skeleton={<SkeletonRows rows={2} />}
    >
      {savings && (
        <dl className="figures">
          <div>
            <dt>Saved with discounts</dt>
            <dd className="mono">{formatMoney(savings.discountTotal)}</dd>
          </div>
          <div>
            <dt>Paid in tax</dt>
            <dd className="mono">{formatMoney(savings.taxTotal)}</dd>
          </div>
          <div>
            <dt>Receipts counted</dt>
            <dd className="mono">{savings.receiptCount}</dd>
          </div>
        </dl>
      )}
    </Card>
  )
}

// ---------- Needs review ----------


// ---------- Empty states ----------

function DropZone({ onFiles, onBrowse }) {
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      className={`drop-zone${over ? ' is-over' : ''}`}
      onClick={onBrowse}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles(e.dataTransfer.files)
      }}
    >
      <Upload {...ICON} />
      <span>Drop receipt photos here, or click to choose. JPG, PNG or PDF, up to 10 MB.</span>
    </button>
  )
}

function NoReceipts({ onAddReceipts }) {
  return (
    <section className="card empty-card">
      <h2>No receipts yet</h2>
      <p>Add a photo of a receipt and this page fills in with where your money went.</p>
      <button type="button" className="button primary" onClick={() => onAddReceipts()}>
        <Plus {...ICON} />
        Add receipts
      </button>
      <DropZone onFiles={onAddReceipts} onBrowse={() => onAddReceipts()} />
    </section>
  )
}

function EmptyMonth({ month, latestMonth, onSelectMonth }) {
  const canJump = latestMonth && latestMonth !== month
  return (
    <section className="card empty-card">
      <h2>Nothing recorded in {formatMonthName(month)}</h2>
      {canJump ? (
        <p>
          Your latest receipts are from {formatMonth(latestMonth)}.{' '}
          <button type="button" className="link" onClick={() => onSelectMonth(latestMonth)}>
            Go to {formatMonth(latestMonth)}
          </button>
        </p>
      ) : (
        <p>Receipts dated in {formatMonthName(month)} will show up here.</p>
      )}
    </section>
  )
}

// ---------- Page ----------

export default function InsightsPage({ summary, receipts, onReview, onAddReceipts }) {
  const [month, setMonth] = useState(currentMonth)
  // Filters shared by every section: one category at a time, plus a merchant search
  const [category, setCategory] = useState(null)
  const [query, setQuery] = useState('')
  const { data, dataMonth, errors, retry } = useInsights(month)

  const changeMonth = useCallback((next) => {
    if (next <= currentMonth()) setMonth(next)
  }, [])

  // Functional update, so quick repeated presses each count; never past the current month
  const stepMonth = useCallback((n) => {
    setMonth((m) => {
      const next = addMonths(m, n)
      return next <= currentMonth() ? next : m
    })
  }, [])

  const clearFilters = useCallback(() => {
    setCategory(null)
    setQuery('')
  }, [])

  const reviewCount = summary?.reviewCount ?? 0

  if (summary?.receiptCount === 0) {
    return (
      <div className="insights">
        <NoReceipts onAddReceipts={onAddReceipts} />
      </div>
    )
  }

  const monthIsEmpty = data.categories && !errors.categories && sum(data.categories, 'total') === 0
  const bind = (key) => ({ error: errors[key], onRetry: () => retry(key) })

  return (
    <div className="insights">
      <CommandBar
        month={month}
        onStep={stepMonth}
        category={category}
        onCategory={setCategory}
        query={query}
        onQuery={setQuery}
        onClear={clearFilters}
      />

      {monthIsEmpty ? (
        <>
          <EmptyMonth month={month} latestMonth={summary?.latestMonth} onSelectMonth={changeMonth} />
          <ReviewStrip count={reviewCount} onReview={onReview} />
        </>
      ) : (
        <>
          <Hero
            month={month}
            category={category}
            receipts={receipts}
            trend={data.trend}
            onSelectMonth={changeMonth}
            {...bind('trend')}
          />
          <ReviewStrip count={reviewCount} onReview={onReview} />
          <div className="insights-grid">
            <div className="insights-col">
              <CategoryBars month={dataMonth} categories={data.categories} {...bind('categories')} />
              <TopMerchants merchants={data.merchants} {...bind('merchants')} />
              <ReceiptSize sizes={data.receiptSize} {...bind('receiptSize')} />
            </div>
            <div className="insights-col">
              <Trend month={month} trend={data.trend} onSelectMonth={changeMonth} {...bind('trend')} />
              <Weekdays weekdays={data.weekdays} {...bind('weekdays')} />
              <Savings year={month.slice(0, 4)} savings={data.savings} {...bind('savings')} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
