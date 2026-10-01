import { useMemo, useState } from 'react'
import { Download, CalendarRange, Users, Filter } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { useAuth } from '../../context/auth'
import { useAttendanceReport } from '../../lib/queries'
import { PageHeader, Card, SegmentedControl, FilterToggle } from '../../components/Layout'
import { Button } from '../../components/Button'
import { SelectInput } from '../../components/Input'
import { StatCard } from '../../components/Badge'
import { DesignationBadge } from '../../components/Badge'
import { EmptyState, ErrorState, SkeletonTable } from '../../components/Feedback'
import { usePageTitle, useTodayKey } from '../../utils/hooks'
import {
  DEFAULT_TIMEZONE,
  DESIGNATIONS,
  addDays,
  countWorkingDays,
  designationLabel,
  downloadCsv,
  endOfMonth,
  formatDate,
  percentage,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from '../../utils/format'

const TABS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

export default function Reports() {
  usePageTitle('Reports')
  const { timezone = DEFAULT_TIMEZONE } = useAuth()

  const todayKey = useTodayKey(timezone)
  const [tab, setTab] = useState('month')
  const [designation, setDesignation] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [anchor, setAnchor] = useState(todayKey)

  // Ranges are computed in the school timezone; the server clips "to" to today.
  const range = useMemo(() => {
    switch (tab) {
      case 'day':
        return { from: anchor, to: anchor }
      case 'week':
        return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) }
      case 'month':
        return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
      case 'year':
        return { from: startOfYear(anchor), to: `${anchor.slice(0, 4)}-12-31` }
      default:
        return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
    }
  }, [tab, anchor])

  const { data: rows, loading, error, refresh } = useAttendanceReport(range.from, range.to, designation)

  const reportRows = useMemo(() => rows ?? [], [rows])

  const summary = useMemo(() => {
    const present = reportRows.reduce((a, r) => a + (r.present_days ?? 0), 0)
    const late = reportRows.reduce((a, r) => a + (r.late_days ?? 0), 0)
    const absent = reportRows.reduce((a, r) => a + (r.absent_days ?? 0), 0)
    const workingDays = countWorkingDays(range.from, range.to > todayKey ? todayKey : range.to)
    const possible = reportRows.length * workingDays
    return {
      staff: reportRows.length,
      present,
      late,
      absent,
      workingDays,
      possible,
      rate: percentage(present + late, possible),
    }
  }, [reportRows, range, todayKey])

  const chartData = useMemo(
    () =>
      reportRows.slice(0, 10).map((r) => ({
        name: r.full_name?.split(' ')[0] || r.full_name,
        fullName: r.full_name,
        Present: r.present_days ?? 0,
        Late: r.late_days ?? 0,
        Absent: r.absent_days ?? 0,
      })),
    [reportRows],
  )

  const exportCsv = () => {
    const data = reportRows.map((r) => {
      const possible = (r.present_days ?? 0) + (r.late_days ?? 0) + (r.absent_days ?? 0)
      return {
        Name: r.full_name,
        Designation: designationLabel(r.designation),
        Present: r.present_days ?? 0,
        Late: r.late_days ?? 0,
        Absent: r.absent_days ?? 0,
        'Attendance %': `${percentage((r.present_days ?? 0) + (r.late_days ?? 0), possible)}%`,
      }
    })
    downloadCsv(`attendance-report-${range.from}-to-${range.to}.csv`, data)
  }

  const designationSelect = (
    <SelectInput label="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)}>
      <option value="">All designations</option>
      {DESIGNATIONS.map((d) => (
        <option key={d.value} value={d.value}>
          {d.label}
        </option>
      ))}
    </SelectInput>
  )

  const anchorInput = (
    <div>
      <label
        htmlFor="report-anchor"
        className="mb-1.5 block text-sm font-semibold text-slate-700"
      >
        {tab === 'year' ? 'Year' : 'Date'}
      </label>
      <input
        id="report-anchor"
        type={tab === 'year' ? 'number' : 'date'}
        inputMode={tab === 'year' ? 'numeric' : undefined}
        min={tab === 'year' ? '2000' : undefined}
        max={tab === 'year' ? undefined : todayKey}
        value={tab === 'year' ? anchor.slice(0, 4) : anchor}
        onChange={(e) => {
          const next = e.target.value
          if (!next) return
          setAnchor(tab === 'year' ? `${next}-01-01` : next)
        }}
        className="block w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
    </div>
  )

  return (
    <>
      <PageHeader
        title="Attendance reports"
        description={`${formatDate(`${range.from}T12:00:00Z`, 'UTC')} to ${formatDate(`${range.to}T12:00:00Z`, 'UTC')} - Sundays excluded - future days ignored`}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={reportRows.length === 0}>
            <Download size={16} aria-hidden="true" /> Export CSV
          </Button>
        }
      />

      <SegmentedControl
        options={TABS}
        value={tab}
        onChange={setTab}
        ariaLabel="Report period"
        className="mb-3"
      />

      <FilterToggle
        open={showFilters}
        onToggle={() => setShowFilters((v) => !v)}
        count={(designation ? 1 : 0) + (anchor !== todayKey ? 1 : 0)}
      >
        <div className="space-y-3">
          {anchorInput}
          {designationSelect}
          <button
            type="button"
            onClick={() => {
              setDesignation('')
              setAnchor(todayKey)
            }}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset to today
          </button>
        </div>
      </FilterToggle>

      <div className="mb-4 hidden gap-3 md:flex md:items-end">
        <div className="w-56">{anchorInput}</div>
        <div className="w-56">{designationSelect}</div>
        <Button variant="outline" onClick={() => { setDesignation(''); setAnchor(todayKey) }} className="mb-0.5">
          Reset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Staff counted" value={summary.staff} icon={Users} tone="slate" />
        <StatCard label="Present days" value={summary.present} icon={CalendarRange} tone="green" />
        <StatCard label="Late days" value={summary.late} tone="amber" />
        <StatCard label="Absent days" value={summary.absent} tone="rose" hint={`${summary.workingDays} working day(s)`} />
      </div>

      {reportRows.length > 0 ? (
        <Card className="mt-4" title="Attendance by staff" description="First 10 staff, in school timezone">
          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  labelFormatter={(label) => chartData.find((d) => d.name === label)?.fullName ?? label}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Present" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Late" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Absent" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}

      <Card className="mt-4" title="Detailed report" description="Working days only (Sundays are weekly off)">
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : reportRows.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No staff to report on"
            description="Add staff accounts first, or clear the designation filter."
          />
        ) : (
          <ReportRows rows={reportRows} />
        )}
      </Card>
    </>
  )
}

