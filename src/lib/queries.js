import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

const PAGE_SIZE = 25

/** Generic async loader with loading / error / refresh semantics. */
export function useAsync(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    Promise.resolve()
      .then(loader)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Unable to load data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { data, loading, error, refresh }
}

/** The caller's attendance row for today (school timezone decides "today"). */
export function useTodayAttendance(staffId, timezone, todayKey) {
  return useAsync(async () => {
    if (!staffId) return null
    const { data, error } = await supabase
      .from('attendance')
      .select('id, attendance_date, check_in, check_out, status, auto_checked_out')
      .eq('staff_id', staffId)
      .eq('attendance_date', todayKey)
      .maybeSingle()
    if (error) throw error
    return data
  }, [staffId, todayKey, timezone])
}

/** Caller's own history, newest first, optionally limited to one month. */
export function useMyHistory(staffId, timezone, { from, to } = {}) {
  return useAsync(async () => {
    if (!staffId) return []
    let query = supabase
      .from('attendance')
      .select('id, attendance_date, check_in, check_out, status, auto_checked_out')
      .eq('staff_id', staffId)
      .order('attendance_date', { ascending: false })
      .order('check_in', { ascending: false })

    if (from) query = query.gte('attendance_date', from)
    if (to) query = query.lte('attendance_date', to)

    const { data, error } = await query
    if (error) throw error
    return data ?? []
  }, [staffId, from, to, timezone])
}

/** Admin: today's counts from the dashboard_today() RPC. */
export function useDashboardToday(timezone) {
  return useAsync(async () => {
    const { data, error } = await supabase.rpc('dashboard_today')
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return {
      total: row?.total ?? 0,
      present: row?.present ?? 0,
      late: row?.late ?? 0,
      absent: row?.absent ?? 0,
    }
  }, [timezone])
}

/** Admin: staff who checked in today (RLS keeps it inside the school). */
export function useCheckedInToday(timezone, todayKey) {
  return useAsync(async () => {
    const { data, error } = await supabase
      .from('attendance')
      .select('id, staff_id, check_in, check_out, status, auto_checked_out, profiles!attendance_staff_id_fkey(full_name, designation)')
      .eq('attendance_date', todayKey)
      .order('check_in', { ascending: true })
    if (error) throw error
    return (data ?? []).map((row) => ({
      ...row,
      full_name: row.profiles?.full_name ?? 'Unknown staff',
      designation: row.profiles?.designation ?? null,
    }))
  }, [todayKey, timezone])
}

/** Admin: staff accounts only (admins are excluded, matching the reports). */
export function useStaffList(timezone) {
  return useAsync(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, designation, app_role, created_at')
      .eq('app_role', 'staff')
      .order('full_name', { ascending: true })
    if (error) throw error
    return data ?? []
  }, [timezone])
}

/** Admin: attendance_report() RPC rows for a date range + optional designation. */
export function useAttendanceReport(from, to, designation) {
  return useAsync(async () => {
    const { data, error } = await supabase.rpc('attendance_report', {
      p_from: from,
      p_to: to,
      p_designation: designation || null,
    })
    if (error) throw error
    return data ?? []
  }, [from, to, designation])
}

/** Admin: filtered attendance log with server-side pagination. */
export function useAttendanceLogs(filters, page) {
  const { from, to, designation, status, search, todayKey } = filters
  const offset = (page - 1) * PAGE_SIZE

  const result = useAsync(async () => {
    let staffIds = null

    if (designation) {
      const { data: people, error: peopleErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('designation', designation)
      if (peopleErr) throw peopleErr
      staffIds = (people ?? []).map((p) => p.id)
      if (staffIds.length === 0) return { rows: [], count: 0 }
    }

    // `!inner` is required for a filter on the embedded profile to narrow the
    // parent attendance rows, otherwise PostgREST ignores it.
    const profileJoin = search
      ? 'profiles!attendance_staff_id_fkey!inner(full_name, designation)'
      : 'profiles!attendance_staff_id_fkey(full_name, designation)'

    let query = supabase
      .from('attendance')
      .select(`id, staff_id, attendance_date, check_in, check_out, status, auto_checked_out, ${profileJoin}`, { count: 'exact' })
      .order('attendance_date', { ascending: false })
      .order('check_in', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (from) query = query.gte('attendance_date', from)
    if (to) query = query.lte('attendance_date', to)
    if (todayKey && !from && !to) query = query.eq('attendance_date', todayKey)
    if (status) query = query.eq('status', status)
    if (staffIds) query = query.in('staff_id', staffIds)
    if (search) query = query.ilike('profiles!attendance_staff_id_fkey.full_name', `%${search}%`)

    const { data, error, count } = await query
    if (error) throw error

    return {
      rows: (data ?? []).map((row) => ({
        ...row,
        full_name: row.profiles?.full_name ?? 'Unknown staff',
        designation: row.profiles?.designation ?? null,
      })),
      count: count ?? 0,
    }
  }, [from, to, designation, status, search, page, todayKey])

  return { ...result, pageSize: PAGE_SIZE }
}

export { PAGE_SIZE }