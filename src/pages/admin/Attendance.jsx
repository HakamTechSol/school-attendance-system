import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'
import { useAuth } from '../../context/auth'
import { useAttendanceLogs } from '../../lib/queries'
import { PageHeader, Card, FilterToggle } from '../../components/Layout'
import { Button } from '../../components/Button'
import { TextInput, SelectInput } from '../../components/Input'
import { StatusBadge, DesignationBadge, Chip } from '../../components/Badge'
import { EmptyState, ErrorState, SkeletonTable } from '../../components/Feedback'
import { useTodayKey } from '../../utils/hooks'
import {
  DEFAULT_TIMEZONE,
  DESIGNATIONS,
  addDays,
  formatDate,
  formatHours,
  formatTime,
  formatWeekday,
  hoursBetween,
} from '../../utils/format'

export default function Attendance() {
  const { timezone = DEFAULT_TIMEZONE } = useAuth()

  const todayKey = useTodayKey(timezone)
  const defaultFrom = addDays(todayKey, -30)

  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(todayKey)
  const [designation, setDesignation] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  const filters = useMemo(
    () => ({ from, to, designation, status, search: search.trim(), todayKey }),
    [from, to, designation, status, search, todayKey],
  )

  const { data, loading, error, refresh, pageSize } = useAttendanceLogs(filters, page)
  const rows = data?.rows ?? []
  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Filter changes reset to page 1; clamping keeps the page valid.
  const filterSignature = `${from}|${to}|${designation}|${status}|${search}`
  const [lastSignature, setLastSignature] = useState(filterSignature)
  if (filterSignature !== lastSignature) {
    setLastSignature(filterSignature)
    setPage(1)
  }
  const safePage = Math.min(page, totalPages)

  const resetFilters = () => {
    setFrom(defaultFrom)
    setTo(todayKey)
    setDesignation('')
    setStatus('')
    setSearch('')
  }

  const activeFilterCount =
    (designation ? 1 : 0) +
    (status ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (from !== defaultFrom || to !== todayKey ? 1 : 0)

  const filterFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <TextInput label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <TextInput label="To" type="date" value={to} min={from} max={todayKey} onChange={(e) => setTo(e.target.value)} />
      </div>
      <SelectInput label="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)}>
        <option value="">All designations</option>
        {DESIGNATIONS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </SelectInput>
      <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>
        <option value="present">Present</option>
        <option value="late">Late</option>
      </SelectInput>
      <TextInput
        label="Search staff"
        type="search"
        inputMode="search"
        placeholder="Name contains..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button
        type="button"
        onClick={resetFilters}
        className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Reset filters
      </button>
    </div>
  )

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Every staff check-in and check-out record."
        actions={<Chip tone="brand">{total} record{total === 1 ? '' : 's'}</Chip>}
      />

      <FilterToggle open={showFilters} onToggle={() => setShowFilters((v) => !v)} count={activeFilterCount}>
        {filterFields}
      </FilterToggle>

      <div className="mb-4 hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
        <div className="grid gap-3 lg:grid-cols-5">
          <TextInput label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <TextInput label="To" type="date" value={to} min={from} max={todayKey} onChange={(e) => setTo(e.target.value)} />
          <SelectInput label="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)}>
            <option value="">All designations</option>
            {DESIGNATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </SelectInput>
          <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
          </SelectInput>
          <TextInput
            label="Search staff"
            type="search"
            placeholder="Name contains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Page {safePage} of {totalPages} - {pageSize} rows per page
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      <Card
        title="Records"
        description={`${formatDate(`${from}T12:00:00Z`, 'UTC')} to ${formatDate(`${to}T12:00:00Z`, 'UTC')}`}
        actions={
          activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              <X size={16} aria-hidden="true" /> Clear
            </button>
          ) : null
        }
      >
        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No records match these filters"
            description="Try adjusting the date range or clearing the filters."
            action={
              <Button variant="outline" onClick={resetFilters}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <>
            <AttendanceRows rows={rows} timezone={timezone} />
            <Pagination page={safePage} totalPages={totalPages} total={total} onChange={setPage} />
          </>
        )}
      </Card>
    </>
  )
}

function AttendanceRows({ rows, timezone }) {
  return (
    <>
      {/* Cards: name + designation lead, details follow */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-slate-900">{row.full_name}</p>
                <div className="mt-1">
                  <DesignationBadge designation={row.designation} />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1"><StatusBadge status={row.status} />{row.auto_checked_out ? <span className="text-[10px] font-bold text-slate-500">Auto check-out</span> : null}</div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {formatDate(row.attendance_date, timezone)} -{' '}
              {formatWeekday(`${row.attendance_date}T12:00:00Z`, 'UTC')}
            </p>
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

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Attendance records for your school</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2.5 pr-3 font-bold">Staff name</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Designation</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Date</th>
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
                  <span className="block truncate text-sm font-bold text-slate-900">{row.full_name}</span>
                </td>
                <td className="px-3 py-3">
                  <DesignationBadge designation={row.designation} />
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <p className="font-semibold text-slate-800">{formatDate(row.attendance_date, timezone)}</p>
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

function Pagination({ page, totalPages, total, onChange }) {
  return (
    <nav
      className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Pagination"
    >
      <p className="text-xs text-slate-500">
        Showing page {page} of {totalPages} - {total} total records
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1} className="sm:hidden">
          <ChevronLeft size={18} aria-hidden="true" /> Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="sm:hidden"
        >
          Next <ChevronRight size={18} aria-hidden="true" />
        </Button>

        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          {pageNumbers(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`h-11 min-w-11 rounded-xl border px-3 text-sm font-bold transition-colors ${
                  p === page
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={page >= totalPages}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  )
}

function pageNumbers(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const set = new Set([1, totalPages, page, page - 1, page + 1])
  const sorted = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b)
  const out = []
  let prev = 0
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push('...')
    out.push(n)
    prev = n
  }
  return out
}