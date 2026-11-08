import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { api } from './api.js'
import CommandBar from './CommandBar.jsx'
import Findings, { YearSoFar } from './Findings.jsx'
import Hero, { ReviewStrip } from './Hero.jsx'
import MonthlyChart from './MonthlyChart.jsx'
import { addMonths, currentMonth, formatMonth, formatMonthName } from './format.js'

// Insights for one month. Month totals come from the trend endpoint; everything that has to
// follow the category filter or the merchant search is computed from the receipt list (stats.js).

const ENDPOINTS = {
  // A fixed six-month window ending this month, so the chart doesn't shift on every click;
  // it only moves when you step back past its left edge
  trend: (month) => `/insights/trend?month=${month >= addMonths(currentMonth(), -5) ? currentMonth() : month}&months=6`,
  savings: (month) => `/insights/savings?year=${month.slice(0, 4)}`,
}
const KEYS = Object.keys(ENDPOINTS)

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true }

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
  return { data: values, errors, retry }
}

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

export default function InsightsPage({ summary, receipts, onReview, onAddReceipts, onOpenMerchant }) {
  const [month, setMonth] = useState(currentMonth)
  // Filters shared by every section: one category at a time, plus a merchant search
  const [category, setCategory] = useState(null)
  const [query, setQuery] = useState('')
  // A weekday picked in the findings, highlighted in the day-by-day chart (Monday = 0)
  const [weekday, setWeekday] = useState(null)
  const { data, errors, retry } = useInsights(month)

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
    setWeekday(null)
  }, [])

  const reviewCount = summary?.reviewCount ?? 0

  if (summary?.receiptCount === 0) {
    return (
      <div className="insights">
        <NoReceipts onAddReceipts={onAddReceipts} />
      </div>
    )
  }

  const monthRow = data.trend?.find((row) => row.month === month)
  const monthIsEmpty = data.trend && !errors.trend && (monthRow?.total ?? 0) === 0
  const shared = { month, receipts, category, query, weekday, onCategory: setCategory, onWeekday: setWeekday, onOpenMerchant }

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
            error={errors.trend}
            onRetry={() => retry('trend')}
            onSelectMonth={changeMonth}
          />
          <ReviewStrip count={reviewCount} onReview={onReview} />
          <MonthlyChart
            trend={data.trend}
            month={month}
            category={category}
            receipts={receipts}
            weekday={weekday}
            error={errors.trend}
            onRetry={() => retry('trend')}
            onSelectMonth={changeMonth}
          />
          {receipts && <Findings {...shared} />}
          <YearSoFar year={month.slice(0, 4)} savings={data.savings} />
        </>
      )}
    </div>
  )
}
