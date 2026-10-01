import { useCallback, useState } from 'react'
import { supabase } from './supabase'
import { useToast } from '../context/toast'

export const IP_BLOCKED_MESSAGE =
  'You are not on the school network. Attendance can only be marked from an approved school IP.'

// Declared before FRIENDLY: the array below stores this value directly, so it
// must already exist when the module is evaluated (const is not hoisted).
const GENERIC_ERROR = 'Something went wrong, try again.'

const FRIENDLY = [
  [/^IP_NOT_ALLOWED/i, IP_BLOCKED_MESSAGE],
  [/already checked in/i, 'You have already checked in today.'],
  [/check-in has not opened yet/i, 'Check-in is not open yet. Please try again during the allowed time.'],
  [/check-in window has ended/i, 'The check-in window has ended for today.'],
  [/no active check-in/i, 'There is no active check-in to close for today.'],
  [/profile not found/i, 'Your profile is missing. Please contact your administrator.'],
  [/admins only/i, 'This action is restricted to administrators.'],
  [/failed to fetch|network|fetch failed/i, 'Network problem. Check your connection and try again.'],
  // Postgres type/cast problems are never useful to a teacher or a guard.
  // MUST come before the auth rule below, otherwise "22P02: invalid input
  // syntax" gets swallowed by the word "invalid" and reports an expired session.
  [/42804|22P02|invalid input syntax|is of type .* but expression is of type|column .* does not exist|PGRST/i, GENERIC_ERROR],
  [/duplicate key|23505/i, 'That record already exists.'],
  [/row-level security|rls|permission denied/i, 'You do not have permission to do that.'],
  // Narrowed on purpose: a bare "invalid" also matches Postgres syntax errors.
  [/jwt|token|expired|invalid login credentials|invalid claim|invalid user/i, 'Your session expired. Please sign in again.'],
]

/** Turns a raw Supabase/Postgres message into something a human can act on. */
export function friendlyMessage(raw) {
  const msg = String(raw ?? '').trim()
  if (!msg) return GENERIC_ERROR

  const match = FRIENDLY.find(([pattern]) => pattern.test(msg))
  if (!match) return msg
  // Unknown but scary-looking server errors collapse to the generic message.
  return match[1] === GENERIC_ERROR ? GENERIC_ERROR : match[1]
}

export function isIpBlocked(raw) {
  return /^IP_NOT_ALLOWED/i.test(String(raw ?? '').trim())
}

/**
 * Drives today's check-in / check-out state.
 * Attendance rows are only ever written through the check_in()/check_out() RPCs.
 */
export function useAttendanceActions(onChanged) {
  const toast = useToast()
  const [pending, setPending] = useState(null) // 'check_in' | 'check_out' | null

  const run = useCallback(
    async (rpcName) => {
      if (pending) return null // guards double clicks
      setPending(rpcName)
      try {
        const { data, error } = await supabase.rpc(rpcName)
        if (error) throw error
        const row = Array.isArray(data) ? data[0] : data
        await onChanged?.()
        return row
      } catch (err) {
        toast.error(friendlyMessage(err?.message))
        // A failed write may still mean the record exists; resync to be safe.
        await onChanged?.().catch(() => {})
        return null
      } finally {
        setPending(null)
      }
    },
    [pending, toast, onChanged],
  )

  return {
    checkIn: () => run('check_in'),
    checkOut: () => run('check_out'),
    pending,
  }
}