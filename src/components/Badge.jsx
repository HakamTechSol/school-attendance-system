import { STATUS_STYLES, designationLabel } from '../utils/format'

export function StatusBadge({ status, className = '' }) {
  const label = status === 'late' ? 'Late' : status === 'absent' ? 'Absent' : 'Present'
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.present
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-inset ${styles} ${className}`}
    >
      {label}
    </span>
  )
}

export function DesignationBadge({ designation, className = '' }) {
  if (!designation) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-300 ${className}`}
      >
        Unassigned
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-200 ${className}`}
    >
      {designationLabel(designation)}
    </span>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white ring-slate-200 text-slate-900',
    brand: 'bg-white ring-brand-200 text-brand-800',
    green: 'bg-white ring-emerald-200 text-emerald-800',
    amber: 'bg-white ring-amber-200 text-amber-800',
    rose: 'bg-white ring-rose-200 text-rose-800',
  }
  const iconTones = {
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  }

  return (
    <div className={`rounded-2xl p-4 shadow-sm ring-1 ${tones[tone] ?? tones.slate}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon ? (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTones[tone]}`}>
            <Icon size={16} aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function Chip({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-300',
    brand: 'bg-brand-50 text-brand-800 ring-brand-200',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    rose: 'bg-rose-50 text-rose-800 ring-rose-200',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${
        tones[tone] ?? tones.slate
      }`}
    >
      {children}
    </span>
  )
}