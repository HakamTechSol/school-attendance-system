import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card } from './Layout'
import { Button, IconButton } from './Button'
import { Modal } from './Modal'
import { useToast } from '../context/toast'
import { useHolidays, useSchoolWorkingDays, useSchoolWorkingWeeks } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { friendlyMessage } from '../lib/attendanceActions'
import { toDateKey } from '../utils/format'

const MONTH_FORMAT = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const DATE_FORMAT = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

function weekStart(dateKey) {
  const date = new Date(dateKey + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() - date.getUTCDay())
  return date.toISOString().slice(0, 10)
}

function shiftMonth(value, step) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + step, 1))
  return date.toISOString().slice(0, 7)
}

export default function SchoolCalendar({ school, timezone }) {
  const schoolId = school?.id
  const toast = useToast()
  const today = toDateKey(new Date(), timezone)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [activeDay, setActiveDay] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ kind: 'holiday', description: '' })
  const [saving, setSaving] = useState(false)
  const [savingWeek, setSavingWeek] = useState(false)
  const schedule = useSchoolWorkingDays(schoolId)
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5, 6])
  useEffect(() => { if (schedule.data) setWorkingDays(schedule.data) }, [schoolId, schedule.data])
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const saveWorkingDays = async () => {
    setSavingWeek(true)
    try {
      const { error } = await supabase.from('schools').update({ working_days: workingDays }).eq('id', schoolId)
      if (error) throw error
      toast.success('Weekly attendance days saved.')
      schedule.refresh()
    } catch (error) { toast.error(friendlyMessage(error?.message)) }
    finally { setSavingWeek(false) }
  }
  const toggleWorkingDay = (day) => setWorkingDays((value) => value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort((a, b) => a - b))
  const saveWeekPlan = async () => {
    if (!activeWeek) return
    setSavingWeek(true)
    try {
      const { error } = await supabase.from('school_work_weeks').upsert({ school_id: schoolId, week_start: activeWeek, working_days: weekDraft }, { onConflict: 'school_id,week_start' })
      if (error) throw error
      toast.success('This week schedule saved. Other weeks are unchanged.')
      weekSchedules.refresh()
    } catch (error) { toast.error(friendlyMessage(error?.message)) }
    finally { setSavingWeek(false) }
  }
  const toggleWeekDay = (day) => setWeekDraft((value) => value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort((a,b) => a-b))

  const from = month + '-01'
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const to = month + '-' + String(lastDay).padStart(2, '0')
  const holidays = useHolidays(schoolId, from, to)
  const scheduleFrom = weekStart(from)
  const scheduleTo = weekStart(to)
  const weekSchedules = useSchoolWorkingWeeks(schoolId, scheduleFrom, scheduleTo)
  const savedWeeks = useMemo(() => Object.fromEntries((weekSchedules.data ?? []).map((week) => [week.week_start, week.working_days])), [weekSchedules.data])
  const activeWeek = activeDay ? weekStart(activeDay) : ''
  const [weekDraft, setWeekDraft] = useState([])
  useEffect(() => { if (activeWeek) setWeekDraft(savedWeeks[activeWeek] ?? schedule.data ?? [1,2,3,4,5,6]) }, [activeWeek, savedWeeks, schedule.data])
  const records = holidays.data ?? []
  const byDate = useMemo(() => records.reduce((map, record) => {
    map[record.holiday_date] ??= []
    map[record.holiday_date].push(record)
    return map
  }, {}), [records])
  const leading = new Date(from + 'T12:00:00Z').getUTCDay()
  const cells = [...Array(leading).fill(null), ...Array.from({ length: lastDay }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    return month + '-' + day
  })]

  const openDay = (date) => {
    setActiveDay(date)
    setWeekDraft(savedWeeks[weekStart(date)] ?? workingDays)
    setEditingId(null)
    setForm({ kind: 'holiday', description: '' })
  }
  const startEdit = (record) => {
    setEditingId(record.id)
    setForm({ kind: record.kind, description: record.description })
  }
  const closeDay = () => {
    setActiveDay('')
    setEditingId(null)
  }
  const saveRecord = async (event) => {
    event.preventDefault()
    const description = form.description.trim()
    if (!description || !activeDay) return
    setSaving(true)
    try {
      const result = editingId
        ? await supabase.from('holidays').update({ kind: form.kind, description }).eq('id', editingId)
        : await supabase.from('holidays').insert({ school_id: schoolId, holiday_date: activeDay, kind: form.kind, description })
      if (result.error) throw result.error
      toast.success(editingId ? 'Calendar entry updated.' : 'Calendar entry added.')
      setEditingId(null)
      setForm({ kind: 'holiday', description: '' })
      holidays.refresh()
    } catch (error) {
      toast.error(friendlyMessage(error?.message))
    } finally {
      setSaving(false)
    }
  }
  const deleteRecord = async (record) => {
    if (!window.confirm('Delete this calendar entry?')) return
    try {
      const { error } = await supabase.from('holidays').delete().eq('id', record.id)
      if (error) throw error
      toast.success('Calendar entry deleted.')
      if (editingId === record.id) { setEditingId(null); setForm({ kind: 'holiday', description: '' }) }
      holidays.refresh()
    } catch (error) {
      toast.error(friendlyMessage(error?.message))
    }
  }

  return (
    <>
      <Card className="mt-4" title="School calendar" description="Set a default week pattern, then click a date to customize that exact week or add a holiday, off day, or event."
        actions={
          <div className="flex items-center gap-1">
            <IconButton label="Previous month" onClick={() => setMonth((value) => shiftMonth(value, -1))}><ChevronLeft size={19} /></IconButton>
            <span className="min-w-32 text-center text-sm font-bold text-slate-700">{MONTH_FORMAT.format(new Date(from + 'T12:00:00Z'))}</span>
            <IconButton label="Next month" onClick={() => setMonth((value) => shiftMonth(value, 1))}><ChevronRight size={19} /></IconButton>
          </div>
        }>
        {schedule.error ? <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Run migration 004_holidays_events.sql to enable weekly working-day settings.</p> : null}
        {holidays.error ? <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          {holidays.error.includes('Could not find the table') ? 'Calendar database update is missing. Run migration 004_holidays_events.sql in Supabase SQL Editor, then refresh this page.' : holidays.error}
        </p> : null}
        <div className="mb-4 rounded-xl bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">Default weekly working days</p>
            <Button size="sm" loading={savingWeek} disabled={!workingDays.length} onClick={saveWorkingDays}>Save default</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {weekdayNames.map((name, day) => {
              const on = workingDays.includes(day)
              return <button key={day} type="button" aria-pressed={on} disabled={on && workingDays.length === 1} onClick={() => toggleWorkingDay(day)}
                className={'min-h-10 rounded-lg px-2.5 text-xs font-bold transition-colors sm:px-3 ' + (on ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-slate-200 text-slate-600')}>
                {name.slice(0, 3)} - {on ? 'Working' : 'Off'}
              </button>
            })}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="py-2 text-[11px] font-bold uppercase text-slate-400">{day}</div>)}
          {cells.map((date, index) => {
            const entries = date ? (byDate[date] ?? []) : []
            const hasHoliday = entries.some((entry) => entry.kind === 'holiday')
            const hasEvent = entries.some((entry) => entry.kind === 'event')
            const hasOffDay = entries.some((entry) => entry.kind === 'off_day')
            const hasWorkOverride = entries.some((entry) => entry.kind === 'working_day')
            const baselineWorking = date ? (savedWeeks[weekStart(date)] ?? workingDays).includes(new Date(date + 'T12:00:00Z').getUTCDay()) : false
            const weeklyOff = date ? !baselineWorking && !hasWorkOverride : false
            const closedDate = hasHoliday || hasOffDay
            return date ? (
              <button key={date} type="button" onClick={() => openDay(date)} aria-label={date + (entries.length ? ', ' + entries.map((entry) => entry.description).join(', ') : '')}
                className={'relative flex min-h-14 flex-col items-center rounded-xl border p-1.5 text-sm transition-colors sm:min-h-16 ' +
                  (date === today ? 'border-brand-500 bg-brand-50 font-bold text-brand-800 ' : closedDate ? 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 ' : weeklyOff ? 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 ' : 'border-emerald-100 bg-emerald-50/40 text-slate-700 hover:border-emerald-300 ') +
                  (closedDate ? 'ring-1 ring-inset ring-amber-300 ' : '')}>
                <span>{Number(date.slice(-2))}</span>
                {entries.length ? <span className="mt-1 flex gap-1" aria-hidden="true">
                  {hasHoliday || hasOffDay ? <i className="h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
                  {hasWorkOverride ? <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                  {hasEvent ? <i className="h-1.5 w-1.5 rounded-full bg-brand-500" /> : null}
                </span> : null}
              </button>
            ) : <span key={'blank-' + index} className="min-h-14 sm:min-h-16" />
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Working day</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-400" /> Weekly off</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" /> Closed date</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-700" /> Extra workday</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand-500" /> School event</span>
        </div>
      </Card>

      <Modal open={Boolean(activeDay)} onClose={closeDay} title="Calendar day" description={activeDay ? DATE_FORMAT.format(new Date(activeDay + 'T12:00:00Z')) : ''} size="md">
        <div className="space-y-4">
          <section className="rounded-xl border border-brand-100 bg-brand-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm font-bold text-slate-900">This week schedule</p><p className="text-xs text-slate-600">{activeWeek} to {activeWeek ? new Date(new Date(activeWeek + 'T12:00:00Z').getTime() + 6*86400000).toISOString().slice(0,10) : ''}</p></div>
              <Button size="sm" loading={savingWeek} onClick={saveWeekPlan}>Save this week</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">{weekdayNames.map((name, day) => { const on = weekDraft.includes(day); return <button key={day} type="button" aria-pressed={on} onClick={() => toggleWeekDay(day)} className={'min-h-9 rounded-lg px-2.5 text-xs font-bold ' + (on ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-slate-200 text-slate-600')}>{name.slice(0,3)} - {on ? 'Work' : 'Off'}</button> })}</div>
          </section>
          <div className="space-y-2">
            {(byDate[activeDay] ?? []).map((record) => (
              <div key={record.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0">
                  <span className={'inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ' + (record.kind === 'event' ? 'bg-brand-100 text-brand-800' : record.kind === 'working_day' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                    {record.kind === 'holiday' ? 'Holiday / School Closed' : record.kind === 'off_day' ? 'School off day' : record.kind === 'working_day' ? 'Extra working day' : 'School event'}
                  </span>
                  <p className="mt-1 break-words text-sm font-medium text-slate-800">{record.description}</p>
                </div>
                <div className="flex shrink-0">
                  <IconButton label="Edit entry" onClick={() => startEdit(record)}><Pencil size={17} /></IconButton>
                  <IconButton label="Delete entry" variant="danger" onClick={() => deleteRecord(record)}><Trash2 size={17} /></IconButton>
                </div>
              </div>
            ))}
            {!(byDate[activeDay] ?? []).length ? <p className="text-sm text-slate-500">No holidays or events on this day yet.</p> : null}
          </div>
          <form onSubmit={saveRecord} className="space-y-3 border-t border-slate-200 pt-4">
            <p className="text-sm font-bold text-slate-900">{editingId ? 'Edit calendar entry' : <span className="inline-flex items-center gap-1"><Plus size={16} /> Add an entry</span>}</p>
            <label className="block text-sm font-semibold text-slate-700">Type
              <select value={form.kind} onChange={(event) => setForm((value) => ({ ...value, kind: event.target.value }))}
                className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2">
                <option value="holiday">Holiday / School closed</option><option value="off_day">School off day</option><option value="working_day">Extra working day (this date only)</option><option value="event">School event</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">Name or details
              <textarea required maxLength={200} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                className="mt-1 block min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" placeholder="e.g. Independence Day" />
            </label>
            <div className="flex gap-2">
              {editingId ? <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm({ kind: 'holiday', description: '' }) }}>Cancel edit</Button> : null}
              <Button type="submit" loading={saving} disabled={!form.description.trim()} className="flex-1">{editingId ? 'Save changes' : 'Add to calendar'}</Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  )
}
