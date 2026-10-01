import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const baseField =
  'block w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:bg-slate-100 disabled:text-slate-500'

export function Label({ htmlFor, children, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
        {children}
      </label>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </div>
  )
}

export function TextInput({ label, error, hint, id, className = '', inputClassName = '', children, ...props }) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={inputId} hint={hint}>
          {label}
        </Label>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`${baseField} ${inputClassName} ${
            error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''
          }`}
          {...props}
        />
        {children}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-xs font-medium text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function SelectInput({ label, error, hint, id, children, className = '', ...props }) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={selectId} hint={hint}>
          {label}
        </Label>
      ) : null}
      <select
        id={selectId}
        aria-invalid={error ? 'true' : undefined}
        className={`${baseField} appearance-none bg-[length:16px] pr-8 ${
          error ? 'border-rose-400' : ''
        }`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.65rem center',
        }}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  )
}

export function PasswordInput({ label, error, hint, id, ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <TextInput
      label={label}
      error={error}
      hint={hint}
      id={id}
      type={visible ? 'text' : 'password'}
      autoComplete="new-password"
      className="relative"
      inputClassName="pr-12"
      {...props}
    >
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? `Hide ${label ?? 'password'}` : `Show ${label ?? 'password'}`}
        aria-pressed={visible}
        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:text-slate-800"
      >
        {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </TextInput>
  )
}