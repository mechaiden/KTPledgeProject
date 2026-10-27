import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { useAuth } from './auth.jsx'
import { CATEGORIES, addMonths, currentMonth, formatMoney, formatMonth, monthOf } from './format.js'
import ReceiptEditor from './ReceiptEditor.jsx'
import ReceiptTable from './ReceiptTable.jsx'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const POLL_MS = 3000

function sumTotals(receipts) {
  return receipts.reduce((sum, r) => sum + (r.total ?? 0), 0)
}

function MonthSummary({ receipts }) {
  // Receipts still being read have no total yet, so leave them out
  const counted = receipts.filter((r) => r.status !== 'processing')
  const total = sumTotals(counted)
  const byCategory = CATEGORIES.map((category) => ({
    category,
    total: sumTotals(counted.filter((r) => (r.category ?? 'Other') === category)),
  })).filter((c) => c.total > 0)

  return (
    <section className="summary">
      <div>
        <p className="summary-total">{formatMoney(total)}</p>
        <p className="muted">
          spent across {receipts.length} receipt{receipts.length === 1 ? '' : 's'}
        </p>
      </div>
      {byCategory.length > 0 && (
        <div className="split">
          <div className="split-bar" aria-hidden="true">
            {byCategory.map((c) => (
              <span key={c.category} data-category={c.category} style={{ flexGrow: c.total }} />
            ))}
          </div>
          <ul className="split-legend">
            {byCategory.map((c) => (
              <li key={c.category}>
                <span className="swatch" data-category={c.category} />
                {c.category}
                <span className="num">{formatMoney(c.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default function ReceiptsPage() {
  const { user, logout } = useAuth()
  const [receipts, setReceipts] = useState(null) // null while the first load is in flight
  const [loadError, setLoadError] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [reviewOnly, setReviewOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [uploadErrors, setUploadErrors] = useState([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)

  const refresh = useCallback(() => api('/receipts').then(setReceipts), [])

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
        setReceipts((prev) => [created, ...prev])
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`)
      }
    }
    setUploadErrors(errors)
    if (accepted.length) {
      // New uploads are dated today until they're read, so jump there to show them
      setMonth(currentMonth())
      setReviewOnly(false)
    }
  }

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

  function handleSaved(updated) {
    setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setSelectedId(null)
  }

  function handleDeleted(id) {
    setReceipts((prev) => prev.filter((r) => r.id !== id))
    setSelectedId(null)
  }

  const monthReceipts = (receipts ?? []).filter((r) => monthOf(r.date) === month)
  const needsReview = monthReceipts.filter((r) => r.status === 'review')
  const rows = reviewOnly ? needsReview : monthReceipts
  const selected = receipts?.find((r) => r.id === selectedId) ?? null

  let emptyMessage = `No receipts in ${formatMonth(month)}.`
  if (receipts?.length === 0) emptyMessage = 'No receipts yet. Add one to get started.'
  else if (reviewOnly) emptyMessage = 'Nothing to review this month.'

  return (
    <div className="page" onDragOver={handleDragOver}>
      <header className="topbar">
        <span className="wordmark">KTPledge</span>
        <span className="topbar-user">{user.email}</span>
        <button type="button" className="link" onClick={logout}>Log out</button>
      </header>

      <main className="content">
        <div className="month-bar">
          <div className="month-nav">
            <button type="button" className="step" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
              ‹
            </button>
            <h1>{formatMonth(month)}</h1>
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
          <button type="button" className="button primary" onClick={() => fileInputRef.current?.click()}>
            Add receipt
          </button>
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

        {receipts === null ? (
          <p className={loadError ? 'error' : 'muted'}>{loadError || 'Loading…'}</p>
        ) : (
          <>
            <MonthSummary receipts={monthReceipts} />

            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={!reviewOnly} onClick={() => setReviewOnly(false)}>
                All <span className="tab-count">{monthReceipts.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={reviewOnly} onClick={() => setReviewOnly(true)}>
                Needs review <span className="tab-count">{needsReview.length}</span>
              </button>
            </div>

            <ReceiptTable receipts={rows} onSelect={setSelectedId} emptyMessage={emptyMessage} />
          </>
        )}

        <p className="hint">JPG, PNG or PDF, up to 10 MB. You can also drop files anywhere on the page.</p>
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

      {selected && (
        <ReceiptEditor
          key={selected.id}
          receipt={selected}
          onClose={() => setSelectedId(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
