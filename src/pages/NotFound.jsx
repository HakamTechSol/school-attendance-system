import { Link } from 'react-router-dom'
import { Compass, Home, LayoutDashboard } from 'lucide-react'
import { usePageTitle } from '../utils/hooks'

export default function NotFound() {
  usePageTitle('Page not found')

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-brand-300 shadow-lg">
          <Compass size={30} aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-bold uppercase tracking-widest text-brand-600">Error 404</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Home size={16} aria-hidden="true" /> Go to my home
          </Link>
          <Link
            to="/admin"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LayoutDashboard size={16} aria-hidden="true" /> Admin dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}