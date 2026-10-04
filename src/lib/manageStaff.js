import { supabase } from './supabase'

/**
 * supabase-js throws away the response body on a non-2xx edge function reply:
 * `data` is null and `error.message` is the useless
 * "Edge Function returned a non-2xx status code".
 *
 * The real `{ error, code }` payload we generate is still available on
 * `error.context` (the raw Response), so dig it out before giving up.
 */
async function readEdgeError(error) {
  const context = error?.context

  if (context && typeof context.json === 'function') {
    try {
      const body = await (typeof context.clone === 'function' ? context.clone() : context).json()
      if (body && typeof body.error === 'string' && body.error.trim()) {
        return { message: body.error, code: body.code ?? null }
      }
    } catch {
      // Body was empty or not JSON - fall through to the generic message.
    }
  }

  return { message: error?.message || 'Unexpected error. Please try again.', code: error?.code ?? null }
}

export class ManageStaffError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'ManageStaffError'
    this.code = code
  }
}

/**
 * Calls the manage-staff edge function and always throws a ManageStaffError
 * carrying the server's own message + code on failure.
 */
export async function invokeManageStaff(body) {
  const { data, error } = await supabase.functions.invoke('manage-staff', { body })

  // 2xx reply that still carries an error payload.
  if (!error) {
    if (data?.error) throw new ManageStaffError(data.error, data.code ?? null)
    return data
  }

  const { message, code } = await readEdgeError(error)

  // A dead network / cold start never reaches the function.
  if (/fetch failed|network|failed to fetch/i.test(message)) {
    throw new ManageStaffError(
      'Could not reach the server. Check your connection and try again.',
      'NETWORK',
    )
  }

  throw new ManageStaffError(message, code)
}