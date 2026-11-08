import { ChevronRight } from 'lucide-react'
import { addMonths, currentMonth, formatMoney, formatShortMonth, formatWholeMoney } from './format.js'
import { categoryRows, categorySizes, daysElapsed, merchantTotals, receiptsFor, sumOf, WEEKDAYS, weekdayTotals } from './stats.js'

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true }
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const catVar = (c) => ({ '--cat': `var(--${(c ?? 'Other').toLowerCase()})` })

function Card({ id, title, children }) {
  return (
    <section className="panel finding" aria-labelledby={id}>
      <h2 id={id} className="finding-title">{title}</h2>
      {children}
    </section>
  )
}

function Delta({ amount }) {
  if (amount == null) return <span className="delta-text">—</span>
  if (Math.abs(amount) < 0.5) return <span className="delta-text">same</span>
  return (
    <span className={`delta-text ${amount < 0 ? 'is-down' : 'is-up'}`}>
      {amount < 0 ? '↓' : '↑'} {formatWholeMoney(Math.abs(amount))}
    </span>
  )
}

// ---------- Where it went: click a category to focus the page on it ----------

function WhereItWent({ month, receipts, category, onCategory }) {
  const rows = categoryRows(receipts, month)
  const all = sumOf(rows)
  const max = rows[0]?.total ?? 1
  const partial = month === currentMonth()
  const prevShort = formatShortMonth(addMonths(month, -1))
  const vsLabel = partial ? `vs ${prevShort} 1–${daysElapsed(month)}` : `vs ${prevShort}`

  let title = 'No spending recorded.'
  if (rows.length === 1) title = <>{rows[0].category} is all of it.</>
  else if (rows.length > 1) {
    title = (
      <>
        {rows[0].category} {partial ? 'is' : 'was'} <strong>{pct(rows[0].total, all)}%</strong> of it{partial ? ' so far' : ''}, then{' '}
        {rows[1].category} at <strong>{pct(rows[1].total, all)}%</strong>.
      </>
    )
  }

  return (
    <Card id="f-categories" title={title}>
      <div className="grid-head cat-grid" aria-hidden="true">
        <span>Category</span>
        <span />
        <span className="right">Spent</span>
        <span className="right">Share</span>
        <span className="right">{vsLabel}</span>
      </div>
      {rows.map((r) => {
        const on = category === r.category
        return (
          <button
            key={r.category}
            type="button"
            className="grid-row cat-grid"
            aria-pressed={on}
            aria-label={`${r.category}: ${formatMoney(r.total)}, ${pct(r.total, all)}% of the month`}
            style={catVar(r.category)}
            onClick={() => onCategory(on ? null : r.category)}
          >
            <span className="cat-name"><span className="swatch-dot" />{r.category}</span>
            <span className="cat-track"><span className="cat-fill" style={{ transform: `scaleX(${r.total / max})` }} /></span>
            <span className="num mono">{formatMoney(r.total)}</span>
            <span className="num mono soft">{pct(r.total, all)}%</span>
            <span className="num mono small"><Delta amount={r.prev > 0 ? r.change : null} /></span>
          </button>
        )
      })}
    </Card>
  )
}

// ---------- Top merchants: click one to see its receipts ----------

function TopMerchants({ month, receipts, category, query, onOpenMerchant }) {
  const list = receiptsFor(receipts, month, { category, query })
  const top = merchantTotals(list).slice(0, 5)
  const shown = sumOf(top)
  const total = sumOf(receiptsFor(receipts, month, { category }))
  const first = top[0]
  const title = first ? (
    <>
      {first.name} took the most: <strong>{formatMoney(first.total)}</strong> over{' '}
      <strong>{first.visits === 1 ? '1 visit' : `${first.visits} visits`}</strong>.
    </>
  ) : query ? (
    <>No merchants match “{query}”.</>
  ) : (
    <>No merchants this month.</>
  )

  return (
    <Card id="f-merchants" title={title}>
      {top.length > 0 && (
        <>
          <div className="grid-head merch-grid" aria-hidden="true">
            <span>Merchant</span>
            <span className="right">Visits</span>
            <span className="right">Per visit</span>
            <span className="right">Total</span>
            <span />
          </div>
          {top.map((m) => (
            <button
              key={m.name}
              type="button"
              className="grid-row merch-grid"
              aria-label={`See ${m.name} receipts: ${m.visits} visits, ${formatMoney(m.total)}`}
              style={catVar(m.category)}
              onClick={() => onOpenMerchant(m.name)}
            >
              <span className="cat-name"><span className="swatch-dot small" /><span className="truncate">{m.name}</span></span>
              <span className="num mono">{m.visits}</span>
              <span className="num mono soft">{formatMoney(m.total / m.visits)}</span>
              <span className="num mono">{formatMoney(m.total)}</span>
              <ChevronRight {...ICON} className="row-arrow" />
            </button>
          ))}
          {pct(shown, total) < 100 && (
            <p className="finding-foot">
              These {top.length} are <span className="mono">{formatMoney(shown)}</span> of <span className="mono">{formatMoney(total)}</span>,{' '}
              {pct(shown, total)}% of the month.
            </p>
          )}
        </>
      )}
    </Card>
  )
}

