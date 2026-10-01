import { useMemo, useState } from 'react'
import { Users, Plus, Pencil, Trash2, Filter, Mail, UserX } from 'lucide-react'
import { useAuth } from '../../context/auth'
import { useToast } from '../../context/toast'
import { supabase } from '../../lib/supabase'
import { useStaffList } from '../../lib/queries'
import { friendlyMessage } from '../../lib/attendanceActions'
import { PageHeader, Card, FilterToggle } from '../../components/Layout'
import { Button, IconButton } from '../../components/Button'
import { TextInput, SelectInput, PasswordInput } from '../../components/Input'
import { Modal, ConfirmDialog } from '../../components/Modal'
import { DesignationBadge, Chip } from '../../components/Badge'
import { EmptyState, ErrorState, SkeletonTable } from '../../components/Feedback'
import { usePageTitle } from '../../utils/hooks'
import { DESIGNATIONS, initials } from '../../utils/format'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function StaffManagement() {
  usePageTitle('Staff')
  const { school } = useAuth()
  const toast = useToast()

  const { data: staff, loading, error, refresh } = useStaffList(school?.id)

  const [search, setSearch] = useState('')
  const [designation, setDesignation] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const staffList = useMemo(() => staff ?? [], [staff])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return staffList.filter((person) => {
      const matchesDesignation = !designation || person.designation === designation
      const matchesSearch =
        !q || person.full_name?.toLowerCase().includes(q) || person.email?.toLowerCase().includes(q)
      return matchesDesignation && matchesSearch
    })
  }, [staffList, search, designation])

  const activeFilterCount = (designation ? 1 : 0) + (search.trim() ? 1 : 0)

  const handleCreate = async (values) => {
    const { data, error: invokeErr } = await supabase.functions.invoke('manage-staff', {
      body: {
        email: values.email.trim(),
        password: values.password,
        full_name: values.full_name.trim(),
        designation: values.designation,
      },
    })
    if (invokeErr) throw new Error(invokeErr.message)
    if (data?.error) throw new Error(data.error)
    toast.success(`${values.full_name} can now sign in.`)
    refresh()
  }

  const handleUpdate = async (values) => {
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ full_name: values.full_name.trim(), designation: values.designation || null })
      .eq('id', values.id)
    if (updateErr) throw new Error(updateErr.message)
    toast.success('Staff details updated.')
    refresh()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'delete', id: deleting.id },
      })
      if (invokeErr) throw new Error(invokeErr.message)
      if (data?.error) throw new Error(data.error)
      toast.success(`${deleting.full_name} was removed.`)
      setDeleting(null)
      refresh()
    } catch (err) {
      toast.error(friendlyMessage(err?.message))
    } finally {
      setDeleteBusy(false)
    }
  }

  const designationSelect = (
    <SelectInput
      label="Designation"
      value={designation}
      onChange={(e) => setDesignation(e.target.value)}
    >
      <option value="">All designations</option>
      {DESIGNATIONS.map((d) => (
        <option key={d.value} value={d.value}>
          {d.label}
        </option>
      ))}
    </SelectInput>
  )

  return (
    <>
      <PageHeader
        title="Staff"
        description={`${staffList.length} account${staffList.length === 1 ? '' : 's'} in ${school?.name ?? 'this school'}`}
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={18} aria-hidden="true" /> Add staff
          </Button>
        }
      />

      <Card
        title="Staff directory"
        description="Search by name or email, filter by designation."
        actions={
          <Chip tone="brand">
            Showing {filtered.length} of {staffList.length}
          </Chip>
        }
      >
        {/* Mobile search always visible; filters collapse */}
        <div className="mb-3 md:hidden">
          <TextInput
            label="Search"
            type="search"
            inputMode="search"
            placeholder="Name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <FilterToggle open={showFilters} onToggle={() => setShowFilters((v) => !v)} count={activeFilterCount}>
          <div className="space-y-3">
            <TextInput
              label="Search"
              type="search"
              inputMode="search"
              placeholder="Name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {designationSelect}
          </div>
        </FilterToggle>

        <div className="mb-4 hidden gap-3 md:flex md:items-end">
          <div className="flex-1">
            <TextInput
              label="Search"
              type="search"
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-56">{designationSelect}</div>
        </div>

        {loading ? (
          <SkeletonTable rows={4} cols={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : staffList.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff yet"
            description="Add your first staff member to start tracking attendance."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus size={16} aria-hidden="true" /> Add staff
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No matching staff"
            description="Try a different search term or clear the designation filter."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setDesignation('')
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <StaffRows
            staff={filtered}
            onEdit={(person) => setEditing(person)}
            onDelete={(person) => setDeleting(person)}
          />
        )}
      </Card>

      <StaffFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
      />

      <StaffFormModal
        open={Boolean(editing)}
        mode="edit"
        person={editing}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteBusy}
        title="Delete staff account"
        confirmLabel="Delete"
        message={
          deleting
            ? `This permanently removes ${deleting.full_name} and all of their attendance records. This cannot be undone.`
            : ''
        }
      />
    </>
  )
}

