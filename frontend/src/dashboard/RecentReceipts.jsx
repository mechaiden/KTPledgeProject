import { formatDate, formatMoney } from './format.js'

const STATUS = {
  done: { label: 'Done', className: 'badge-success' },
  processing: { label: 'Processing…', className: 'badge-muted' },
  review: { label: 'Needs review', className: 'badge-warning' },
}

export default function RecentReceipts({ receipts, reviewOnly, onClearFilter, onSelect }) {
  return (
    <section className="card recent-receipts">
      <div className="card-header">
        <h2>{reviewOnly ? 'Needs review' : 'Recent receipts'}</h2>
        {reviewOnly ? (
          <button className="btn-link" onClick={onClearFilter}>Show all</button>
        ) : (
          <button className="btn-link">View all →</button>
        )}
      </div>

      {receipts.length === 0 ? (
        <p className="empty-row">No receipts this month.</p>
      ) : (
        <div className="table-scroll">
          <table className="receipts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => {
                const status = STATUS[r.status]
                const clickable = r.status !== 'processing'
                return (
                  <tr
                    key={r.id}
                    className={clickable ? 'clickable' : 'is-processing'}
                    onClick={clickable ? () => onSelect(r.id) : undefined}
                  >
                    <td>{formatDate(r.date)}</td>
                    <td className="merchant">{r.merchant}</td>
                    <td>{r.category ?? '—'}</td>
                    <td className="num">{formatMoney(r.total)}</td>
                    <td><span className={`badge ${status.className}`}>{status.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
