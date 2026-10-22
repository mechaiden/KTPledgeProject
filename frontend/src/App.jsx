import { useState } from 'react'
import { useAuth } from './auth.jsx'

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
    <form onSubmit={handleSubmit}>
      <h2>{mode === 'login' ? 'Log in' : 'Sign up'}</h2>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={mode === 'register' ? 8 : undefined}
        required
      />
      <button type="submit">{mode === 'login' ? 'Log in' : 'Create account'}</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
    </form>
  )
}

function App() {
  const { user, isLoading, logout, api } = useAuth()

  async function callApi() {
    console.log(await api('/private'))
  }

  if (isLoading) return <p>Loading...</p>
  if (!user) return <AuthForm />

  return (
    <>
      <p>Hi {user.email}</p>
      <button onClick={callApi}>Call API</button>
      <button onClick={logout}>Log out</button>
    </>
  )
}
export default App
