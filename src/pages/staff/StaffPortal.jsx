import { useMemo } from 'react'
import {
  LogIn,
  LogOut,
  CheckCircle2,
  Clock3,
  CalendarDays,
  Timer,
  AlertCircle,
  Sun,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '../../context/auth'
import { useTodayAttendance } from '../../lib/queries'
import { useIpStatus } from '../../lib/ipHooks'
import { useAttendanceActions, IP_BLOCKED_MESSAGE } from '../../lib/attendanceActions'
import { Card } from '../../components/Layout'
import { Button } from '../../components/Button'
import { StatusBadge, Chip, DesignationBadge } from '../../components/Badge'
import { SkeletonCard, ErrorState } from '../../components/Feedback'
import { useNow } from '../../utils/hooks'
import {
  designationLabel,
  formatClock,
  formatLongDate,
  formatTime,
  formatHours,
  hoursBetween,
  isSunday,
  toDateKey,
  DEFAULT_TIMEZONE,
} from '../../utils/format'

export default function StaffPortal() {
  const { profile, timezone = DEFAULT_TIMEZONE, lateAfter = '08:00' } = useAuth()
  const now = useNow(1000)

  const todayKey = useMemo(() => toDateKey(now, timezone), [now, timezone])
  const isSundayToday = isSunday(todayKey)

  const { data: today, loading, error, refresh } = useTodayAttendance(profile?.id, timezone, todayKey)
  const { checkIn, checkOut, pending } = useAttendanceActions(refresh)
  const ip = useIpStatus(timezone)

  const status = today?.status ?? null
  const checkedIn = Boolean(today)
  const checkedOut = Boolean(today?.check_out)
  const workedHours = hoursBetween(today?.check_in, today?.check_out)

  // The server is the source of truth; this flag only hides the button early.
  const ipBlocked = Boolean(ip.data?.enforced && ip.data?.allowed === false)
  const ipVerified = Boolean(ip.data?.enforced && ip.data?.allowed)

  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }).format(now),
  )
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <main className="space-y-4">
      {/* Greeting + live clock */}
      <section className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg sm:p-6">
        <p className="text-sm font-medium text-brand-300">
          {greeting}, {profile?.full_name?.split(' ')[0] ?? 'there'}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{formatClock(now, timezone)}</h1>
        <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-300">
          <CalendarDays size={15} className="shrink-0" aria-hidden="true" />
          {formatLongDate(now, timezone)}
        </p>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
            <Clock3 size={13} aria-hidden="true" /> Timezone: {timezone}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
            <Timer size={13} aria-hidden="true" /> Check-in from {school?.check_in_start ?? '07:00'} - late after {lateAfter}
          </span>
        </p>
      </section>

      {ipBlocked ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3.5 sm:px-5"
        >
          <p className="flex items-start gap-2.5 text-sm font-semibold leading-snug text-rose-900">
            <ShieldAlert size={20} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{IP_BLOCKED_MESSAGE}</span>
          </p>
          {ip.data?.ip ? (
            <p className="mt-2 pl-8 text-xs text-rose-700">
              Your detected IP: <span className="font-mono font-semibold">{ip.data.ip}</span>
            </p>
          ) : null}
        </div>
      ) : ipVerified ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <ShieldCheck size={14} aria-hidden="true" /> School network verified
        </p>
      ) : null}

      {isSundayToday ? (
        <p className="flex items-start gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900">
          <Sun size={18} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
          Today is Sunday, the weekly off day. Attendance is optional, but you can still check in.
        </p>
      ) : null}

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {/* Today's status card */}
      <Card title="Today's status" description={`Attendance date: ${todayKey}`}>
        {loading ? (
          <SkeletonCard />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {checkedIn ? (
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />{today?.auto_checked_out ? <span className="text-xs font-bold text-slate-500">Auto check-out</span> : null}
                  <span className="text-sm font-semibold text-slate-700">
                    {checkedOut ? 'Day complete' : 'Checked in'}
                  </span>
                </div>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-600 ring-1 ring-inset ring-slate-300">
                  Not checked in
                </span>
              )}

              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Check in</dt>
                  <dd className="truncate font-bold text-slate-800">{formatTime(today?.check_in, timezone)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Check out</dt>
                  <dd className="truncate font-bold text-slate-800">{formatTime(today?.check_out, timezone)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hours</dt>
                  <dd className="truncate font-bold text-slate-800">{formatHours(workedHours)}</dd>
                </div>
              </dl>
            </div>

            {checkedIn ? (
              <CheckCircle2 size={40} className="mx-auto shrink-0 text-emerald-500 sm:mx-0" aria-hidden="true" />
            ) : null}
          </div>
        )}
      </Card>

      {/* Primary action */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {ipBlocked ? (
          <div className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-4 py-4 text-center">
            <ShieldAlert size={26} className="text-rose-600" aria-hidden="true" />
            <p className="text-base font-bold text-rose-900">Check in blocked</p>
            <p className="text-sm text-rose-700">Please connect to your school network and try again.</p>
          </div>
        ) : !checkedIn ? (
          <>
            <p className="mb-3 text-center text-sm font-medium text-slate-600 sm:text-left">
              Tap once to record your arrival for today.
            </p>
            <Button
              size="xl"
              fullWidth
              loading={pending === 'check_in'}
              disabled={Boolean(pending) || ip.loading}
              onClick={checkIn}
              className="min-h-16"
            >
              {!pending ? <LogIn size={22} aria-hidden="true" /> : null}
              {pending === 'check_in' ? 'Checking in...' : 'Check In'}
            </Button>
          </>
        ) : !checkedOut ? (
          <>
            <p className="mb-3 text-center text-sm font-medium text-slate-600 sm:text-left">
              You are checked in. Check out when you leave.
            </p>
            <Button
              variant="dark"
              size="xl"
              fullWidth
              loading={pending === 'check_out'}
              disabled={Boolean(pending)}
              onClick={checkOut}
              className="min-h-16"
            >
              {!pending ? <LogOut size={22} aria-hidden="true" /> : null}
              {pending === 'check_out' ? 'Checking out...' : 'Check Out'}
            </Button>
          </>
        ) : (
          <div
            className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-4 text-center"
            role="status"
          >
            <CheckCircle2 size={26} className="text-emerald-600" aria-hidden="true" />
            <p className="text-base font-bold text-emerald-900">Done for today</p>
            <p className="text-sm text-emerald-700">
              Total {formatHours(workedHours)} - status server ne decide kiya
            </p>
          </div>
        )}

        <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-xs text-slate-500 sm:justify-start sm:text-left">
          <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Only one check-in is allowed per day. Present or Late is decided by the server.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DesignationBadge designation={profile?.designation} />
        <Chip tone="brand">{designationLabel(profile?.designation)}</Chip>
        {checkedIn ? (
          <Chip tone={status === 'late' ? 'amber' : 'green'}>{status === 'late' ? 'Late' : 'Present'}</Chip>
        ) : null}
      </div>
    </main>
  )
}