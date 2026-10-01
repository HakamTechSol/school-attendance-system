import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'
import { useBodyScrollLock } from '../utils/hooks'

/**
 * Bottom sheet on mobile (< md), centred dialog from md up.
 * Traps focus loosely, closes on Escape, locks background scroll.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panelRef = useRef(null)
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Move focus into the dialog for screen readers / keyboards.
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector(
        'input, select, textarea, button:not([aria-label="Close dialog"])',
      )
      focusable?.focus()
    }, 40)
    return () => {
      document.removeEventListener('keydown', onKey)
      clearTimeout(timer)
    }
  }, [open, onClose])

  if (!open) return null

  const widths = { sm: 'md:max-w-sm', md: 'md:max-w-lg', lg: 'md:max-w-2xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl md:max-h-[88dvh] md:rounded-2xl ${
          widths[size] ?? widths.md
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 md:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
          </div>
          <IconButton label="Close dialog" onClick={onClose} className="-mr-2">
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">{children}</div>

        {footer ? (
          <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 pb-safe md:rounded-b-2xl md:px-5 md:pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="min-h-11 flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
    </Modal>
  )
}