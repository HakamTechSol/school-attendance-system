import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, History, LogOut, GraduationCap } from 'lucide-react'
import { useAuth } from '../../context/auth'
import { IconButton } from '../../components/Button'
import { usePageTitle } from '../../utils/hooks'
import { designationLabel, initials } from '../../utils/format'

const NAV = [
  { to: '/staff', label: 'Home', icon: Home, end: true },
  { to: '/staff/history', label: 'My History', icon: History, end: false },
]

const TITLES = {
  '/staff': 'My day',
  '/staff/history': 'My history',
}

export default function StaffLayout() {
  const { profile, school, signOut } = useAuth()
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'Attendance'

  usePageTitle(title)

  return (
    <div className="min-h-dvh bg-slate-100">
      {/* Desktop: fixed sidebar only (lg+) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-800 bg-slate-900 lg:flex">
        <div className="flex items-center gap-3 px-4 py-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <GraduationCap size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{school?.name ?? 'School'}</p>
            <p className="truncate text-xs text-slate-400">Attendance portal</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2" aria-label="Staff sections">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <item.icon size={19} aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-200">
              {initials(profile?.full_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{profile?.full_name ?? 'Staff'}</p>
              <p className="truncate text-xs text-slate-400">{designationLabel(profile?.designation)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} aria-hidden="true" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile / tablet: slim top header + fixed bottom nav (no sidebar) */}
      <div className="lg:hidden">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-brand-300">
              <GraduationCap size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{title}</p>
              <p className="truncate text-xs text-slate-500">{school?.name ?? 'School'}</p>
            </div>
            <IconButton label="Logout" onClick={signOut} className="text-slate-500">
              <LogOut size={20} aria-hidden="true" />
            </IconButton>
          </div>
        </header>
      </div>

      {/* Content: extra bottom padding so the fixed bar never covers anything */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-3xl px-4 py-4 pb-28 sm:px-6 sm:py-6 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur lg:hidden"
        aria-label="Primary"
      >
        <ul className="grid grid-cols-3">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors ${
                    isActive ? 'text-brand-700' : 'text-slate-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={21} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                    {isActive ? <span className="sr-only">(current page)</span> : null}
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-16 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold text-slate-500 transition-colors"
            >
              <LogOut size={21} aria-hidden="true" />
              <span className="truncate">Logout</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}