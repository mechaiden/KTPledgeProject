import { formatMoney } from './format.js'

function Change({ current, previous }) {
  if (!previous) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const up = pct >= 0
  return (
    <span className={`stat-change ${up ? 'up' : 'down'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% vs last month
    </span>
  )
}

export default function StatCards({ stats, onReviewClick }) {
  return (
    <section className="stat-cards">
      <div className="card stat-card">
        <span className="stat-label">Spent</span>
        <span className="stat-value">{formatMoney(stats.total)}</span>
        <Change current={stats.total} previous={stats.prevTotal} />
      </div>

      <div className="card stat-card">
        <span className="stat-label">Receipts</span>
        <span className="stat-value">{stats.count}</span>
      </div>

      <div className="card stat-card">
        <span className="stat-label">Top category</span>
        <span className="stat-value">{stats.topCategory?.category ?? '—'}</span>
        {stats.topCategory && <span className="stat-sub">{formatMoney(stats.topCategory.total)}</span>}
      </div>

      <button
        className={`card stat-card stat-card-button${stats.reviewCount ? ' attention' : ''}`}
        onClick={onReviewClick}
        disabled={!stats.reviewCount}
      >
        <span className="stat-label">To review</span>
        <span className="stat-value">{stats.reviewCount}</span>
        {stats.reviewCount > 0 && <span className="stat-sub">Click to filter</span>}
      </button>
    </section>
  )
}
