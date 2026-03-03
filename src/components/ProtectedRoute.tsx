import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({
  children,
  allowOnboarding = false,
  allowUnverified = false,
}: {
  children: React.ReactNode
  allowOnboarding?: boolean
  allowUnverified?: boolean
}) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading' || status === 'idle') {
    return <div className="page-loader">Loading...</div>
  }

  if (status !== 'authenticated') {
    return <Navigate to="/" replace />
  }

  if (!allowUnverified && user && user.email_verified === false) {
    if (location.pathname !== '/verify-email') {
      return <Navigate to="/verify-email" replace />
    }
  }

  if (!allowOnboarding && user && user.onboarding_completed === false) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />
    }
  }

  return <>{children}</>
}
