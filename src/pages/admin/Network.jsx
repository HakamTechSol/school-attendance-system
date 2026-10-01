import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Globe,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { useAuth } from '../../context/auth'
import { useToast } from '../../context/toast'
import {
  useAllowedIps,
  useMyIp,
  useSchoolSettings,
  useSaveAttendanceSchedule,
  useToggleIpRestriction,
  useAddIp,
  useDeleteIp,
  normaliseCidr,
  validateCidr,
} from '../../lib/ipHooks'
import { friendlyMessage } from '../../lib/attendanceActions'
import { PageHeader, Card } from '../../components/Layout'
import { Button, IconButton } from '../../components/Button'
import { TextInput } from '../../components/Input'
import { ConfirmDialog } from '../../components/Modal'
import { Chip } from '../../components/Badge'
import { EmptyState, ErrorState, SkeletonTable } from '../../components/Feedback'
import { formatDate } from '../../utils/format'

export default function Network() {
  const { school, timezone } = useAuth()
  const toast = useToast()

  const settings = useSchoolSettings(school?.id)
  const ips = useAllowedIps(timezone)
  const myIp = useMyIp(timezone)
  const { setEnabled, saving: savingToggle } = useToggleIpRestriction(school?.id)
  const { add, saving: savingAdd } = useAddIp(school?.id)
  const { remove, saving: savingDelete } = useDeleteIp()

  const [values, setValues] = useState({ ip: '', label: '' })
  const [errors, setErrors] = useState({})
  const [deleting, setDeleting] = useState(null)

  const enabled = Boolean(settings.data?.ip_restriction_enabled)
  const list = ips.data ?? []
  const hasIps = list.length > 0

  const refreshAll = () => {
    settings.refresh()
    ips.refresh()
  }

  const handleToggle = async (next) => {
    // Refuse to lock everybody out of an empty allow list.
    if (next && !hasIps) {
      toast.error('Add at least one IP first, otherwise everyone will be locked out.')
      return
    }
    try {
      await setEnabled(next)
      settings.refresh()
      toast.success(
        next
          ? 'IP restriction is on. Staff can only check in from an approved IP.'
          : 'IP restriction is off. Anyone can check in from any IP.',
      )
    } catch (err) {
      toast.error(friendlyMessage(err?.message))
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (savingAdd) return

    const normalised = normaliseCidr(values.ip)
    const invalid = validateCidr(normalised)
    if (invalid) {
      setErrors({ ip: invalid })
      return
    }

    setErrors({})
    try {
      const saved = await add(normalised, values.label)
      toast.success(`${saved} has been added.`)
      setValues({ ip: '', label: '' })
      refreshAll()
    } catch (err) {
      toast.error(friendlyMessage(err?.message))
    }
  }

  const addMyIp = async () => {
    if (!myIp.ip) {
      toast.error('We could not detect your IP. Please add it manually.')
      return
    }
    try {
      const saved = await add(myIp.ip, 'My current IP')
      toast.success(`${saved} has been added.`)
      refreshAll()
    } catch (err) {
      toast.error(friendlyMessage(err?.message))
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await remove(deleting.id)
      toast.success(`${deleting.ip_cidr} has been removed.`)
      setDeleting(null)
      refreshAll()
    } catch (err) {
      toast.error(friendlyMessage(err?.message))
    }
  }

  return (
    <>
      <PageHeader
        title="Network"
        description="Allow attendance to be marked only from approved school IPs."
        actions={
          <Chip tone={enabled ? 'green' : 'slate'}>{enabled ? 'Restriction ON' : 'Restriction OFF'}</Chip>
        }
      />

      <AttendanceSchedule settings={settings} schoolId={school?.id} timezone={timezone} />

      {/* Master switch */}
      <Card className="mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-900">Only allow attendance from approved IPs</p>
            <p className="mt-1 text-sm text-slate-500">
              When enabled, staff can only check in and check out from allowed IPs.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Only allow attendance from approved IPs"
            disabled={savingToggle}
            onClick={() => handleToggle(!enabled)}
            className={`flex h-11 w-16 shrink-0 items-center rounded-full p-1 transition-colors disabled:opacity-50 ${
              enabled ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`h-9 w-9 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {!enabled ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <Info size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            No restriction is active right now - any staff member can check in from anywhere.
          </p>
        ) : !hasIps ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-800"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" />
            Add your current IP first or everyone will be locked out. The list is currently empty,
            so staff could be locked out.
          </p>
        ) : (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
            {hasIps} approved IP(s) currently allow attendance.
          </p>
        )}
      </Card>

      {/* Your current IP */}
      <Card className="mb-4" title="Your current IP" description="The IP address this page was opened from.">
        {myIp.loading ? (
          <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
        ) : myIp.error ? (
          <ErrorState message={myIp.error} onRetry={myIp.refresh} />
        ) : myIp.ip ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 font-mono text-base font-bold text-slate-900">
              <Globe size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              {myIp.ip}
            </p>
            <Button onClick={addMyIp} disabled={savingAdd} loading={savingAdd}>
              <Plus size={16} aria-hidden="true" /> Add this IP
            </Button>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-sm text-slate-500">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
            We could not detect your IP. Add it manually using the form below.
          </p>
        )}
      </Card>

      {/* Add IP form */}
      <Card
        className="mb-4"
        title="Add an IP or range"
        description="Single IP (1.2.3.4) ya range (103.5.6.0/24)."
      >
        <form onSubmit={handleAdd} className="space-y-3" noValidate>
          <TextInput
            label="IP address or range"
            value={values.ip}
            onChange={(e) => {
              setValues((v) => ({ ...v, ip: e.target.value }))
              setErrors((prev) => ({ ...prev, ip: undefined }))
            }}
            error={errors.ip}
            placeholder="1.2.3.4 ya 103.5.6.0/24"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            inputMode="text"
            required
          />
          <TextInput
            label="Label (optional)"
            value={values.label}
            onChange={(e) => setValues((v) => ({ ...v, label: e.target.value }))}
            placeholder="Main Campus WiFi"
          />
          <Button type="submit" fullWidth loading={savingAdd} disabled={!values.ip.trim() || savingAdd}>
            <Plus size={16} aria-hidden="true" /> Add IP
          </Button>
        </form>
      </Card>

      {/* Allowed list */}
      <Card title="Approved IPs" description={`${list.length} entr${list.length === 1 ? 'y' : 'ies'}`}>
        {ips.loading ? (
          <SkeletonTable rows={3} cols={3} />
        ) : ips.error ? (
          <ErrorState message={ips.error} onRetry={ips.refresh} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No approved IPs yet"
            description="Add your current IP above, or enter a range manually."
          />
        ) : (
          <IpRows rows={list} timezone={timezone} onDelete={(row) => setDeleting(row)} />
        )}
      </Card>

      {/* Caveats */}
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
          <AlertTriangle size={16} aria-hidden="true" /> Important notes
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-amber-900">
          <li>
            A school's internet IP changes frequently (dynamic IP), which can block staff without warning.
          </li>
          <li>Request a static IP from your ISP, or add their whole IP range.</li>
          <li>With the restriction on, check-in will be blocked on mobile data.</li>
          <li>IPv6 is supported, but many networks still hand out IPv4.</li>
        </ul>
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={savingDelete}
        title="Remove approved IP"
        confirmLabel="Remove"
        message={
          deleting
            ? `${deleting.ip_cidr} will be removed from the list? If this is your own IP, you could lock yourself out.`
            : ''
        }
      />
    </>
  )
}

