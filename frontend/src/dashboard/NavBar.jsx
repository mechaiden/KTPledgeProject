import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth.jsx'

export default function NavBar({ onUploadClick }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  // Close the menu when clicking anywhere outside it
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <span className="logo">KTPledge</span>

        {/* Plain buttons for now; swap for router links when you add pages */}
        <nav className="nav-links">
          <button className="nav-link active">Dashboard</button>
          <button className="nav-link">Receipts</button>
          <button className="nav-link">Reports</button>
        </nav>

        <div className="nav-actions">
          <button className="btn btn-primary" onClick={onUploadClick}>+ Upload</button>
          <div className="user-menu" ref={menuRef}>
            <button
              className="avatar"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              {user.email[0].toUpperCase()}
            </button>
            {menuOpen && (
              <div className="dropdown">
                <p className="dropdown-email">{user.email}</p>
                <button className="dropdown-item" onClick={logout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
