import { useState } from 'react'
import { useAuth } from './auth.jsx'
import BoxMark from './BoxMark.jsx'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [isNew, setIsNew] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await (isNew ? register : login)(email, password)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit} aria-labelledby="login-h">
        <p className="wordmark login-mark"><BoxMark />Shoebox</p>
        <div>
          <h1 id="login-h">{isNew ? 'Create your account' : 'Sign in'}</h1>
          <p className="login-lede">Snap a receipt. Shoebox files it and only asks when it isn’t sure.</p>
        </div>
        <label className="field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isNew ? 'new-password' : 'current-password'}
            minLength={isNew ? 8 : undefined}
            aria-describedby={isNew ? 'pw-rule' : undefined}
            required
          />
          {isNew && <small id="pw-rule">At least 8 characters</small>}
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="button primary login-submit" disabled={submitting}>
          {submitting ? (isNew ? 'Creating account…' : 'Signing in…') : isNew ? 'Create account' : 'Sign in'}
        </button>
        <p className="login-switch">
          {isNew ? 'Already have an account?' : 'New to Shoebox?'}{' '}
          <button type="button" className="link" onClick={() => { setIsNew(!isNew); setError('') }}>
            {isNew ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </form>
    </main>
  )
}
