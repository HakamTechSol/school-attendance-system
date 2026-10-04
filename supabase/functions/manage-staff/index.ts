import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Always answers with { error, code } so the client never has to guess. */
const fail = (code: string, error: string, status: number) => json({ error, code }, status)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DESIGNATIONS = new Set([
  'teacher',
  'principal',
  'peon',
  'driver',
  'security_guard',
  'accountant',
  'student',
])

/** Supabase auth error strings we can turn into something actionable. */
function classifyAuthError(message: string): { code: string; error: string; status: number } {
  const m = message.toLowerCase()

  if (m.includes('already been registered') || m.includes('already registered') || m.includes('user_already_exists')) {
    return {
      code: 'EMAIL_IN_USE',
      error: 'A user with this email address already exists. Try a different email address.',
      status: 409,
    }
  }
  if (m.includes('password should be') || m.includes('at least')) {
    return { code: 'WEAK_PASSWORD', error: 'Password is too weak. Use at least 6 characters.', status: 400 }
  }
  if (m.includes('email address') && m.includes('invalid')) {
    return { code: 'INVALID_EMAIL', error: 'That email address is not valid.', status: 400 }
  }
  if (m.includes('unable to validate email') || m.includes('smtp')) {
    return {
      code: 'EMAIL_SEND_FAILED',
      error: 'Confirmation email could not be sent. The account was still created.',
      status: 400,
    }
  }
  return { code: 'AUTH_ERROR', error: message || 'Could not create the account.', status: 400 }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return fail('METHOD_NOT_ALLOWED', `Use POST, received ${req.method}.`, 405)
  }

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!url || !serviceKey || !anonKey) {
      return fail('CONFIG', 'Server is missing its Supabase environment variables.', 500)
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ---- Authenticate the caller -------------------------------------
    const { data: userData, error: userErr } = await caller.auth.getUser()
    if (userErr || !userData?.user) {
      return fail('UNAUTHORIZED', 'You are signed out. Sign in again and retry.', 401)
    }
    const user = userData.user

    const { data: me, error: meErr } = await admin
      .from('profiles')
      .select('school_id, app_role')
      .eq('id', user.id)
      .maybeSingle()

    if (meErr) return fail('PROFILE_LOOKUP', meErr.message, 500)
    if (!me) {
      return fail('NO_PROFILE', 'Your account is not linked to a school.', 403)
    }
    if (me.app_role !== 'admin') {
      return fail('FORBIDDEN', 'Only an administrator can manage staff.', 403)
    }

    // ---- Body ----------------------------------------------------------
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return fail('BAD_BODY', 'Request body was not valid JSON.', 400)
    }
    if (!body || typeof body !== 'object') {
      return fail('BAD_BODY', 'Request body was empty.', 400)
    }

    // ---- Delete -------------------------------------------------------
    if (body.action === 'delete') {
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return fail('INVALID_INPUT', 'No staff member was selected.', 400)

      const { data: target, error: targetErr } = await admin
        .from('profiles')
        .select('id, school_id')
        .eq('id', id)
        .maybeSingle()

      if (targetErr) return fail('PROFILE_LOOKUP', targetErr.message, 500)
      if (!target) return fail('NOT_FOUND', 'That staff member no longer exists.', 404)
      if (target.school_id !== me.school_id) {
        return fail('FORBIDDEN', 'You can only remove staff from your own school.', 403)
      }
      if (target.id === user.id) {
        return fail('SELF_DELETE', 'You cannot remove your own account.', 400)
      }

      // Remove the profile first: auth delete cascades anyway, but doing it
      // explicitly keeps things tidy if the auth call is slow to settle.
      const { error: delProfileErr } = await admin.from('profiles').delete().eq('id', id)
      if (delProfileErr) return fail('PROFILE_DELETE', delProfileErr.message, 400)

      const { error: delAuthErr } = await admin.auth.admin.deleteUser(id)
      if (delAuthErr && !/not found/i.test(delAuthErr.message)) {
        return fail('AUTH_DELETE', delAuthErr.message, 400)
      }
      return json({ ok: true })
    }

    // ---- Create -------------------------------------------------------
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const fullName = String(body.full_name ?? '').trim()
    const designation = String(body.designation ?? '').trim()

    if (!email) return fail('INVALID_INPUT', 'Email address is required.', 400)
    if (!EMAIL_RE.test(email)) {
      return fail('INVALID_INPUT', 'That email address is not valid.', 400)
    }
    if (!fullName) return fail('INVALID_INPUT', 'Full name is required.', 400)
    if (!DESIGNATIONS.has(designation)) {
      return fail('INVALID_INPUT', 'Please choose a designation.', 400)
    }
    if (password.length < 6) {
      return fail('INVALID_INPUT', 'Password must be at least 6 characters.', 400)
    }

    // Is this email already a profile in our school? Cheap, friendly check
    // that runs before we touch the auth service.
    const { data: existingProfile, error: existingErr } = await admin
      .from('profiles')
      .select('id, full_name, school_id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (existingErr) return fail('PROFILE_LOOKUP', existingErr.message, 500)
    if (existingProfile) {
      const inOurSchool = existingProfile.school_id === me.school_id
      return fail(
        'EMAIL_IN_USE',
        inOurSchool
          ? `${email} is already in your staff list (${existingProfile.full_name}). Edit that account instead.`
          : `${email} is already registered with another school and cannot be added again.`,
        409,
      )
    }

    // ---- Create the auth user -----------------------------------------
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createErr) {
      const classified = classifyAuthError(createErr.message)
      return fail(classified.code, classified.error, classified.status)
    }

    const newUserId = created?.user?.id
    if (!newUserId) {
      return fail('AUTH_ERROR', 'The account was created but no user id came back.', 500)
    }

    // ---- Create the profile -------------------------------------------
    const { error: profileErr } = await admin.from('profiles').insert({
      id: newUserId,
      school_id: me.school_id,
      full_name: fullName,
      email,
      designation,
      app_role: 'staff',
    })

    if (profileErr) {
      // Never leave an orphaned auth user behind.
      await admin.auth.admin.deleteUser(newUserId).catch(() => {})
      return fail('PROFILE_CREATE', profileErr.message, 400)
    }

    return json({ ok: true, id: newUserId })
  } catch (err) {
    // Last resort: always answer with JSON so the client can read it.
    const message = err instanceof Error ? err.message : String(err)
    console.error('[manage-staff] unhandled', message)
    return fail('INTERNAL', message || 'Unexpected server error.', 500)
  }
})