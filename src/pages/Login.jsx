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
    <div className="flex h-dvh items-center justify-center overflow-hidden bg-slate-100 p-2 sm:p-4">
      <main className="grid h-full w-full max-w-6xl min-h-0 overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 md:grid-cols-2">
        <section className="relative hidden min-h-0 overflow-hidden bg-slate-900 md:block" aria-label="School attendance">
          <img src="/3870277.jpg" alt="School attendance" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-slate-900/10" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9 md:p-10">
            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-brand-300 ring-1 ring-white/20 backdrop-blur-sm">
              <GraduationCap size={26} aria-hidden="true" />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-200">Attendance made simple</p>
            <h2 className="mt-2 max-w-md text-2xl font-bold tracking-tight sm:text-3xl">Welcome to your school workspace</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-200">A simple place to manage daily attendance and stay connected with your school.</p>
          </div>
        </section>
        <section className="flex min-h-0 items-center justify-center overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 md:px-10">
          <div className="w-full max-w-md">
          <div className="mb-4 flex flex-col items-center text-center sm:mb-5">
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
              className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900"
            >
              Supabase is not configured. Copy <code className="font-mono">.env.example</code> to{' '}
              <code className="font-mono">.env</code> and add your project URL and anon key.
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg sm:space-y-4 sm:p-5"
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

        
          </div>
        </section>
      </main>
    </div>
  )
}