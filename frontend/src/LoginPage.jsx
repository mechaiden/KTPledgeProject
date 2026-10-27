import { useState } from 'react'
import { useAuth } from './auth.jsx'

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
    <main className="login">
      <p className="wordmark">KTPledge</p>
      <h1>{isNew ? 'Create an account' : 'Log in'}</h1>

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password{isNew && <small> (at least 8 characters)</small>}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isNew ? 'new-password' : 'current-password'}
            minLength={isNew ? 8 : undefined}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="button primary" disabled={submitting}>
          {isNew ? 'Create account' : 'Log in'}
        </button>
      </form>

      <p className="login-switch">
        {isNew ? 'Already have an account?' : 'No account yet?'}{' '}
        <button type="button" className="link" onClick={() => { setIsNew(!isNew); setError('') }}>
          {isNew ? 'Log in' : 'Create one'}
        </button>
      </p>
    </main>
  )
}
