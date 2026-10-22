import { useState } from 'react'
import { useAuth } from './auth.jsx'
import Dashboard from './dashboard/Dashboard.jsx'

function AuthForm() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await (mode === 'login' ? login : register)(email, password)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? 'Log in to see your receipts.' : 'Start scanning receipts in seconds.'}
        </p>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={mode === 'register' ? 8 : undefined}
          required
        />
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="btn btn-primary">
          {mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <button type="button" className="btn-link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </form>
    </div>
  )
}

function App() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <p className="center-message">Loading...</p>
  if (!user) return <AuthForm />
  return <Dashboard />
}
export default App
