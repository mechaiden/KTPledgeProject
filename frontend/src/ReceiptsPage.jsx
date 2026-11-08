import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { api } from './api.js'
import { addMonths, currentMonth, formatDate, formatMoney, formatMonth, formatMonthName, monthOf } from './format.js'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const POLL_MS = 3000

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true }

const TABS = [
  ['review', 'Needs a look'],
  ['filed', 'Filed'],
  ['all', 'All'],
]

function localIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "Today · Saturday, Nov 8", "Yesterday · Friday, Nov 7", "Thursday, Nov 6"
function dayLabel(iso) {
  if (!iso) return 'No date yet'
  const d = new Date(`${iso}T00:00:00`)
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (iso === localIso(today)) return `Today · ${label}`
  if (iso === localIso(yesterday)) return `Yesterday · ${label}`
  return label
}

function matches(r, q) {
  if (!q) return true
  return (r.merchant ?? '').toLowerCase().includes(q) || (r.items ?? []).some((i) => (i.name ?? '').toLowerCase().includes(q))
}

function StatusChip({ status }) {
  if (status === 'review') return <span className="status is-review"><span className="status-dot" />Needs a look</span>
  return <span className="status is-filed"><span className="status-dot" />Filed</span>
}

function ProcessingRow({ name }) {
  return (
    <div className="rrow is-processing" role="status">
      <span className="rrow-main">
        <span className="rrow-merchant">Reading receipt…</span>
        <span className="rrow-items">{name ? `${name} · usually a few seconds` : 'Usually a few seconds'}</span>
      </span>
      <span className="scan-track" aria-hidden="true"><span className="scan-bar" /></span>
    </div>
  )
}

function ReceiptRow({ receipt: r, onOpen }) {
  const items = (r.items ?? []).map((i) => i.name).filter(Boolean).join(', ')
  return (
    <button type="button" className="rrow" onClick={() => onOpen(r.id)} style={{ '--cat': `var(--${(r.category ?? 'other').toLowerCase()})` }}>
      <span className="rrow-main">
        <span className="rrow-merchant">{r.merchant || 'Unknown merchant'}</span>
        {items && <span className="rrow-items">{items}</span>}
      </span>
      <span className="rrow-cat"><span className="swatch-dot small" />{r.category ?? 'Other'}</span>
      <span><StatusChip status={r.status} /></span>
      <span className="num mono">{formatMoney(r.total)}</span>
    </button>
  )
}

