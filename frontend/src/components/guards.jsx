import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

// Route guard: requires a valid session, otherwise redirect to /login.
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}

// Route guard: admin role only.
export function AdminRoute() {
  const { isAuthenticated, isAdmin } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (!isAdmin) {
    // Authenticated but not an admin — send them to the POS terminal.
    return <Navigate to="/pos" replace />
  }
  return <Outlet />
}
