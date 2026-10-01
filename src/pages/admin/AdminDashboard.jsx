import { Link } from 'react-router-dom'
import {
  Users,
  UserCheck,
  Clock3,
  UserX,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../../context/auth'
import { useCheckedInToday, useDashboardToday, useHolidays, useSchoolWorkingDays, useSchoolWorkingWeeks } from '../../lib/queries'
import { PageHeader, Card } from '../../components/Layout'
import SchoolCalendar from '../../components/SchoolCalendar'
import { StatCard, StatusBadge, DesignationBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { EmptyState, ErrorState, SkeletonCard, SkeletonLine } from '../../components/Feedback'
import { useInterval, useNow, usePageTitle, useTodayKey } from '../../utils/hooks'
import {
  DEFAULT_TIMEZONE,
  designationLabel,
  formatClock,
  formatLongDate,
  formatTime,
  hoursBetween,
  formatHours,
  percentage,
} from '../../utils/format'

export default function AdminDashboard() {
  usePageTitle('Dashboard')
  const { school, timezone = DEFAULT_TIMEZONE } = useAuth()
  const now = useNow(30_000)

  const todayKey = useTodayKey(timezone)
  const calendarToday = useHolidays(school?.id, todayKey, todayKey)
  const weeklySchedule = useSchoolWorkingDays(school?.id)
  const currentWeekStart = (() => { const d = new Date(todayKey + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.toISOString().slice(0,10) })()
  const exactWeek = useSchoolWorkingWeeks(school?.id, currentWeekStart, currentWeekStart)
  const workingDaysForToday = exactWeek.data?.[0]?.working_days ?? weeklySchedule.data ?? [1, 2, 3, 4, 5, 6]
  const holidayToday = calendarToday.data?.find((item) => item.kind === 'holiday' || item.kind === 'off_day')
  const workdayToday = calendarToday.data?.find((item) => item.kind === 'working_day')
  const todayWorkOverride = Boolean(workdayToday)
  const isWeeklyOff = !holidayToday && !todayWorkOverride && !workingDaysForToday.includes(new Date(todayKey + 'T12:00:00Z').getUTCDay())

  const stats = useDashboardToday(timezone)
  const checkedIn = useCheckedInToday(timezone, todayKey)

  // Auto-refresh every 60 seconds so the board stays close to live.
  useInterval(() => {
    stats.refresh()
    checkedIn.refresh()
  }, 60_000)

  const d = stats.data
  const rate = percentage((d?.present ?? 0) + (d?.late ?? 0), d?.total ?? 0)
  const calendarClosedToday = Boolean(holidayToday || isWeeklyOff)
  const rows = checkedIn.data ?? []

  return (
    <>
      <PageHeader
        title="Today at a glance"
        description={`${formatLongDate(now, timezone)} - ${school?.name ?? 'School'} - times in ${timezone}`}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              stats.refresh()
              checkedIn.refresh()
            }}
            loading={stats.loading || checkedIn.loading}
          >
            <RefreshCw size={16} aria-hidden="true" /> Refresh
          </Button>
        }
      />

      {holidayToday || isWeeklyOff || workdayToday ? <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900"><span>{holidayToday ? (holidayToday.kind === 'off_day' ? 'School off day' : 'Holiday / School Closed') : isWeeklyOff ? 'Weekly off day' : 'Extra working day'}</span>{(holidayToday?.description || workdayToday?.description) ? <span className="font-medium">- {(holidayToday?.description || workdayToday?.description)}</span> : null}</div> : null}

      {stats.error ? (
        <div className="mb-4">
          <ErrorState message={stats.error} onRetry={stats.refresh} />
        </div>
      ) : null}

      {/* 2 columns on mobile, 4 from lg */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.loading && !d ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard label="Total staff" value={d?.total ?? 0} icon={Users} tone="slate" hint="Active staff accounts" />
            <StatCard label="On Time" value={d?.present ?? 0} icon={UserCheck} tone="green" hint="Checked in by the late cutoff" />
            <StatCard label="Late" value={d?.late ?? 0} icon={Clock3} tone="amber" hint={`After ${school?.late_after ?? '08:00'}`} />
            <StatCard label="Absent" value={d?.absent ?? 0} icon={UserX} tone="rose" hint="No check-in recorded" />
          </>
        )}
      </div>

      {!stats.loading && d && !calendarClosedToday ? (
        <Card className="mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Attendance rate today</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {(d.present + d.late)} of {d.total} staff checked in
              </p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-slate-900">{rate}%</p>
          </div>
          <div
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={rate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Attendance rate today"
          >
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${rate}%` }} />
          </div>
        </Card>
      ) : null}

      <SchoolCalendar school={school} timezone={timezone} />

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card
          title="Checked in today"
          description={`${rows.length} record${rows.length === 1 ? '' : 's'}`}
          actions={
            <Link
              to="/admin/attendance"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              All attendance <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          {checkedIn.loading ? (
            <div className="space-y-3" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <SkeletonLine className="h-4 w-2/3" />
                  <SkeletonLine className="mt-2 h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : checkedIn.error ? (
            <ErrorState message={checkedIn.error} onRetry={checkedIn.refresh} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nobody has checked in yet"
              description="Check-in records appear here as soon as staff mark attendance."
            />
          ) : (
            <CheckedInList rows={rows} timezone={timezone} now={now} />
          )}
        </Card>

        <Card title="Quick links">
          <ul className="grid gap-3 sm:grid-cols-2">
            <QuickLink to="/admin/staff" title="Manage staff" description="Add, edit or remove staff accounts" />
            <QuickLink to="/admin/reports" title="Attendance reports" description="Day, week, month or year analytics" />
            <QuickLink to="/admin/attendance" title="Attendance records" description="Full searchable history for the school" />
            <QuickLink to="/admin/network" title="Network & IP" description="Restrict attendance to school IPs" />
          </ul>
        </Card>
      </div>
    </>
  )
}

function CheckedInList({ rows, timezone, now }) {
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{row.full_name}</p>
              <div className="flex flex-col items-end gap-1"><StatusBadge status={row.status} />{row.auto_checked_out ? <span className="text-[10px] font-bold text-slate-500">Auto check-out</span> : null}</div>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500">{designationLabel(row.designation)}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-sm">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">In</p>
                <p className="truncate font-bold text-slate-800">{formatTime(row.check_in, timezone)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Out</p>
                <p className="truncate font-bold text-slate-800">{formatTime(row.check_out, timezone)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Live</p>
                <p className="truncate font-bold text-slate-800">{formatClock(now, timezone)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[520px] text-left text-sm">
          <caption className="sr-only">Staff who have checked in today</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2.5 pr-3 font-bold">Staff</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Designation</th>
              <th scope="col" className="px-3 py-2.5 font-bold">In</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Out</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Hours</th>
              <th scope="col" className="py-2.5 pl-3 text-right font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="max-w-[220px] py-3 pr-3">
                  <p className="truncate font-semibold text-slate-900">{row.full_name}</p>
                </td>
                <td className="px-3 py-3"><DesignationBadge designation={row.designation} /></td>
                <td className="px-3 py-3 font-semibold text-slate-800">{formatTime(row.check_in, timezone)}</td>
                <td className="px-3 py-3 font-semibold text-slate-800">{formatTime(row.check_out, timezone)}</td>
                <td className="px-3 py-3 font-semibold text-slate-800">
                  {formatHours(hoursBetween(row.check_in, row.check_out))}
                </td>
                <td className="py-3 pl-3 text-right"><div className="flex flex-col items-end gap-1"><StatusBadge status={row.status} />{row.auto_checked_out ? <span className="text-[10px] font-bold text-slate-500">Auto check-out</span> : null}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function QuickLink({ to, title, description }) {
  return (
    <li>
      <Link
        to={to}
        className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-slate-900">{title}</span>
          <span className="block truncate text-xs text-slate-500">{description}</span>
        </span>
      </Link>
    </li>
  )
}
