import { useEffect, useState } from 'react'
import { api } from './api.js'
import { CATEGORIES, formatMoney } from './format.js'

// Number inputs are edited as strings so they can be left empty
const toInput = (n) => (n == null ? '' : String(n))
const toNumber = (s) => (s === '' ? null : Number(s))

function toForm(receipt) {
  return {
    merchant: receipt.merchant ?? '',
    date: receipt.date ?? '',
    category: receipt.category ?? '',
    items: receipt.items.map((item) => ({
      key: crypto.randomUUID(),
      name: item.name,
      qty: toInput(item.qty),
      total: toInput(item.total),
    })),
    subtotal: toInput(receipt.subtotal),
    tax: toInput(receipt.tax),
    total: toInput(receipt.total),
  }
}

function fromForm(form) {
  return {
    merchant: form.merchant.trim(),
    date: form.date,
    category: form.category || null,
    items: form.items
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), qty: toNumber(item.qty), total: toNumber(item.total) })),
    subtotal: toNumber(form.subtotal),
    tax: toNumber(form.tax),
    total: toNumber(form.total),
  }
}

export default function ReceiptEditor({ receipt, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(() => toForm(receipt))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function setItem(key, field, value) {
    setForm((f) => ({
      ...f,
      items: f.items.map((item) => (item.key === key ? { ...item, [field]: value } : item)),
    }))
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { key: crypto.randomUUID(), name: '', qty: '1', total: '' }] }))
  }

  function removeItem(key) {
    setForm((f) => ({ ...f, items: f.items.filter((item) => item.key !== key) }))
  }

  const itemsSum = form.items.reduce((sum, item) => sum + (toNumber(item.total) ?? 0), 0)
  const missingPrices = form.items.some((item) => item.total === '')
  const doesntAddUp =
    form.items.length > 0 && form.subtotal !== '' && Math.abs(itemsSum - Number(form.subtotal)) > 0.005

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onSaved(await api(`/receipts/${receipt.id}`, { method: 'PATCH', body: fromForm(form) }))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete the receipt from ${receipt.merchant || 'this merchant'}? This can't be undone.`)) return
    setBusy(true)
    try {
      await api(`/receipts/${receipt.id}`, { method: 'DELETE' })
      onDeleted(receipt.id)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <form
        className="editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="editor-header">
          <h2 id="editor-title">Edit receipt</h2>
          <button type="button" className="link" onClick={onClose}>Close</button>
        </header>

        <div className="editor-body">
          <div className="editor-image">
            {imageFailed ? (
              // PDFs (and anything else an <img> can't show) get a link instead
              <a href={receipt.imageUrl} target="_blank" rel="noreferrer">Open the original file</a>
            ) : (
              <a href={receipt.imageUrl} target="_blank" rel="noreferrer">
                <img src={receipt.imageUrl} alt="Uploaded receipt" onError={() => setImageFailed(true)} />
              </a>
            )}
          </div>

          <div className="editor-fields">
            {receipt.status === 'review' && receipt.reviewReason && (
              <p className="callout">{receipt.reviewReason}. Check the fields below against the image.</p>
            )}

            <label className="field">
              <span>Merchant</span>
              <input value={form.merchant} onChange={setField('merchant')} required />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Date</span>
                <input type="date" value={form.date} onChange={setField('date')} required />
              </label>
              <label className="field">
                <span>Category</span>
                <select value={form.category} onChange={setField('category')}>
                  <option value="">None</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>

            <fieldset className="items">
              <legend>Items</legend>
              {form.items.length > 0 && (
                <div className="item-row item-head" aria-hidden="true">
                  <span>Name</span>
                  <span>Qty</span>
                  <span className="num">Price</span>
                  <span />
                </div>
              )}
              {form.items.map((item) => (
                <div key={item.key} className={`item-row${item.total === '' ? ' missing' : ''}`}>
                  <input
                    value={item.name}
                    onChange={(e) => setItem(item.key, 'name', e.target.value)}
                    aria-label="Item name"
                  />
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.qty}
                    onChange={(e) => setItem(item.key, 'qty', e.target.value)}
                    aria-label="Quantity"
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="num"
                    value={item.total}
                    onChange={(e) => setItem(item.key, 'total', e.target.value)}
                    aria-label="Price"
                  />
                  <button type="button" className="remove" onClick={() => removeItem(item.key)} aria-label={`Remove ${item.name || 'item'}`}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="link" onClick={addItem}>Add an item</button>
              {(missingPrices || doesntAddUp) && (
                <p className="warn-text">
                  {missingPrices
                    ? 'Some items have no price.'
                    : `Items add up to ${formatMoney(itemsSum)}, but the subtotal is ${formatMoney(Number(form.subtotal))}.`}
                </p>
              )}
            </fieldset>

            <div className="totals">
              <label>
                <span>Subtotal</span>
                <input type="number" step="0.01" className="num" value={form.subtotal} onChange={setField('subtotal')} />
              </label>
              <label>
                <span>Tax</span>
                <input type="number" step="0.01" className="num" value={form.tax} onChange={setField('tax')} />
              </label>
              <label className="grand-total">
                <span>Total</span>
                <input type="number" step="0.01" className="num" value={form.total} onChange={setField('total')} required />
              </label>
            </div>
          </div>
        </div>

        <footer className="editor-footer">
          <button type="button" className="button danger" onClick={handleDelete} disabled={busy}>Delete</button>
          {error && <p className="error">{error}</p>}
          <div className="editor-actions">
            <button type="button" className="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="button primary" disabled={busy}>Save</button>
          </div>
        </footer>
      </form>
    </div>
  )
}
