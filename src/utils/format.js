export const DESIGNATIONS = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'principal', label: 'Principal' },
  { value: 'peon', label: 'Peon' },
  { value: 'driver', label: 'Driver' },
  { value: 'security_guard', label: 'Security Guard' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'student', label: 'Student' },
]

const DESIGNATION_LABELS = Object.fromEntries(DESIGNATIONS.map((d) => [d.value, d.label]))

export const designationLabel = (value) => DESIGNATION_LABELS[value] ?? 'Unassigned'

export const ROLE_LABELS = { admin: 'Administrator', staff: 'Staff' }

export const DEFAULT_TIMEZONE = 'Asia/Karachi'

/** YYYY-MM-DD for a Date, in the given IANA timezone. */
export const toDateKey = (date, timeZone = DEFAULT_TIMEZONE) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

/** YYYY-MM-DD HH:MM:SS (what Postgres' to_char / date_trunc style text needs). */
export const toTimestampString = (date, timeZone = DEFAULT_TIMEZONE) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(',', '')

export const formatTime = (value, timeZone = DEFAULT_TIMEZONE) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(value))
    : '--'

export const formatDate = (value, timeZone = DEFAULT_TIMEZONE) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : '--'

export const formatLongDate = (value, timeZone = DEFAULT_TIMEZONE) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(value))
    : '--'

export const formatWeekday = (value, timeZone = DEFAULT_TIMEZONE) =>
  value
    ? new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long' }).format(new Date(value))
    : '--'

export const formatClock = (date, timeZone = DEFAULT_TIMEZONE) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date)

/** Decimal hours between two ISO timestamps, or null while still checked in. */
export const hoursBetween = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  if (Number.isNaN(ms) || ms < 0) return null
  return Math.round((ms / 3_600_000) * 100) / 100
}

export const formatHours = (hours) => {
  if (hours == null) return '--'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export const formatHoursShort = (hours) => {
  if (hours == null) return '--'
  return `${Number(hours).toFixed(1)}h`
}

export const isSunday = (dateKey) => new Date(`${dateKey}T12:00:00Z`).getUTCDay() === 0

/** Shift a YYYY-MM-DD key by whole days, staying in date space. */
export const addDays = (dateKey, days) => {
  const d = new Date(`${dateKey}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Monday-based start of week for a YYYY-MM-DD key. */
export const startOfWeek = (dateKey) => {
  const d = new Date(`${dateKey}T12:00:00Z`)
  const dow = d.getUTCDay()
  return addDays(dateKey, dow === 0 ? -6 : 1 - dow)
}

export const startOfMonth = (dateKey) => `${dateKey.slice(0, 7)}-01`

export const endOfMonth = (dateKey) => {
  const [y, m] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export const startOfYear = (dateKey) => `${dateKey.slice(0, 4)}-01-01`

export const monthOptions = () => {
  const out = []
  const now = new Date()
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push({
      value: d.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d),
    })
  }
  return out
}

/** Working days (Sundays excluded) between two YYYY-MM-DD keys, inclusive. */
export const countWorkingDays = (fromKey, toKey) => {
  if (!fromKey || !toKey || toKey < fromKey) return 0
  let count = 0
  let cursor = fromKey
  while (cursor <= toKey) {
    if (!isSunday(cursor)) count += 1
    cursor = addDays(cursor, 1)
  }
  return count
}

export const percentage = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0)

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

export const titleCase = (value = '') => value.replace(/\b\w/g, (c) => c.toUpperCase())

export const STATUS_STYLES = {
  present: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  late: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  absent: 'bg-rose-100 text-rose-800 ring-rose-600/20',
}

export const downloadCsv = (filename, rows) => {
  if (typeof rows === 'string') {
    const blob = new Blob([`\uFEFF${rows}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return
  }

  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (cell) => {
    const s = cell == null ? '' : String(cell)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n')
  downloadCsv(filename, csv)
}