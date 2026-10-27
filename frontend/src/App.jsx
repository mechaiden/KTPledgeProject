import { useAuth } from './auth.jsx'
import LoginPage from './LoginPage.jsx'
import ReceiptsPage from './ReceiptsPage.jsx'

export default function App() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return user ? <ReceiptsPage /> : <LoginPage />
}
