import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { FullPageLoader } from '../components/Feedback'
import AuthStalled from '../components/AuthStalled'

/** Requires a session; `roles` optionally restricts which app_role may pass. */
export default function ProtectedRoute({ roles, children }) {
  const { session, role, loading, timedOut, loadError, retry, signOut, profileMissing } = useAuth()
  const location = useLocation()

  // Never spin forever: the provider caps the wait at 8s.
  if (loading) return <FullPageLoader label="Checking your session..." />

  if (timedOut || (loadError && !profileMissing)) {
    return <AuthStalled message={loadError} onRetry={retry} onSignOut={signOut} />
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (profileMissing) return <Navigate to="/no-profile" replace />

  if (roles && !roles.includes(role)) {
    // Send admins to the admin area and staff to their portal.
    return <Navigate to={role === 'admin' ? '/admin' : '/staff'} replace />
  }

  return children
}