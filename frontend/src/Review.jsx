import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, CircleCheck, X } from 'lucide-react'
import { api } from './api.js'
import { CATEGORIES } from './filters.js'
import { formatMoney } from './format.js'

// Full-screen review. Opened as a queue (every receipt that needs a look, one at a time)
// or for a single receipt. Only the fields the reader flagged are editable on a flagged
// receipt; a receipt that couldn't be read at all, or one that's already filed, is fully editable.

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true }

const toInput = (n) => (n == null ? '' : n.toFixed(2))
const toNumber = (s) => {
  const n = Number.parseFloat(String(s).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

function longDate(iso) {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// Which fields need the person, read from what the backend could and couldn't parse
function flagsFor(r) {
  if (r.status !== 'review') return { all: true }
  const reason = r.reviewReason ?? ''
  const items = (r.items ?? []).map((i) => i.total == null)
  const unreadable = !r.items?.length && r.total == null
  if (unreadable || /fill it in/i.test(reason)) return { all: true }
  const mismatch = /add up/i.test(reason)
  return { all: false, items: items.map((missing) => missing || mismatch), total: r.total == null || mismatch }
}

function draftFor(r) {
  return {
    merchant: r.merchant ?? '',
    date: r.date ?? '',
    category: r.category ?? 'Other',
    tax: toInput(r.tax),
    discount: toInput(r.discount),
    total: toInput(r.total),
    items: (r.items ?? []).map((i) => ({ name: i.name ?? '', qty: i.qty ?? null, total: toInput(i.total) })),
  }
}

function ReadOut({ receipt, draft, flags }) {
  return (
    <div className="readout mono" aria-label="What we read from the photo">
      <div className="readout-head">{(receipt.merchant ?? 'Unknown').toUpperCase()}</div>
      <div className="readout-date">{longDate(receipt.date)}</div>
      <div className="readout-rule" />
      {draft.items.length === 0 && <div className="readout-line">No line items read</div>}
      {draft.items.map((it, i) => (
        <div key={i} className={`readout-line${!flags.all && flags.items[i] ? ' is-flagged' : ''}`}>
          <span>{it.name || '—'}</span>
          <span>{receipt.items[i]?.total != null ? receipt.items[i].total.toFixed(2) : '?'}</span>
        </div>
      ))}
      <div className="readout-rule" />
      <div className="readout-line"><span>TAX</span><span>{receipt.tax != null ? receipt.tax.toFixed(2) : '?'}</span></div>
      <div className={`readout-line readout-total${!flags.all && flags.total ? ' is-flagged' : ''}`}>
        <span>TOTAL</span>
        <span>{receipt.total != null ? receipt.total.toFixed(2) : '?'}</span>
      </div>
    </div>
  )
}

function Editor({ receipt, inQueue, onConfirm, onSkip, onDelete }) {
  const [draft, setDraft] = useState(() => draftFor(receipt))
  const [zoomed, setZoomed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const flags = flagsFor(receipt)
  const firstField = useRef(null)

  useEffect(() => {
    firstField.current?.focus()
  }, [])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const setItem = (i, value) => setDraft((d) => ({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, total: value } : it)) }))

  const itemValues = draft.items.map((it) => toNumber(it.total))
  const itemSum = itemValues.reduce((t, v) => t + (v ?? 0), 0)
  const tax = toNumber(draft.tax) ?? 0
  const discount = toNumber(draft.discount) ?? 0
  const total = toNumber(draft.total)
  const expected = itemSum + tax - discount
  const complete = itemValues.every((v) => v != null) && total != null && draft.merchant.trim() && draft.date
  const matches = draft.items.length === 0 || (total != null && Math.abs(total - expected) < 0.01)
  const canSave = complete && matches && !saving

  let check = '✓ Items and tax match the total'
  if (!complete) check = 'Fill in the highlighted field'
  else if (!matches) check = `Off by ${formatMoney(Math.abs(total - expected))} · items + tax = ${formatMoney(expected)}`

  const categoryChanged = draft.category !== (receipt.category ?? 'Other')
  const editable = (flagged) => flags.all || flagged

  async function save() {
    setSaving(true)
    setError('')
    try {
      const updated = await api(`/receipts/${receipt.id}`, {
        method: 'PATCH',
        body: {
          merchant: draft.merchant.trim(),
          date: draft.date,
          category: draft.category,
          subtotal: draft.items.length ? Math.round(itemSum * 100) / 100 : null,
          discount: toNumber(draft.discount),
          tax: toNumber(draft.tax),
          total,
          items: draft.items.map((it, i) => ({ name: it.name, qty: it.qty, total: itemValues[i] })),
        },
      })
      onConfirm(updated)
    } catch (err) {
      setError(err.message) // keep the edits; show why by the button
      setSaving(false)
    }
  }

  let reason = receipt.reviewReason
  if (reason && !flags.all) reason = `${reason}. The spot is outlined on the receipt and the field that needs you is highlighted.`
  else if (reason) reason = `${reason}.`.replace(/\.\.$/, '.')

  const firstFlag = flags.all ? -1 : flags.items.indexOf(true)

  return (
    <div className="review-body">
      <div className="review-photo">
        <div className="review-photo-bar">
          <span>Original photo</span>
          <button type="button" className="button small-button" aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>
            {zoomed ? 'Fit' : 'Zoom'}
          </button>
        </div>
        <div className={`review-photo-frame${zoomed ? ' is-zoomed' : ''}`}>
          {imageFailed ? (
            <a className="link" href={receipt.imageUrl} target="_blank" rel="noreferrer">Open the original file</a>
          ) : (
            <img src={receipt.imageUrl} alt={`Photo of the ${receipt.merchant ?? ''} receipt`} onError={() => setImageFailed(true)} />
          )}
        </div>
        <ReadOut receipt={receipt} draft={draft} flags={flags} />
      </div>

      <form
        className="review-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) save()
        }}
      >
        {reason && <div className="flag-callout" role="status">{reason}</div>}

        {flags.all ? (
          <div className="review-fields">
            <label className="field">
              Merchant
              <input ref={firstField} value={draft.merchant} onChange={(e) => set({ merchant: e.target.value })} required />
            </label>
            <label className="field">
              Date
              <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} required />
            </label>
          </div>
        ) : (
          <div>
            <div className="review-merchant">{receipt.merchant}</div>
            <div className="review-date mono">{longDate(receipt.date)}</div>
          </div>
        )}

        <label className="field review-category">
          Category
          <select value={draft.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {categoryChanged && (
          <p className="learned" role="status">
            <Check {...ICON} />
            Got it. Future {draft.merchant || 'these'} receipts will go to {draft.category}.
          </p>
        )}

        {draft.items.length > 0 && (
          <div className="review-items">
            <div className="review-items-head" aria-hidden="true"><span>Item</span><span className="right">Price</span></div>
            {draft.items.map((it, i) => {
              const open = editable(!flags.all && flags.items[i])
              const flagged = !flags.all && flags.items[i]
              return (
                <div key={i} className="review-item">
                  <span>{it.name || 'Unnamed item'}</span>
                  <input
                    ref={i === firstFlag ? firstField : undefined}
                    className={`mono money-input${flagged ? ' is-flagged' : ''}`}
                    inputMode="decimal"
                    aria-label={`Price of ${it.name || 'item'}`}
                    value={it.total}
                    readOnly={!open}
                    onChange={(e) => setItem(i, e.target.value)}
                  />
                </div>
              )
            })}
          </div>
        )}

        <div className="review-sums">
          {draft.items.length > 0 && <div className="sum-line"><span>Items</span><span className="mono">{formatMoney(itemSum)}</span></div>}
          {discount > 0 && <div className="sum-line"><span>Discount</span><span className="mono">−{formatMoney(discount)}</span></div>}
          <div className="sum-line"><span>Tax</span><span className="mono">{formatMoney(tax)}</span></div>
          <label className="sum-total">
            Total
            <input
              ref={firstFlag === -1 && !flags.all && flags.total ? firstField : undefined}
              className={`mono money-input${!flags.all && flags.total ? ' is-flagged' : ''}`}
              inputMode="decimal"
              placeholder="0.00"
              value={draft.total}
              readOnly={!editable(flags.total)}
              onChange={(e) => set({ total: e.target.value })}
            />
          </label>
          <p className={`sum-check mono${canSave || (complete && matches) ? ' is-ok' : ''}`} role="status">{check}</p>
        </div>

        <div className="review-actions">
          {receipt.status === 'done' && (
            <button
              type="button"
              className="link danger"
              onClick={() => (confirmDelete ? onDelete(receipt.id) : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Delete for good?' : 'Delete receipt'}
            </button>
          )}
          {error && <p className="error review-error" role="alert">{error}</p>}
          {inQueue && (
            <button type="button" className="button" onClick={onSkip}>Skip</button>
          )}
          <button type="submit" className="button primary" disabled={!canSave}>
            {saving ? 'Saving…' : inQueue ? 'Confirm and next' : receipt.status === 'review' ? 'Confirm and file' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function Review({ receipts, openId, queueMode, onClose, onSaved, onDeleted, filedCount }) {
  // The queue is fixed when review opens, so confirming one doesn't reshuffle the rest
  const [queue] = useState(() =>
    queueMode ? receipts.filter((r) => r.status === 'review').map((r) => r.id) : [openId],
  )
  const [index, setIndex] = useState(() => Math.max(0, queue.indexOf(openId)))
  const [done, setDone] = useState(() => queueMode && queue.length === 0)
  const closeRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const receipt = receipts.find((r) => r.id === queue[index])
  const left = queue.filter((id) => receipts.find((r) => r.id === id)?.status === 'review').length

  function next() {
    // Next one still waiting, after this one, wrapping around
    for (let step = 1; step <= queue.length; step++) {
      const i = (index + step) % queue.length
      if (receipts.find((r) => r.id === queue[i])?.status === 'review') {
        setIndex(i)
        return
      }
    }
    setDone(true)
  }

  function confirm(updated) {
    onSaved(updated)
    if (!queueMode) {
      onClose()
      return
    }
    // `receipts` still has the old status until the parent re-renders, so count this one out
    const stillWaiting = queue.filter((id) => id !== updated.id && receipts.find((r) => r.id === id)?.status === 'review')
    if (!stillWaiting.length) setDone(true)
    else {
      for (let step = 1; step <= queue.length; step++) {
        const i = (index + step) % queue.length
        if (stillWaiting.includes(queue[i])) {
          setIndex(i)
          break
        }
      }
    }
  }

  return (
    <div className="review" role="dialog" aria-modal="true" aria-label="Review receipts">
      <header className="review-head">
        <button ref={closeRef} type="button" className="icon-button review-close" onClick={onClose} aria-label="Close review">
          <X {...ICON} />
        </button>
        <span className="review-title">{queueMode ? 'Review receipts' : receipt?.status === 'review' ? 'Needs a look' : 'Receipt'}</span>
        {queueMode && !done && <span className="review-pos mono">{index + 1} of {queue.length}</span>}
        {queueMode && !done && queue.length > 1 && (
          <div className="review-steps">
            <button type="button" className="icon-button bordered" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="Previous receipt">
              <ChevronLeft {...ICON} />
            </button>
            <button type="button" className="icon-button bordered" onClick={() => setIndex(index + 1)} disabled={index === queue.length - 1} aria-label="Next receipt">
              <ChevronRight {...ICON} />
            </button>
          </div>
        )}
      </header>

      {done || !receipt ? (
        <div className="review-done">
          <CircleCheck size={40} strokeWidth={1.75} aria-hidden="true" />
          <p className="review-done-title">All caught up.</p>
          <p className="review-done-sub">{filedCount} receipts filed. Nothing is waiting on you.</p>
          <button type="button" className="button primary" onClick={onClose}>Back to insights</button>
        </div>
      ) : (
        <Editor
          key={receipt.id}
          receipt={receipt}
          inQueue={queueMode && left > 1}
          onConfirm={confirm}
          onSkip={next}
          onDelete={async (id) => {
            await api(`/receipts/${id}`, { method: 'DELETE' })
            onDeleted(id)
            onClose()
          }}
        />
      )}
    </div>
  )
}
