import { useCallback, useMemo, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { ToastContext } from './toast'

const VARIANTS = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-800', ring: 'ring-emerald-200' },
  error: { icon: AlertCircle, bg: 'bg-rose-50', text: 'text-rose-800', ring: 'ring-rose-200' },
  info: { icon: Info, bg: 'bg-sky-50', text: 'text-sky-800', ring: 'ring-sky-200' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, variant = 'info') => {
      idRef.current += 1
      const id = idRef.current
      setToasts((current) => [...current.slice(-2), { id, message: String(message), variant }])
      setTimeout(() => dismiss(id), 4500)
      return id
    },
    [dismiss],
  )

  const toast = useMemo(
    () => ({
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-3 pb-safe-lg sm:bottom-4 sm:right-4 sm:left-auto sm:items-end sm:px-0 sm:pb-0"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => {
          const v = VARIANTS[t.variant] ?? VARIANTS.info
          const Icon = v.icon
          return (
            <div
              key={t.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 shadow-lg ring-1 sm:w-96 ${v.bg} ${v.ring}`}
            >
              <Icon size={20} className={`mt-0.5 shrink-0 ${v.text}`} aria-hidden="true" />
              <p className={`min-w-0 flex-1 text-sm leading-snug ${v.text}`}>{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="-m-1 shrink-0 rounded-lg p-1 text-slate-500 hover:bg-black/5 hover:text-slate-800"
                aria-label="Dismiss notification"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}