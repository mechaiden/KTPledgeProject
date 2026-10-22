import { formatMoney } from './format.js'

export default function ReviewList({ receipts, onSelect }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>Needs review {receipts.length > 0 && <span className="count">{receipts.length}</span>}</h2>
      </div>
      {receipts.length === 0 ? (
        <p className="empty-row">All caught up ✓</p>
      ) : (
        <ul className="review-list">
          {receipts.map((r) => (
            <li key={r.id}>
              <button className="review-item" onClick={() => onSelect(r.id)}>
                <span className="review-icon">⚠</span>
                <span className="review-text">
                  <span className="merchant">{r.merchant}</span>
                  <span className="review-reason">{r.reviewReason}</span>
                </span>
                <span className="category-amount">{formatMoney(r.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
