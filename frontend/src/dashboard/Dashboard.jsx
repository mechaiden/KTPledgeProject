import { useCallback, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth.jsx'
import CategoryChart from './CategoryChart.jsx'
import NavBar from './NavBar.jsx'
import ReceiptDrawer from './ReceiptDrawer.jsx'
import RecentReceipts from './RecentReceipts.jsx'
import ReviewList from './ReviewList.jsx'
import StatCards from './StatCards.jsx'
import UploadZone from './UploadZone.jsx'
import { monthOf, prevMonth, todayISO } from './format.js'
import { MOCK_RECEIPTS } from './mockData.js'
import './Dashboard.css'

function sumTotals(receipts) {
  return receipts.reduce((sum, r) => sum + (r.total ?? 0), 0)
}

export default function Dashboard() {
  const { user } = useAuth()
  const fileInputRef = useRef(null)
  // TODO: replace with data from GET /api/receipts
  const [receipts, setReceipts] = useState(MOCK_RECEIPTS)
  const [month, setMonth] = useState(monthOf(todayISO()))
  const [reviewOnly, setReviewOnly] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const selected = receipts.find((r) => r.id === selectedId) ?? null
  const closeDrawer = useCallback(() => setSelectedId(null), [])

  function handleSave(updated) {
    // TODO: PATCH /api/receipts/{id}
    setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    setSelectedId(null)
  }

  function handleDelete(id) {
    // TODO: DELETE /api/receipts/{id}
    setReceipts((prev) => prev.filter((r) => r.id !== id))
    setSelectedId(null)
  }

  const monthReceipts = useMemo(
    () => receipts.filter((r) => monthOf(r.date) === month),
    [receipts, month],
  )

  const stats = useMemo(() => {
    const counted = monthReceipts.filter((r) => r.status !== 'processing')
    const prevCounted = receipts.filter(
      (r) => monthOf(r.date) === prevMonth(month) && r.status !== 'processing',
    )

    const totalsByCategory = {}
    for (const r of counted) {
      totalsByCategory[r.category] = (totalsByCategory[r.category] ?? 0) + r.total
    }
    const byCategory = Object.entries(totalsByCategory)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)

    return {
      total: sumTotals(counted),
      prevTotal: sumTotals(prevCounted),
      count: monthReceipts.length,
      topCategory: byCategory[0] ?? null,
      reviewCount: monthReceipts.filter((r) => r.status === 'review').length,
      byCategory,
    }
  }, [receipts, monthReceipts, month])

  function handleFiles(files) {
    // TODO: POST each file to /api/receipts and poll until it's parsed
    const newRows = files.map((file) => ({
      id: crypto.randomUUID(),
      date: todayISO(),
      merchant: file.name,
      category: null,
      total: null,
      status: 'processing',
    }))
    setReceipts((prev) => [...newRows, ...prev])
    setMonth(monthOf(todayISO()))
  }

  const openFilePicker = () => fileInputRef.current?.click()
  const name = user.email.split('@')[0]

  // Brand-new user: just a big upload prompt
  if (receipts.length === 0) {
    return (
      <div className="dashboard">
        <NavBar onUploadClick={openFilePicker} />
        <main className="dashboard-main empty-state">
          <h1>Scan your first receipt</h1>
          <p>Upload a photo or PDF and we’ll pull out the merchant, items and totals.</p>
          <UploadZone inputRef={fileInputRef} onFiles={handleFiles} large />
          <ol className="steps">
            <li>Upload a receipt</li>
            <li>We read it</li>
            <li>Review &amp; save</li>
          </ol>
        </main>
      </div>
    )
  }

  const tableRows = reviewOnly ? monthReceipts.filter((r) => r.status === 'review') : monthReceipts

  return (
    <div className="dashboard">
      <NavBar onUploadClick={openFilePicker} />
      <main className="dashboard-main">
        <section className="dashboard-header">
          <div>
            <h1>Hi {name}</h1>
            <p>Here’s your spending this month.</p>
          </div>
          <input
            type="month"
            className="month-picker"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </section>

        <UploadZone inputRef={fileInputRef} onFiles={handleFiles} />

        <StatCards stats={stats} onReviewClick={() => setReviewOnly(true)} />

        <div className="dashboard-grid">
          <RecentReceipts
            receipts={tableRows.slice(0, 8)}
            reviewOnly={reviewOnly}
            onClearFilter={() => setReviewOnly(false)}
            onSelect={setSelectedId}
          />
          <aside className="dashboard-side">
            <CategoryChart byCategory={stats.byCategory} />
            <ReviewList receipts={monthReceipts.filter((r) => r.status === 'review')} onSelect={setSelectedId} />
          </aside>
        </div>
      </main>

      {selected && (
        <ReceiptDrawer
          key={selected.id}
          receipt={selected}
          onClose={closeDrawer}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
