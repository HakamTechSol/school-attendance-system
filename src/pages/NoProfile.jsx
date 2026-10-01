import { Link } from 'react-router-dom'
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/auth'
import { Button } from '../components/Button'
import { usePageTitle } from '../utils/hooks'

export default function NoProfile() {
  usePageTitle('Profile missing')
  const { user, signOut, loading } = useAuth()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">Your account has no profile</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          You are signed in, but your account is not linked to a school. Ask your administrator to add you to a school
          profile, then sign in again.
        </p>
        {user?.email ? (
          <p className="mt-3 break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600">
            {user.email}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="sm:w-auto"
          >
            <RefreshCw size={16} aria-hidden="true" /> Refresh
          </Button>
          <Button variant="dark" onClick={signOut} loading={loading}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </Button>
        </div>

        <Link to="/login" className="mt-5 inline-block text-sm font-semibold text-brand-700 hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  )
}