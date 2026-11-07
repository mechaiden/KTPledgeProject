import { useEffect, useState } from 'react'
import { useAuth } from './auth.jsx'
import InsightsPage from './InsightsPage.jsx'
import LoginPage from './LoginPage.jsx'
import ReceiptsPage from './ReceiptsPage.jsx'

const VIEWS = ['receipts', 'insights']

// The view lives in the URL hash (#insights) so a refresh or the back button keeps your place
function viewFromHash() {
  const view = window.location.hash.slice(1)
  return VIEWS.includes(view) ? view : 'receipts'
}

function useView() {
  const [view, setView] = useState(viewFromHash)
  useEffect(() => {
    const onHashChange = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return [view, (next) => { window.location.hash = next }]
}

export default function App() {
  const { user, isLoading, logout } = useAuth()
  const [view, setView] = useView()
  if (isLoading) return null
  if (!user) return <LoginPage />

  return (
    <>
      <header className="topbar">
        <span className="wordmark">KTPledge</span>
        <nav className="topnav" aria-label="Main">
          <a href="#receipts" aria-current={view === 'receipts' ? 'page' : undefined}>Receipts</a>
          <a href="#insights" aria-current={view === 'insights' ? 'page' : undefined}>Insights</a>
        </nav>
        <span className="topbar-user">{user.email}</span>
        <button type="button" className="link" onClick={logout}>Log out</button>
      </header>

      {view === 'insights' ? (
        <main className="content">
          <InsightsPage onShowReceipts={() => setView('receipts')} />
        </main>
      ) : (
        <ReceiptsPage />
      )}
    </>
  )
}
