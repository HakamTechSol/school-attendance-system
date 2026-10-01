import { LogOut, RefreshCw, WifiOff, AlertTriangle } from 'lucide-react'
import { usePageTitle } from '../utils/hooks'

/**
 * Shown when the auth/profile bootstrap did not finish within 8 seconds.
 * Gives the user a way out instead of an infinite spinner.
 */
export default function AuthStalled({ message, onRetry, onSignOut }) {
  usePageTitle('Connection problem')

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <WifiOff size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">Taking too long</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          We could not load your account in time. This usually means a slow or dropped connection.
        </p>

        {message ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-left">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            <p className="break-words text-xs text-slate-600">{message}</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <RefreshCw size={16} aria-hidden="true" /> Retry
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      </div>
    </div>
  )
}