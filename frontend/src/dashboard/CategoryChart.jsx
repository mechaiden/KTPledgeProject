import { formatMoney } from './format.js'

export default function CategoryChart({ byCategory }) {
  const max = Math.max(...byCategory.map((c) => c.total), 0)

  return (
    <section className="card">
      <div className="card-header">
        <h2>Spending by category</h2>
      </div>
      {byCategory.length === 0 ? (
        <p className="empty-row">Nothing yet this month.</p>
      ) : (
        <ul className="category-bars">
          {byCategory.map((c) => (
            <li key={c.category}>
              <div className="category-row">
                <span>{c.category}</span>
                <span className="category-amount">{formatMoney(c.total)}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(c.total / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