function IpRows({ rows, timezone, onDelete }) {
  return (
    <>
      {/* Cards on mobile */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-bold text-slate-900">{row.ip_cidr}</p>
              <p className="truncate text-xs text-slate-600">{row.label || 'No label'}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">Added {formatDate(row.created_at, timezone)}</p>
            </div>
            <IconButton label={`Remove ${row.ip_cidr}`} variant="danger" onClick={() => onDelete(row)}>
              <Trash2 size={18} aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>

      {/* Table on md+ */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">Approved IP addresses for your school</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2.5 pr-3 font-bold">Label</th>
              <th scope="col" className="px-3 py-2.5 font-bold">IP / range</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Date added</th>
              <th scope="col" className="py-2.5 pl-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="max-w-[220px] py-3 pr-3">
                  <span className="block truncate font-semibold text-slate-900">{row.label || 'No label'}</span>
                </td>
                <td className="px-3 py-3">
                  <span className="font-mono text-slate-800">{row.ip_cidr}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                  {formatDate(row.created_at, timezone)}
                </td>
                <td className="py-3 pl-3">
                  <div className="flex justify-end">
                    <IconButton label={`Remove ${row.ip_cidr}`} variant="danger" onClick={() => onDelete(row)}>
                      <Trash2 size={18} aria-hidden="true" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function AttendanceSchedule({ settings, schoolId, timezone }) {
  const toast = useToast()
  const { save, saving } = useSaveAttendanceSchedule(schoolId)
  const [form, setForm] = useState({ check_in_start: '07:00', late_after: '08:00', auto_checkout_at: '17:00' })

  useEffect(() => {
    if (settings.data) setForm({
      check_in_start: String(settings.data.check_in_start ?? '07:00').slice(0, 5),
      late_after: String(settings.data.late_after ?? '08:00').slice(0, 5),
      auto_checkout_at: String(settings.data.auto_checkout_at ?? '17:00').slice(0, 5),
    })
  }, [settings.data])

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    if (!(form.check_in_start < form.late_after && form.late_after < form.auto_checkout_at)) {
      toast.error('Times must be ordered: check-in opens, late cutoff, then shift end.')
      return
    }
    try {
      await save(form)
      await settings.refresh()
      toast.success('Attendance schedule saved.')
    } catch (error) {
      toast.error(friendlyMessage(error?.message))
    }
  }

  return (
    <Card className="mb-4" title="Attendance schedule" description={"School timezone: " + timezone + ". Late status begins after the late cutoff."}>
      <form onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold text-slate-700">
            Check-in opens
            <input type="time" required value={form.check_in_start} onChange={(event) => change('check_in_start', event.target.value)}
              className="mt-1.5 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Late after
            <input type="time" required value={form.late_after} onChange={(event) => change('late_after', event.target.value)}
              className="mt-1.5 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Shift ends / auto check-out
            <input type="time" required value={form.auto_checkout_at} onChange={(event) => change('auto_checkout_at', event.target.value)}
              className="mt-1.5 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base" />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">Staff may check out any time before shift end. Open attendance records are automatically checked out at shift end.</p>
        <Button type="submit" loading={saving} disabled={settings.loading} className="mt-4">Save schedule</Button>
      </form>
    </Card>
  )
}