function StaffRows({ staff, onEdit, onDelete }) {
  return (
    <>
      {/* Cards on mobile */}
      <ul className="space-y-3 md:hidden">
        {staff.map((person) => (
          <li key={person.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                {initials(person.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{person.full_name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                  <Mail size={12} aria-hidden="true" />
                  <span className="truncate">{person.email}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
              <DesignationBadge designation={person.designation} />
              <div className="flex gap-1">
                <IconButton label={`Edit ${person.full_name}`} onClick={() => onEdit(person)}>
                  <Pencil size={18} aria-hidden="true" />
                </IconButton>
                <IconButton label={`Delete ${person.full_name}`} variant="danger" onClick={() => onDelete(person)}>
                  <Trash2 size={18} aria-hidden="true" />
                </IconButton>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Table on md+ */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Staff accounts in your school</caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2.5 pr-3 font-bold">Name</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Email</th>
              <th scope="col" className="px-3 py-2.5 font-bold">Designation</th>
              <th scope="col" className="py-2.5 pl-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => (
              <tr key={person.id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                      {initials(person.full_name)}
                    </span>
                    <span className="block max-w-[220px] truncate font-semibold text-slate-900">
                      {person.full_name}
                    </span>
                  </div>
                </td>
                <td className="max-w-[260px] px-3 py-3">
                  <span className="block truncate text-slate-700">{person.email}</span>
                </td>
                <td className="px-3 py-3"><DesignationBadge designation={person.designation} /></td>
                <td className="py-3 pl-3">
                  <div className="flex justify-end gap-1">
                    <IconButton label={`Edit ${person.full_name}`} onClick={() => onEdit(person)}>
                      <Pencil size={18} aria-hidden="true" />
                    </IconButton>
                    <IconButton label={`Delete ${person.full_name}`} variant="danger" onClick={() => onDelete(person)}>
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

function StaffFormModal({ open, onClose, onSubmit, mode = 'create', person }) {
  const emptyValues = { full_name: '', email: '', designation: '', password: '', confirm_password: '' }

  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [initialisedFor, setInitialisedFor] = useState(null)

  // Seed the form whenever the modal opens for a different staff member.
  const seedKey = mode === 'edit' ? person?.id : 'create'
  if (open && seedKey && seedKey !== initialisedFor) {
    setInitialisedFor(seedKey)
    setValues(
      mode === 'edit'
        ? {
            full_name: person?.full_name ?? '',
            email: person?.email ?? '',
            designation: person?.designation ?? '',
            password: '',
            confirm_password: '',
          }
        : { ...emptyValues },
    )
    setErrors({})
    setServerError('')
  }
  if (!open && initialisedFor) setInitialisedFor(null)

  const isEdit = mode === 'edit'
  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  const validateValues = (v) => {
    const next = {}
    if (!v.full_name.trim()) next.full_name = 'Full name is required.'

    if (isEdit) {
      if (!v.designation) next.designation = 'Pick a designation.'
      return next
    }

    if (!EMAIL_RE.test(v.email.trim())) next.email = 'Enter a valid email address.'
    if (!v.designation) next.designation = 'Pick a designation.'
    if (v.password.length < 8) next.password = 'Password must be at least 8 characters.'
    if (v.password && v.confirm_password !== v.password) next.confirm_password = 'Passwords do not match'
    return next
  }

  // Submit stays disabled until the form is actually valid.
  const canSubmit = Object.keys(validateValues(values)).length === 0 && !saving

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setServerError('')

    const next = validateValues(values)
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      // confirm_password is a client-side concern only - never sent.
      const { confirm_password: _ignored, ...payload } = values
      await onSubmit(isEdit ? { ...payload, id: person.id } : payload)
      onClose()
    } catch (err) {
      setServerError(friendlyMessage(err?.message))
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">
        Cancel
      </Button>
      <Button type="submit" form="staff-form" loading={saving} disabled={!canSubmit} className="flex-1">
        {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create account'}
      </Button>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit staff' : 'Add new staff'}
      description={isEdit ? person?.email : 'The staff member will sign in with this email and password.'}
      footer={footer}
    >
      <form id="staff-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
            {serverError}
          </p>
        ) : null}

        <TextInput
          label="Full name"
          value={values.full_name}
          onChange={set('full_name')}
          error={errors.full_name}
          autoComplete="name"
          placeholder="e.g. Ahmed Khan"
          required
        />

{!isEdit ? (
          <>
            <TextInput
              label="Email address"
              type="email"
              inputMode="email"
              value={values.email}
              onChange={set('email')}
              error={errors.email}
              autoComplete="email"
              placeholder="name@yourschool.edu"
              required
            />
            <PasswordInput
              label="Password"
              value={values.password}
              onChange={set('password')}
              error={errors.password}
              hint="Min 8 characters"
              placeholder="At least 8 characters"
              required
            />
            <PasswordInput
              label="Confirm password"
              value={values.confirm_password}
              onChange={set('confirm_password')}
              error={errors.confirm_password}
              placeholder="Type it again"
              required
            />
          </>
        ) : null}

        <SelectInput
          label="Designation"
          value={values.designation}
          onChange={set('designation')}
          error={errors.designation}
          required
        >
          <option value="">Select a designation</option>
          {DESIGNATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </SelectInput>

        {!isEdit ? (
          <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <UserX size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            Deleting a staff account later also removes their attendance history.
          </p>
        ) : null}
      </form>
    </Modal>
  )
}