// ---------- By day of the week: click a day to find it in the day-by-day chart ----------

function Weekdays({ month, receipts, category, weekday, onWeekday }) {
  const days = weekdayTotals(receiptsFor(receipts, month, { category }))
  const all = sumOf(days)
  const max = Math.max(...days.map((d) => d.total), 1)
  const top = days.indexOf(days.reduce((a, b) => (b.total > a.total ? b : a), days[0]))
  const title = all > 0 ? (
    <>
      {WEEKDAYS[top]}s are your biggest day: <strong>{formatWholeMoney(days[top].total)}</strong>, or{' '}
      <strong>{pct(days[top].total, all)}%</strong> of the month.
    </>
  ) : (
    <>No spending by day yet.</>
  )

  return (
    <Card id="f-weekdays" title={title}>
      <div className="week">
        {days.map((d, i) => {
          const on = weekday === i
          const ink = weekday != null ? on : i === top && all > 0
          return (
            <button
              key={d.weekday}
              type="button"
              className="week-col"
              aria-pressed={on}
              aria-label={`${d.weekday}: ${formatMoney(d.total)} over ${d.visits} receipts`}
              onClick={() => onWeekday(on ? null : i)}
            >
              <span className="week-amount mono">{ink ? formatWholeMoney(d.total) : ''}</span>
              <span className={`week-bar${ink ? ' is-ink' : ''}`} style={{ height: Math.max(3, (d.total / max) * 140) }} />
              <span className={`week-label${ink ? ' is-ink' : ''}`}>{d.weekday.slice(0, 3)}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// ---------- A typical receipt ----------

function TypicalReceipt({ month, receipts, category }) {
  const sizes = categorySizes(receiptsFor(receipts, month))
  const lead = sizes.find((s) => s.category === category) ?? sizes[0]
  const title = lead ? (
    <>
      A typical {lead.category} receipt is <strong>{formatMoney(lead.median)}</strong>, across{' '}
      <strong>{lead.count}</strong> this month.
    </>
  ) : (
    <>No receipts this month.</>
  )

  return (
    <Card id="f-typical" title={title}>
      {sizes.length > 0 && (
        <table className="typical">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col" className="right">Receipts</th>
              <th scope="col" className="right">Typical</th>
              <th scope="col" className="right">Average</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((s) => (
              <tr key={s.category} className={category && category !== s.category ? 'is-faded' : undefined} style={catVar(s.category)}>
                <th scope="row"><span className="cat-name"><span className="swatch-dot small" />{s.category}</span></th>
                <td className="num mono">{s.count}</td>
                <td className="num mono">{formatMoney(s.median)}</td>
                <td className="num mono soft">{formatMoney(s.average)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

export default function Findings(props) {
  return (
    <div className="findings">
      <WhereItWent {...props} />
      <TopMerchants {...props} />
      <Weekdays {...props} />
      <TypicalReceipt {...props} />
    </div>
  )
}

export function YearSoFar({ year, savings }) {
  if (!savings) return null
  return (
    <p className="year-line">
      <strong>{year} so far:</strong> discounts saved you <span className="mono">{formatMoney(savings.discountTotal)}</span>, and you
      paid <span className="mono">{formatMoney(savings.taxTotal)}</span> in sales tax across{' '}
      <span className="mono">{savings.receiptCount}</span> receipts.
    </p>
  )
}
