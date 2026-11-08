import { useCallback, useEffect, useRef, useState } from 'react'
import { ChartColumn, Keyboard, LogOut, Plus, ReceiptText, X } from 'lucide-react'
import { api } from './api.js'
import AddSheet from './AddSheet.jsx'
import BoxMark from './BoxMark.jsx'
import { useAuth } from './auth.jsx'
import { monthOf } from './format.js'
import InsightsPage from './InsightsPage.jsx'
import LoginPage from './LoginPage.jsx'
import ReceiptsPage from './ReceiptsPage.jsx'
import Review from './Review.jsx'

// The view lives in the URL hash so a refresh or the back button keeps your place.
// "#receipts/review" is the Receipts view opened on the Needs review tab.
// "#receipts?q=Amazon" opens Receipts searched to that merchant.
function routeFromHash() {
  const [path, search = ''] = window.location.hash.slice(1).split('?')
  const [view, filter] = path.split('/')
  const query = new URLSearchParams(search).get('q') ?? ''
  if (view === 'receipts') return { view, reviewOnly: filter === 'review', query }
  return { view: 'insights', reviewOnly: false, query: '' }
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

// The full receipt list, shared by the shell (badge), Insights and Receipts
function useReceiptList() {
  const [receipts, setReceipts] = useState(null)
  const refresh = useCallback(() => api('/receipts').then(setReceipts).catch(() => {}), [])
  return { receipts, summary: summarize(receipts), refresh, update: setReceipts }
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

const SHORTCUTS = [
  ['Previous / next month', '← →'],
  ['Focus a category', '1–8'],
  ['Show all categories', '0'],
  ['Search merchants', '/'],
  ['Clear filters, close panels', 'Esc'],
  ['Show this list', '?'],
]

function ShortcutsDialog({ onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet shortcuts" role="dialog" aria-modal="true" aria-labelledby="ks-h">
        <div className="sheet-head">
          <h2 id="ks-h">Keyboard shortcuts</h2>
          <button ref={closeRef} type="button" className="icon-button sheet-close" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <dl className="shortcut-list">
          {SHORTCUTS.map(([what, key]) => (
            <div key={what}>
              <dt>{what}</dt>
              <dd><kbd className="kbd">{key}</kbd></dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function AccountMenu({ email, onLogout, onShortcuts }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const firstItem = useRef(null)

  useEffect(() => {
    if (!open) return
    firstItem.current?.focus()
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
        <div className="account-menu" role="menu" aria-label="Account">
          <div className="account-who">
            <span className="avatar is-static" aria-hidden="true">{initials(email)}</span>
            <span className="account-text">
              <span className="account-label">Signed in as</span>
              <span className="account-email">{email}</span>
            </span>
          </div>
          <div className="account-items">
            <button
              ref={firstItem}
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false)
                onShortcuts()
              }}
            >
              <Keyboard size={16} strokeWidth={2} aria-hidden="true" />
              Keyboard shortcuts
              <kbd className="kbd menu-kbd">?</kbd>
            </button>
            <button type="button" role="menuitem" className="menu-item" onClick={onLogout}>
              <LogOut size={16} strokeWidth={2} aria-hidden="true" />
              Sign out
            </button>
          </div>
          <p className="account-note">Your receipts are read on Shoebox’s own server, not sent to an outside AI service.</p>
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
  const { receipts, summary, refresh, update } = useReceiptList()
  // Handed to the Receipts page once it's on screen: 'picker' opens the file picker, a FileList uploads those files
  const [pendingUpload, setPendingUpload] = useState(null)
  const uploadHandled = useCallback(() => setPendingUpload(null), [])
  // Review: { queue: true } walks every receipt that needs a look; { id } opens one receipt
  const [review, setReview] = useState(null)
  const [adding, setAdding] = useState(false)
  const closeAdd = useCallback(() => setAdding(false), [])
  const [shortcuts, setShortcuts] = useState(false)
  const closeShortcuts = useCallback(() => setShortcuts(false), [])

  // ? opens the shortcut list from anywhere, unless typing or a dialog is open
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target
      if (el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
      if (document.querySelector('[role="dialog"]')) return
      setShortcuts(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const closeReview = useCallback(() => setReview(null), [])
  const [toast, setToast] = useState(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (user) refresh()
  }, [user, refresh])

  if (isLoading) return null
  if (!user) return <LoginPage />

  // With files (dropped on Insights or picked in the sheet) upload them; without, open the sheet
  function addReceipts(files) {
    if (!files?.length) {
      setAdding(true)
      return
    }
    setAdding(false)
    setPendingUpload(files)
    navigate('receipts')
  }

  const reviewCount = summary?.reviewCount ?? 0

  function handleSaved(updated) {
    const wasReview = receipts?.find((r) => r.id === updated.id)?.status === 'review'
    update((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    const left = reviewCount - (wasReview ? 1 : 0)
    setToast(wasReview ? (left > 0 ? `Saved. ${left} left to review.` : 'Saved. Nothing left to review.') : 'Saved.')
  }

  function handleDeleted(id) {
    update((prev) => prev.filter((r) => r.id !== id))
    setToast('Receipt deleted.')
  }

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
          <AccountMenu email={user.email} onLogout={logout} onShortcuts={() => setShortcuts(true)} />
        </div>
      </header>

      {route.view === 'insights' ? (
        <main className="content">
          <InsightsPage
            summary={summary}
            receipts={receipts}
            onReview={() => setReview({ queue: true })}
            onOpenMerchant={(name) => navigate(`receipts?q=${encodeURIComponent(name)}`)}
            onAddReceipts={addReceipts}
          />
        </main>
      ) : (
        <ReceiptsPage
          key={`${route.reviewOnly ? 'review' : 'all'}-${route.query}`}
          initialReviewOnly={route.reviewOnly}
          initialQuery={route.query}
          pendingUpload={pendingUpload}
          onPendingUploadHandled={uploadHandled}
          receipts={receipts}
          onReceiptsChange={update}
          onOpenReceipt={(id) => setReview({ id })}
        />
      )}

      {review && receipts && (
        <Review
          receipts={receipts}
          openId={review.id}
          queueMode={!!review.queue}
          filedCount={receipts.filter((r) => r.status === 'done').length}
          onClose={closeReview}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
      {shortcuts && <ShortcutsDialog onClose={closeShortcuts} />}
      {adding && <AddSheet onFiles={addReceipts} onClose={closeAdd} />}
      {toast && <div className="toast" role="status">{toast}</div>}

      <nav className="tabbar" aria-label="Main">
        <NavLinks view={route.view} reviewCount={reviewCount} />
      </nav>
      <button type="button" className="fab" onClick={() => addReceipts()} aria-label="Add receipts">
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
