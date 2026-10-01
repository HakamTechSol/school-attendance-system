export function Card({ title, description, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title || actions ? (
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`px-4 py-4 md:px-5 ${bodyClassName}`}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function SegmentedControl({ options, value, onChange, ariaLabel, className = '' }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              active ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function FilterToggle({ open, onToggle, count = 0, children }) {
  return (
    <div className="mb-3 lg:hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
      >
        <span>Filters{count > 0 ? ` (${count})` : ''}</span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">{children}</div> : null}
    </div>
  )
}