import { useCallback, useEffect, useRef, useState } from 'react'
import { ChartColumn, LogOut, Plus, ReceiptText } from 'lucide-react'
import { api } from './api.js'
import BoxMark from './BoxMark.jsx'
import { useAuth } from './auth.jsx'
import { monthOf } from './format.js'
import InsightsPage from './InsightsPage.jsx'
import LoginPage from './LoginPage.jsx'
import ReceiptsPage from './ReceiptsPage.jsx'

// The view lives in the URL hash so a refresh or the back button keeps your place.
// "#receipts/review" is the Receipts view opened on the Needs review tab.
function routeFromHash() {
  const [view, filter] = window.location.hash.slice(1).split('/')
  if (view === 'receipts') return { view, reviewOnly: filter === 'review' }
  return { view: 'insights', reviewOnly: false }
}

function useRoute() {
  const [route, setRoute] = useState(routeFromHash)
  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return [route, (hash) => { window.location.hash = hash }]
}

// What the shell and Insights need to know about the receipt list as a whole
function summarize(receipts) {
  if (!receipts) return null
  const counted = receipts.filter((r) => r.status !== 'processing' && r.date && r.total != null)
  return {
    receiptCount: receipts.length,
    reviewCount: receipts.filter((r) => r.status === 'review').length,
    latestMonth: counted.reduce((latest, r) => (monthOf(r.date) > latest ? monthOf(r.date) : latest), ''),
  }
}

function useReceiptSummary() {
  const [summary, setSummary] = useState(null)
  const refresh = useCallback(() => api('/receipts').then((list) => setSummary(summarize(list))).catch(() => {}), [])
  const update = useCallback((list) => setSummary(summarize(list)), [])
  return { summary, refresh, update }
}

function CountBadge({ count, label }) {
  if (!count) return null
  return <span className="count-badge" aria-label={label}>{count}</span>
}

// "rosa.tran@…" -> "RT", "demo@…" -> "DE"
function initials(email) {
  const parts = email.split('@')[0].split(/[._-]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

function AccountMenu({ email, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="avatar"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
      >
        {initials(email)}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <p className="account-email">{email}</p>
          <button type="button" role="menuitem" className="menu-item" onClick={onLogout}>
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

function NavLinks({ view, reviewCount }) {
  const reviewLabel = `${reviewCount} receipt${reviewCount === 1 ? '' : 's'} need review`
  return (
    <>
      <a href="#insights" aria-current={view === 'insights' ? 'page' : undefined}>
        <ChartColumn size={16} strokeWidth={2} aria-hidden="true" />
        Insights
      </a>
      <a href="#receipts" aria-current={view === 'receipts' ? 'page' : undefined}>
        <ReceiptText size={16} strokeWidth={2} aria-hidden="true" />
        Receipts
        <CountBadge count={reviewCount} label={reviewLabel} />
      </a>
    </>
  )
}

export default function App() {
  const { user, isLoading, logout } = useAuth()
  const [route, navigate] = useRoute()
  const { summary, refresh, update } = useReceiptSummary()
  // Handed to the Receipts page once it's on screen: 'picker' opens the file picker, a FileList uploads those files
  const [pendingUpload, setPendingUpload] = useState(null)
  const uploadHandled = useCallback(() => setPendingUpload(null), [])

  useEffect(() => {
    if (user) refresh()
  }, [user, refresh])

  if (isLoading) return null
  if (!user) return <LoginPage />

  function addReceipts(files) {
    setPendingUpload(files?.length ? files : 'picker')
    navigate('receipts')
  }

  const reviewCount = summary?.reviewCount ?? 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="wordmark" href="#insights"><BoxMark />Shoebox</a>
          <nav className="topnav" aria-label="Main">
            <NavLinks view={route.view} reviewCount={reviewCount} />
          </nav>
          <button type="button" className="button primary add-button" onClick={() => addReceipts()}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add receipts
          </button>
          <AccountMenu email={user.email} onLogout={logout} />
        </div>
      </header>

      {route.view === 'insights' ? (
        <main className="content">
          <InsightsPage
            summary={summary}
            onReview={() => navigate('receipts/review')}
            onAddReceipts={addReceipts}
          />
        </main>
      ) : (
        <ReceiptsPage
          key={route.reviewOnly ? 'review' : 'all'}
          initialReviewOnly={route.reviewOnly}
          pendingUpload={pendingUpload}
          onPendingUploadHandled={uploadHandled}
          onReceiptsChange={update}
        />
      )}

      <nav className="tabbar" aria-label="Main">
        <NavLinks view={route.view} reviewCount={reviewCount} />
      </nav>
      <button type="button" className="fab" onClick={() => addReceipts()} aria-label="Add receipts">
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