function ReportRows({ rows }) {
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => {
          const possible = (row.present_days ?? 0) + (row.late_days ?? 0) + (row.absent_days ?? 0)
          const pct = percentage((row.present_days ?? 0) + (row.late_days ?? 0), possible)
          return (
            <li key={row.staff_id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{row.full_name}</p>
                <span className="shrink-0 text-sm font-bold text-slate-700">{pct}%</span>
              </div>
              <div className="mt-1">
                <DesignationBadge designation={row.designation} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Present</dt>
                  <dd className="font-bold text-slate-800">{row.present_days ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Late</dt>
                  <dd className="font-bold text-slate-800">{row.late_days ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">Absent</dt>
                  <dd className="font-bold text-slate-800">{row.absent_days ?? 0}</dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] text-left text-sm">
          <caption className="sr-only">Attendance report per staff member</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2.5 pr-3 font-bold">Name</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Designation</th>
              <th scope="col" className="px-3 py-2.5 text-right font-bold">Present</th>
              <th scope="col" className="px-3 py-2.5 text-right font-bold">Late</th>
              <th scope="col" className="px-3 py-2.5 text-right font-bold">Absent</th>
              <th scope="col" className="py-2.5 pl-3 text-right font-bold">Attendance %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const possible = (row.present_days ?? 0) + (row.late_days ?? 0) + (row.absent_days ?? 0)
              const pct = percentage((row.present_days ?? 0) + (row.late_days ?? 0), possible)
              return (
                <tr key={row.staff_id} className="border-b border-slate-100 last:border-0">
                  <td className="max-w-[220px] py-3 pr-3">
                    <span className="block truncate font-semibold text-slate-900">{row.full_name}</span>
                  </td>
                  <td className="px-3 py-3"><DesignationBadge designation={row.designation} /></td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-700">{row.present_days ?? 0}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-amber-700">{row.late_days ?? 0}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-rose-700">{row.absent_days ?? 0}</td>
                  <td className="py-3 pl-3 text-right font-bold tabular-nums text-slate-900">{pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}