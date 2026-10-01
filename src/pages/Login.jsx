import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, GraduationCap, ShieldCheck, Clock3 } from 'lucide-react'
import { useAuth } from '../context/auth'
import { Button } from '../components/Button'
import { TextInput } from '../components/Input'
import { Spinner } from '../components/Feedback'
import { usePageTitle } from '../utils/hooks'
import { isSupabaseConfigured } from '../lib/supabase'

export default function Login() {
  usePageTitle('Login')
  const { signIn, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to={location.state?.from ?? '/'} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    setError('')
    if (!email.trim()) return setError('Please enter your email address.')
    if (!password) return setError('Please enter your password.')

    setSubmitting(true)
    try {
      await signIn(email, password)
      // The AuthProvider fills in the profile; "/" resolves by role.
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      const msg = String(err?.message ?? '')
      if (/invalid login credentials/i.test(msg)) setError('Invalid email or password. Please try again.')
      else if (/confirm/i.test(msg)) setError('Please confirm your email address before signing in.')
      else setError(msg || 'Unable to sign in right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-brand-300 shadow-lg">
              <GraduationCap size={28} aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              School Attendance
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to check in, check out and track attendance.</p>
          </div>

          {!isSupabaseConfigured ? (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
            >
              Supabase is not configured. Copy <code className="font-mono">.env.example</code> to{' '}
              <code className="font-mono">.env</code> and add your project URL and anon key.
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6"
            noValidate
          >
            <TextInput
              label="Email address"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@yourschool.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-invalid={error ? 'true' : undefined}
                  className="block w-full min-h-11 rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-12 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error ? (
              <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" fullWidth loading={submitting} disabled={loading}>
              {!submitting ? <LogIn size={18} aria-hidden="true" /> : null}
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>

            {loading ? (
              <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Spinner size={14} /> Restoring your session...
              </p>
            ) : null}
          </form>

          <ul className="mt-6 space-y-2 text-xs text-slate-500 sm:text-sm">
            <li className="flex items-start gap-2">
              <Clock3 size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
              One check-in per day. Late is marked automatically by the server.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-500" aria-hidden="true" />
              Staff can only see their own records. Admins see their whole school.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}