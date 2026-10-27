import { formatDate, formatMoney } from './format.js'

function StatusNote({ receipt }) {
  if (receipt.status === 'processing') return <span className="note">Reading receipt…</span>
  if (receipt.status === 'review') return <span className="note warn">{receipt.reviewReason ?? 'Needs review'}</span>
  return null
}

export default function ReceiptTable({ receipts, onSelect, emptyMessage }) {
  if (receipts.length === 0) return <p className="empty">{emptyMessage}</p>

  return (
    <table className="ledger">
      <thead>
        <tr>
          <th className="col-date">Date</th>
          <th>Merchant</th>
          <th className="col-category">Category</th>
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {receipts.map((r) => {
          const processing = r.status === 'processing'
          return (
            <tr
              key={r.id}
              className={processing ? 'is-processing' : 'is-clickable'}
              onClick={processing ? undefined : () => onSelect(r.id)}
            >
              <td className="col-date">{formatDate(r.date)}</td>
              <td>
                {/* A real button so rows can be opened from the keyboard; its click bubbles up to the row */}
                <button type="button" className="merchant" disabled={processing}>
                  {r.merchant || 'Untitled receipt'}
                </button>
                <StatusNote receipt={r} />
              </td>
              <td className="col-category">{r.category ?? '–'}</td>
              <td className="num">{formatMoney(r.total)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
