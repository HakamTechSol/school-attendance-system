import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './routes/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { FullPageLoader } from './components/Feedback'
import Login from './pages/Login'
import NoProfile from './pages/NoProfile'
import NotFound from './pages/NotFound'
import StaffLayout from './pages/staff/StaffLayout'
import StaffPortal from './pages/staff/StaffPortal'
import StaffHistory from './pages/staff/StaffHistory'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import StaffManagement from './pages/admin/StaffManagement'
import Attendance from './pages/admin/Attendance'
import Network from './pages/admin/Network'

// Only the recharts-heavy page is code split; everything else stays in the
// main chunk so navigation never shows a full-page loader.
const Reports = lazy(() => import('./pages/admin/Reports'))

/** Sends each role to its own home page. */
function RoleHome() {
  const { loading, session, isAdmin, profileMissing } = useAuth()
  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (profileMissing) return <Navigate to="/no-profile" replace />
  return <Navigate to={isAdmin ? '/admin' : '/staff'} replace />
}

/** Small inline placeholder so a chunk load never blanks the whole screen. */
function RouteFallback() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading page">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<RoleHome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/no-profile" element={<NoProfile />} />

              <Route
                path="/staff"
                element={
                  <ProtectedRoute>
                    <StaffLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<StaffPortal />} />
                <Route path="history" element={<StaffHistory />} />
              </Route>

              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="staff" element={<StaffManagement />} />
                <Route path="attendance" element={<Attendance />} />
                <Route path="logs" element={<Navigate to="/admin/attendance" replace />} />
                <Route path="reports" element={<Suspense fallback={<RouteFallback />}><Reports /></Suspense>} />
                <Route path="network" element={<Network />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}