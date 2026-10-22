import { useEffect, useState } from 'react'
import { formatMoney } from './format.js'
import { CATEGORIES } from './mockData.js'

// Number fields are edited as strings so the inputs can be empty
const toInput = (n) => (n == null ? '' : String(n))
const toNumber = (s) => (s === '' ? null : Number(s))

function initialForm(receipt) {
  return {
    merchant: receipt.merchant ?? '',
    date: receipt.date,
    category: receipt.category ?? '',
    items: (receipt.items ?? []).map((item) => ({
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

export default function ReceiptDrawer({ receipt, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => initialForm(receipt))

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
  const hasMissingTotals = form.items.some((item) => item.total === '')
  const doesntAddUp =
    form.items.length > 0 && form.subtotal !== '' && Math.abs(itemsSum - Number(form.subtotal)) > 0.005

  function handleSubmit(e) {
    e.preventDefault()
    onSave({
      ...receipt,
      merchant: form.merchant.trim(),
      date: form.date,
      category: form.category || null,
      items: form.items.map((item) => ({ name: item.name, qty: toNumber(item.qty), total: toNumber(item.total) })),
      subtotal: toNumber(form.subtotal),
      tax: toNumber(form.tax),
      total: toNumber(form.total),
      status: 'done',
      reviewReason: undefined,
    })
  }

  function handleDelete() {
    if (window.confirm(`Delete the receipt from ${receipt.merchant}?`)) onDelete(receipt.id)
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <form
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt from ${receipt.merchant}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header className="drawer-header">
          <h2>{receipt.merchant}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="drawer-body">
          <div className="drawer-image">
            {receipt.imageUrl ? (
              <a href={receipt.imageUrl} target="_blank" rel="noreferrer">
                <img src={receipt.imageUrl} alt={`Receipt from ${receipt.merchant}`} />
              </a>
            ) : (
              <p className="image-placeholder">No image yet</p>
            )}
          </div>

          <div className="drawer-fields">
            {receipt.status === 'review' && receipt.reviewReason && (
              <p className="review-banner">⚠ {receipt.reviewReason}</p>
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
                  <option value="">Choose…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="items">
              <div className="items-header">
                <span>Item</span>
                <span>Qty</span>
                <span className="num">Total</span>
                <span />
              </div>
              {form.items.map((item) => (
                <div key={item.key} className={`item-row${item.total === '' ? ' missing' : ''}`}>
                  <input
                    value={item.name}
                    onChange={(e) => setItem(item.key, 'name', e.target.value)}
                    placeholder="Item name"
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
                    placeholder="⚠ missing"
                    aria-label="Item total"
                  />
                  <button type="button" className="icon-btn" onClick={() => removeItem(item.key)} aria-label="Remove item">
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn-link add-item" onClick={addItem}>+ Add item</button>
            </div>

            {(hasMissingTotals || doesntAddUp) && (
              <p className="mismatch">
                {hasMissingTotals
                  ? 'Some items are missing a total.'
                  : `Items add up to ${formatMoney(itemsSum)}, but the subtotal is ${formatMoney(Number(form.subtotal))}.`}
              </p>
            )}

            <div className="totals">
              <label className="field-inline">
                <span>Subtotal</span>
                <input type="number" step="0.01" className="num" value={form.subtotal} onChange={setField('subtotal')} />
              </label>
              <label className="field-inline">
                <span>Tax</span>
                <input type="number" step="0.01" className="num" value={form.tax} onChange={setField('tax')} />
              </label>
              <label className="field-inline total-line">
                <span>Total</span>
                <input type="number" step="0.01" className="num" value={form.total} onChange={setField('total')} required />
              </label>
            </div>
          </div>
        </div>

        <footer className="drawer-footer">
          <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
          <div className="drawer-footer-right">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save changes ✓</button>
          </div>
        </footer>
      </form>
    </div>
  )
}
