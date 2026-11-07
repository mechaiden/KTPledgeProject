import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { addMonths, currentMonth, formatDate, formatMoney, formatMonth, monthOf } from './format.js'
import ReceiptEditor from './ReceiptEditor.jsx'
import ReceiptTable from './ReceiptTable.jsx'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const POLL_MS = 3000

function sumTotals(receipts) {
  return receipts.reduce((sum, r) => sum + (r.total ?? 0), 0)
}

function MonthSummary({ receipts, categories }) {
  // Receipts still being read have no total yet, so leave them out
  const counted = receipts.filter((r) => r.status !== 'processing')
  const total = sumTotals(counted)
  const byCategory = categories.map((category) => ({
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

export default function ReceiptsPage({ initialReviewOnly = false, pendingUpload = null, onPendingUploadHandled, onReceiptsChange }) {
  const [receipts, setReceipts] = useState(null) // null while the first load is in flight
  const [categories, setCategories] = useState([])
  const [loadError, setLoadError] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [reviewOnly, setReviewOnly] = useState(initialReviewOnly)
  const [selectedId, setSelectedId] = useState(null)
  const [uploadErrors, setUploadErrors] = useState([])
  const [dragging, setDragging] = useState(false)
  // Uploads that finished reading but are dated in another month, so they've left the current view
  const [filedElsewhere, setFiledElsewhere] = useState([])
  const fileInputRef = useRef(null)
  const uploadingIds = useRef(new Set())

  const refresh = useCallback(
    () =>
      api('/receipts').then((next) => {
        const finished = next.filter((r) => uploadingIds.current.has(r.id) && r.status !== 'processing')
        finished.forEach((r) => uploadingIds.current.delete(r.id))
        // Uploads start out dated today, then move to the date printed on the receipt
        const moved = finished.filter((r) => monthOf(r.date) !== currentMonth())
        if (moved.length) setFiledElsewhere((prev) => [...prev, ...moved])
        setReceipts(next)
      }),
    [],
  )

  // Keep the shell's review badge and Insights in step with this list
  useEffect(() => {
    if (receipts) onReceiptsChange?.(receipts)
  }, [receipts, onReceiptsChange])


  useEffect(() => {
    refresh().catch((err) => setLoadError(err.message))
    api('/categories').then(setCategories).catch((err) => setLoadError(err.message))
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
    if (pendingUpload === 'picker') fileInputRef.current?.click()
    else upload(pendingUpload)
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
  // Drop notices for receipts that were deleted or that the user has already gone to see
  const notices = filedElsewhere.filter(
    (r) => monthOf(r.date) !== month && receipts?.some((existing) => existing.id === r.id),
  )

  function showMonthOf(receipt) {
    setMonth(monthOf(receipt.date))
    setReviewOnly(false)
    setFiledElsewhere((prev) => prev.filter((r) => r.id !== receipt.id))
  }

  let emptyMessage = `No receipts in ${formatMonth(month)}.`
  if (receipts?.length === 0) emptyMessage = 'No receipts yet. Add one to get started.'
  else if (reviewOnly) emptyMessage = 'Nothing to review this month.'

  return (
    <div className="page" onDragOver={handleDragOver}>
      <main className="content">
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

        {receipts === null ? (
          <p className={loadError ? 'error' : 'muted'}>{loadError || 'Loading…'}</p>
        ) : (
          <>
            {monthReceipts.length > 0 && <MonthSummary receipts={monthReceipts} categories={categories} />}

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
          categories={categories}
          onClose={() => setSelectedId(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
