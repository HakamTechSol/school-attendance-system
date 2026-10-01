export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  type = 'button',
  ...props
}) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
    dark: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-400',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300',
    outline:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-400',
    ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300',
  }

  const sizes = {
    // All interactive sizes clear the 44px minimum touch target.
    sm: 'min-h-11 px-3 py-2 text-sm',
    md: 'min-h-11 px-4 py-2.5 text-sm',
    lg: 'min-h-12 px-5 py-3 text-base',
    xl: 'min-h-16 px-6 py-4 text-lg',
  }

  return (
    <button
      type={type}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${
        variants[variant] ?? variants.primary
      } ${sizes[size] ?? sizes.md} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? <SpinnerDot /> : null}
      {children}
    </button>
  )
}

function SpinnerDot() {
  return (
    <svg className="animate-spin" width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-30" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function IconButton({ label, children, variant = 'ghost', className = '', ...props }) {
  const variants = {
    ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
    danger: 'text-rose-600 hover:bg-rose-50 active:bg-rose-100',
    onDark: 'text-slate-300 hover:bg-white/10 active:bg-white/20',
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
        variants[variant] ?? variants.ghost
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}