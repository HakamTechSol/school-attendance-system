import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, CalendarDays, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/auth'
import { useMyHistory } from '../../lib/queries'
import { Card, FilterToggle } from '../../components/Layout'
import { SelectInput } from '../../components/Input'
import { StatusBadge, Chip } from '../../components/Badge'
import { EmptyState, ErrorState, SkeletonTable } from '../../components/Feedback'
import {
  DEFAULT_TIMEZONE,
  endOfMonth,
  formatDate,
  formatHours,
  formatTime,
  formatWeekday,
  hoursBetween,
  monthOptions,
} from '../../utils/format'
import { useTodayKey } from '../../utils/hooks'

export default function StaffHistory() {
  const { profile, timezone = DEFAULT_TIMEZONE } = useAuth()

  const todayKey = useTodayKey(timezone)
  const currentMonth = todayKey.slice(0, 7)

  const [month, setMonth] = useState(currentMonth)
  const [showFilters, setShowFilters] = useState(false)

  const from = `${month}-01`
  const to = month === currentMonth ? todayKey : endOfMonth(`${month}-01`)

  const { data: rows, loading, error, refresh } = useMyHistory(profile?.id, timezone, { from, to })

  const summary = useMemo(() => {
    const list = rows ?? []
    const present = list.filter((r) => r.status === 'present').length
    const late = list.filter((r) => r.status === 'late').length
    const hours = list.reduce((acc, r) => acc + (hoursBetween(r.check_in, r.check_out) ?? 0), 0)
    return { present, late, total: list.length, hours: Math.round(hours * 100) / 100 }
  }, [rows])

  const monthSelect = (
    <SelectInput label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
      {monthOptions().map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </SelectInput>
  )

  return (
    <main className="space-y-4">
      {/* Back button - also available from the bottom nav on mobile */}
      <Link
        to="/staff"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
      >
        <ArrowLeft size={18} aria-hidden="true" /> Back
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">My attendance history</h1>
        <p className="mt-1 text-sm text-slate-500">Your check-in records, newest first.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip tone="brand">Records: {summary.total}</Chip>
        <Chip tone="green">Present: {summary.present}</Chip>
        <Chip tone="amber">Late: {summary.late}</Chip>
        <Chip>Hours: {formatHours(summary.hours)}</Chip>
      </div>

      <FilterToggle open={showFilters} onToggle={() => setShowFilters((v) => !v)} count={month !== currentMonth ? 1 : 0}>
        {monthSelect}
      </FilterToggle>

      <div className="hidden md:block md:max-w-xs">{monthSelect}</div>

      <Card
        title="Records"
        description={`${formatDate(`${from}T12:00:00Z`, 'UTC')} to ${formatDate(`${to}T12:00:00Z`, 'UTC')}`}
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <CalendarDays size={14} aria-hidden="true" /> Sundays are weekly off
          </span>
        }
      >
        {loading ? (
          <SkeletonTable rows={4} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : (rows ?? []).length === 0 ? (
          <EmptyState
            icon={History}
            title="No attendance records"
            description="You have not checked in during this month yet."
          />
        ) : (
          <AttendanceRows rows={rows} timezone={timezone} />
        )}
      </Card>
    </main>
  )
}

function AttendanceRows({ rows, timezone }) {
  return (
    <>
      {/* Stacked cards below md */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{formatDate(row.attendance_date, timezone)}</p>
                <p className="text-xs text-slate-500">{formatWeekday(`${row.attendance_date}T12:00:00Z`, 'UTC')}</p>
              </div>
              <div className="flex flex-col items-end gap-1"><StatusBadge status={row.status} />{row.auto_checked_out ? <span className="text-[10px] font-bold text-slate-500">Auto check-out</span> : null}</div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-sm">
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">In</dt>
                <dd className="truncate font-bold text-slate-800">{formatTime(row.check_in, timezone)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Out</dt>
                <dd className="truncate font-bold text-slate-800">{formatTime(row.check_out, timezone)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Hours</dt>
                <dd className="truncate font-bold text-slate-800">{formatHours(hoursBetween(row.check_in, row.check_out))}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {/* Table from md up */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Your attendance records for the selected month</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2.5 pr-3 font-bold">Date</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Check in</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Check out</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Hours</th>
              <th scope="col" className="py-2.5 pl-3 text-right font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-3">
                  <p className="font-semibold text-slate-900">{formatDate(row.attendance_date, timezone)}</p>
                  <p className="text-xs text-slate-500">{formatWeekday(`${row.attendance_date}T12:00:00Z`, 'UTC')}</p>
                </td>
                <td className="px-3 py-3 font-semibold text-slate-800">{formatTime(row.check_in, timezone)}</td>
                <td className="px-3 py-3 font-semibold text-slate-800">{formatTime(row.check_out, timezone)}</td>
                <td className="px-3 py-3 font-semibold text-slate-800">
                  {formatHours(hoursBetween(row.check_in, row.check_out))}
                </td>
                <td className="py-3 pl-3 text-right">
                  <div className="flex flex-col items-end gap-1"><StatusBadge status={row.status} />{row.auto_checked_out ? <span className="text-[10px] font-bold text-slate-500">Auto check-out</span> : null}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}