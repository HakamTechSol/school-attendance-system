import { useCallback, useState } from 'react'
import { supabase } from './supabase'
import { useAsync } from './queries'
import { friendlyMessage } from './attendanceActions'

/**
 * Staff portal: is attendance restricted for this school, and is the caller
 * coming from an approved IP? Powers the red banner / green chip.
 */
export function useIpStatus(timezone) {
  const result = useAsync(async () => {
    const { data, error } = await supabase.rpc('ip_status')
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return {
      enforced: Boolean(row?.enforced),
      allowed: row?.allowed ?? true,
      ip: row?.ip ?? null,
    }
  }, [timezone])

  return result
}

/** Admin: the approved IP list for the current school. */
export function useAllowedIps(timezone) {
  return useAsync(async () => {
    const { data, error } = await supabase
      .from('allowed_ips')
      .select('id, ip_cidr, label, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  }, [timezone])
}

/** Admin: the IP this request appears to come from. */
export function useMyIp(timezone) {
  const result = useAsync(async () => {
    const { data, error } = await supabase.rpc('my_ip')
    if (error) throw error
    return data || null
  }, [timezone])

  return { ip: result.data, loading: result.loading, error: result.error, refresh: result.refresh }
}

/** Admin: read + update the school's own settings row. */
export function useSchoolSettings(schoolId) {
  const result = useAsync(async () => {
    if (!schoolId) return null
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, timezone, check_in_start, late_after, auto_checkout_at, ip_restriction_enabled')
      .eq('id', schoolId)
      .maybeSingle()
    if (error) throw error
    return data
  }, [schoolId])

  return result
}

/** Saves the school's attendance schedule. */
export function useSaveAttendanceSchedule(schoolId) {
  const [saving, setSaving] = useState(false)
  const save = useCallback(async (schedule) => {
    if (!schoolId) throw new Error('School not loaded yet.')
    setSaving(true)
    try {
      const { error } = await supabase.from('schools').update(schedule).eq('id', schoolId)
      if (error) throw new Error(friendlyMessage(error.message))
    } finally {
      setSaving(false)
    }
  }, [schoolId])
  return { save, saving }
}

/** Toggles ip_restriction_enabled for the caller's own school. */
export function useToggleIpRestriction(schoolId) {
  const [saving, setSaving] = useState(false)

  const setEnabled = useCallback(
    async (enabled) => {
      if (!schoolId) throw new Error('School not loaded yet.')
      setSaving(true)
      try {
        const { error } = await supabase
          .from('schools')
          .update({ ip_restriction_enabled: Boolean(enabled) })
          .eq('id', schoolId)
        if (error) throw new Error(error.message)
      } finally {
        setSaving(false)
      }
    },
    [schoolId],
  )

  return { setEnabled, saving }
}

/** Adds an IP / CIDR to the school's allow list. */
export function useAddIp(schoolId) {
  const [saving, setSaving] = useState(false)

  const add = useCallback(
    async (value, label) => {
      if (!schoolId) throw new Error('School not loaded yet.')
      const cidr = normaliseCidr(value)
      const invalid = validateCidr(cidr)
      if (invalid) throw new Error(invalid)

      setSaving(true)
      try {
        const { error } = await supabase
          .from('allowed_ips')
          .insert({ school_id: schoolId, ip_cidr: cidr, label: label?.trim() || null })
        if (error) throw new Error(friendlyMessage(error.message))
        return cidr
      } finally {
        setSaving(false)
      }
    },
    [schoolId],
  )

  return { add, saving }
}

/** Removes one row from the allow list. */
export function useDeleteIp() {
  const [saving, setSaving] = useState(false)

  const remove = useCallback(async (id) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('allowed_ips').delete().eq('id', id)
      if (error) throw new Error(friendlyMessage(error.message))
    } finally {
      setSaving(false)
    }
  }, [])

  return { remove, saving }
}

// ---------------------------------------------------------------------------
// Client-side CIDR helpers (convenience only - Postgres is the real validator)
// ---------------------------------------------------------------------------

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** '1.2.3.4' -> '1.2.3.4/32', '103.5.6.0/24' -> unchanged. */
export function normaliseCidr(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (raw.includes('/')) return raw
  return IPV4.test(raw) ? `${raw}/32` : raw
}

/** Returns an error string, or '' when the value looks like a valid IP/CIDR. */
export function validateCidr(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Enter an IP address.'

  const [addr, mask] = raw.split('/')

  const v4 = IPV4.exec(addr)
  if (v4) {
    if (v4.slice(1).some((part) => Number(part) > 255)) return 'Each IP part must be 0-255.'
    if (mask !== undefined) {
      if (!/^\d{1,2}$/.test(mask)) return 'Mask must be a number between 0 and 32.'
      if (Number(mask) > 32) return 'IPv4 mask must be between 0 and 32.'
    }
    return ''
  }

  if (addr.includes(':')) {
    // Deliberately loose: full IPv6 validation is Postgres' job.
    if (!/^[0-9a-fA-F:.]+$/.test(addr)) return 'That does not look like a valid IPv6 address.'
    if (mask !== undefined) {
      if (!/^\d{1,3}$/.test(mask)) return 'Mask must be a number between 0 and 128.'
      if (Number(mask) > 128) return 'IPv6 mask must be between 0 and 128.'
    }
    return ''
  }

  return 'Enter a valid IP address (1.2.3.4, 103.5.6.0/24 or an IPv6 address).'
}
