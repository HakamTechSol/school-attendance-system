import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)
  const { data: me } = await admin.from('profiles').select('school_id, app_role').eq('id', user.id).single()
  if (me?.app_role !== 'admin') return json({ error: 'Admins only' }, 403)

  const body = await req.json()
  if (body.action === 'delete') {
    const { data: t } = await admin.from('profiles').select('school_id').eq('id', body.id).single()
    if (t?.school_id !== me.school_id) return json({ error: 'Not allowed' }, 403)
    const { error } = await admin.auth.admin.deleteUser(body.id)
    return error ? json({ error: error.message }, 400) : json({ ok: true })
  }
  const { email, password, full_name, designation } = body
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) return json({ error: error.message }, 400)
  const { error: e2 } = await admin.from('profiles').insert({
    id: data.user.id, school_id: me.school_id, full_name, email, designation, app_role: 'staff',
  })
  if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: e2.message }, 400) }
  return json({ ok: true })
})