export default function ReceiptsPage({ receipts, initialReviewOnly = false, initialQuery = '', pendingUpload = null, onPendingUploadHandled, onLoad, onReceiptsChange, onOpenReceipt }) {
  // The list lives in App so Review, Insights and the badge all see the same receipts
  const setReceipts = onReceiptsChange
  const [loadError, setLoadError] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [tab, setTab] = useState(initialReviewOnly ? 'review' : 'all')
  const [query, setQuery] = useState(initialQuery)
  const [uploadErrors, setUploadErrors] = useState([])
  const [dragging, setDragging] = useState(false)
  // Uploads that finished reading but are dated in another month, so they've left the current view
  const [filedElsewhere, setFiledElsewhere] = useState([])
  const fileInputRef = useRef(null)
  const uploadingIds = useRef(new Set())
  // File names for uploads still being read, shown on their processing rows
  const [fileNames, setFileNames] = useState({})

  const refresh = useCallback(
    () =>
      // onLoad skips (null) a list that was fetched before a newer local change; the next poll catches up
      onLoad().then((next) => {
        if (!next) return
        const finished = next.filter((r) => uploadingIds.current.has(r.id) && r.status !== 'processing')
        finished.forEach((r) => uploadingIds.current.delete(r.id))
        // Uploads start out dated today, then move to the date printed on the receipt
        const moved = finished.filter((r) => monthOf(r.date) !== currentMonth())
        if (moved.length) setFiledElsewhere((prev) => [...prev, ...moved])
      }),
    [onLoad],
  )

  useEffect(() => {
    refresh().catch((err) => setLoadError(err.message))
  }, [refresh])

  // Keep checking back while anything is still being read
  const hasProcessing = receipts?.some((r) => r.status === 'processing')
  useEffect(() => {
    if (!hasProcessing) return
    const timer = setInterval(() => refresh().catch(() => {}), POLL_MS)
    return () => clearInterval(timer)
  }, [hasProcessing, refresh])

  async function upload(fileList) {
    const files = [...fileList]
    const accepted = files.filter((f) => ACCEPTED_TYPES.includes(f.type))
    const errors = accepted.length < files.length ? ['Only JPG, PNG and PDF files can be added.'] : []

    for (const file of accepted) {
      const form = new FormData()
      form.append('file', file)
      try {
        const created = await api('/receipts', { method: 'POST', body: form })
        uploadingIds.current.add(created.id)
        setFileNames((prev) => ({ ...prev, [created.id]: file.name }))
        setReceipts((prev) => [created, ...prev])
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`)
      }
    }
    setUploadErrors(errors)
    if (accepted.length) {
      // New uploads are dated today until they're read, so jump there to show them
      setMonth(currentMonth())
      setTab('all')
      setQuery('')
    }
  }

  // "Add receipts" (or files dropped on Insights) sends us here with work to do.
  // The ref stops StrictMode's second effect run from uploading the same files twice.
  const handledUpload = useRef(null)
  useEffect(() => {
    if (!pendingUpload) {
      handledUpload.current = null
      return
    }
    if (handledUpload.current === pendingUpload) return
    handledUpload.current = pendingUpload
    upload(pendingUpload)
    onPendingUploadHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- upload only reads setters and refs
  }, [pendingUpload, onPendingUploadHandled])

  function handleDragOver(e) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setDragging(true)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    upload(e.dataTransfer.files)
  }



  // A search looks across every month; otherwise the list is one month
  const q = query.trim().toLowerCase()
  const scope = (receipts ?? []).filter((r) => (q ? true : r.status === 'processing' || monthOf(r.date) === month) && matches(r, q))
  const counts = {
    review: scope.filter((r) => r.status === 'review').length,
    filed: scope.filter((r) => r.status === 'done').length,
    all: scope.length,
  }
  const rows = scope.filter((r) => tab === 'all' || (tab === 'review' ? r.status === 'review' : r.status === 'done'))
  const processing = rows.filter((r) => r.status === 'processing')
  const groups = []
  for (const r of rows.filter((x) => x.status !== 'processing')) {
    const last = groups[groups.length - 1]
    if (last && last.date === r.date) last.items.push(r)
    else groups.push({ date: r.date, items: [r] })
  }
  // Drop notices for receipts that were deleted or that the user has already gone to see
  const notices = filedElsewhere.filter(
    (r) => monthOf(r.date) !== month && receipts?.some((existing) => existing.id === r.id),
  )

  function showMonthOf(receipt) {
    setMonth(monthOf(receipt.date))
    setTab('all')
    setFiledElsewhere((prev) => prev.filter((r) => r.id !== receipt.id))
  }

  let emptyTitle = 'No receipts yet'
  if (q) emptyTitle = `No receipts match “${query.trim()}”`
  else if (tab === 'review') emptyTitle = 'Nothing needs a look.'
  else if (tab === 'filed') emptyTitle = `Nothing filed in ${formatMonthName(month)} yet.`
  else if (receipts?.length) emptyTitle = `No receipts in ${formatMonth(month)}.`

  return (
    <div className="page" onDragOver={handleDragOver}>
      <main className="content receipts">
        <div className="receipts-head">
          <div className="receipts-title">
            <h1>{q ? 'Search results' : `${formatMonthName(month)} receipts`}</h1>
            {!q && (
              <span className="receipts-steps">
                <button type="button" className="icon-button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
                  <ChevronLeft {...ICON} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setMonth(addMonths(month, 1))}
                  disabled={month >= currentMonth()}
                  aria-label="Next month"
                >
                  <ChevronRight {...ICON} />
                </button>
              </span>
            )}
          </div>
          <div className="receipts-tools">
            <label className="command-search receipts-search">
              <Search {...ICON} />
              <span className="sr-only">Search receipts</span>
              <input
                id="receipts-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search merchant or item"
                autoComplete="off"
              />
              {query && (
                <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                  <X {...ICON} />
                </button>
              )}
            </label>
            <button type="button" className="button export-button" disabled title="Coming soon">
              Export for accountant · soon
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            hidden
            onChange={(e) => {
              upload(e.target.files)
              e.target.value = '' // so picking the same file again still fires onChange
            }}
          />
        </div>

        {uploadErrors.length > 0 && (
          <ul className="error-list">
            {uploadErrors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}

        {notices.map((r) => (
          <p key={r.id} className="notice">
            {r.merchant || 'Your receipt'} is dated {formatDate(r.date)}, so it’s filed under {formatMonth(monthOf(r.date))}.{' '}
            <button type="button" className="link" onClick={() => showMonthOf(r)}>
              Go to {formatMonth(monthOf(r.date))}
            </button>
            <button
              type="button"
              className="dismiss"
              onClick={() => setFiledElsewhere((prev) => prev.filter((x) => x.id !== r.id))}
              aria-label="Dismiss"
            >
              ×
            </button>
          </p>
        ))}

        <div className="rtabs" role="tablist" aria-label="Receipt status">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
              {label}
              <span className={`mono rtab-count${key === 'review' && counts.review ? ' is-review' : ''}`}>{counts[key]}</span>
            </button>
          ))}
        </div>

        <div className="rlist">
          {receipts === null ? (
            <p className={`rlist-empty ${loadError ? 'error' : 'muted'}`}>{loadError || 'Loading…'}</p>
          ) : (
            <>
              {processing.map((r) => <ProcessingRow key={r.id} name={fileNames[r.id]} />)}
              {groups.length === 0 && processing.length === 0 && <p className="rlist-empty">{emptyTitle}</p>}
              {groups.map((g) => (
                <div key={g.date ?? 'none'} role="group" aria-label={dayLabel(g.date)}>
                  <div className="rgroup">{dayLabel(g.date)}</div>
                  {g.items.map((r) => <ReceiptRow key={r.id} receipt={r} onOpen={onOpenReceipt} />)}
                </div>
              ))}
            </>
          )}
        </div>
      </main>

      {dragging && (
        <div
          className="drop-overlay"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <p>Drop to add receipts</p>
        </div>
      )}

    </div>
  )
}
