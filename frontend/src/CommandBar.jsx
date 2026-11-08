import { useRef } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { currentMonth, formatMonth } from './format.js'
import { CATEGORIES, useFilterKeys } from './filters.js'

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true }

function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>
}

export default function CommandBar({ month, onStep, category, onCategory, query, onQuery, onClear }) {
  const searchRef = useRef(null)
  useFilterKeys({ onStep, onCategory, onClear, searchRef })
  const atLatest = month >= currentMonth()

  return (
    <section className="command-bar" aria-label="Filters">
      <div className="command-row">
        <div className="command-month">
          <button type="button" className="icon-button" onClick={() => onStep(-1)} aria-label="Previous month" aria-keyshortcuts="ArrowLeft">
            <ChevronLeft {...ICON} />
          </button>
          <span className="command-month-label" aria-live="polite">{formatMonth(month)}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => onStep(1)}
            disabled={atLatest}
            aria-label="Next month"
            aria-keyshortcuts="ArrowRight"
          >
            <ChevronRight {...ICON} />
          </button>
        </div>

        <label className="command-search">
          <Search {...ICON} />
          <span className="sr-only">Filter by merchant</span>
          <input
            ref={searchRef}
            id="insights-search"
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Filter by merchant"
            aria-keyshortcuts="/"
            autoComplete="off"
          />
          <Kbd>/</Kbd>
        </label>

        <div className="command-keys mono" aria-hidden="true">
          <span><Kbd>←</Kbd> <Kbd>→</Kbd> month</span>
          <span><Kbd>1</Kbd>–<Kbd>8</Kbd> category</span>
          <span><Kbd>Esc</Kbd> clear</span>
        </div>
      </div>

      <div className="command-chips" role="toolbar" aria-label="Category filter">
        {[null, ...CATEGORIES].map((c, i) => {
          const on = category === c
          return (
            <button
              key={c ?? 'all'}
              type="button"
              className={`chip${c ? '' : ' chip-all'}`}
              aria-pressed={on}
              aria-keyshortcuts={String(i)}
              style={c ? { '--cat': `var(--${c.toLowerCase()})` } : undefined}
              onClick={() => onCategory(c)}
            >
              {c && <span className="chip-dot" aria-hidden="true" />}
              {c ?? 'All'}
            </button>
          )
        })}
      </div>
    </section>
  )
}
