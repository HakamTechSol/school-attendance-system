export function Spinner({ size = 20, className = '' }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-100" role="status">
      <Spinner size={32} className="text-brand-600" />
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  )
}

export function SkeletonLine({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <SkeletonLine className="h-3 w-20" />
      <SkeletonLine className="mt-3 h-8 w-24" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
          <SkeletonLine className="h-4 w-2/3" />
          <SkeletonLine className="mt-2 h-3 w-1/3" />
        </div>
      ))}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonLine key={c} className="h-3 w-full" />
            ))}
          </div>
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="border-b border-slate-100 px-4 py-4 last:border-0">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {Array.from({ length: cols }).map((_, c) => (
                <SkeletonLine key={c} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {Icon ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Icon size={24} aria-hidden="true" />
        </span>
      ) : null}
      <div>
        <p className="text-base font-semibold text-slate-800">{title}</p>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center"
    >
      <p className="text-sm font-medium text-rose-800">{message || 'Something went wrong.'}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}