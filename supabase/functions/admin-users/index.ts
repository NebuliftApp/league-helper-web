// Admin-only account management. Runs with the service-role key, which never
// leaves the server. Every call first verifies the caller is an admin profile.
// Deploy with:  supabase functions deploy admin-users
import { createClient } from 'npm:@supabase/supabase-js@2'

// Accounts are username-first; Supabase Auth needs an email, so synthesise one.
// Keep in sync with src/lib/auth.tsx.
const EMAIL_DOMAIN = 'league-helper.invalid'
const USERNAME = /^[a-z0-9_]{3,24}$/

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: caller } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!caller.user) return json({ error: 'Not signed in' }, 401)
  const { data: me } = await admin.from('profiles').select('role').eq('id', caller.user.id).single()
  if (me?.role !== 'admin') return json({ error: 'Admins only' }, 403)

  const body = await req.json().catch(() => ({}))
  try {
    switch (body.action) {
      case 'list': {
        const { data, error } = await admin
          .from('profiles').select('id, username, role, display_name, created_at').order('created_at')
        if (error) throw error
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
        const banned = new Set(
          (list?.users ?? []).filter((u) => u.banned_until && new Date(u.banned_until) > new Date()).map((u) => u.id),
        )
        return json({ users: data.map((u) => ({ ...u, disabled: banned.has(u.id) })) })
      }
      case 'create': {
        const username = String(body.username ?? '').trim().toLowerCase()
        const role = body.role
        const password = String(body.password ?? '')
        if (!USERNAME.test(username)) return json({ error: 'Username: 3-24 chars, a-z 0-9 _' }, 400)
        if (role !== 'user' && role !== 'coach') return json({ error: 'Role must be user or coach' }, 400)
        if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
        const { data, error } = await admin.auth.admin.createUser({
          email: `${username}@${EMAIL_DOMAIN}`, password, email_confirm: true,
        })
        if (error) return json({ error: error.message }, 400)
        const { error: pErr } = await admin.from('profiles').insert({
          id: data.user.id, username, role, display_name: body.displayName || null, must_change_password: true,
        })
        if (pErr) {
          await admin.auth.admin.deleteUser(data.user.id) // don't leave an orphan login
          return json({ error: pErr.message }, 400)
        }
        return json({ id: data.user.id })
      }
      case 'reset_password': {
        const password = String(body.password ?? '')
        if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
        const { error } = await admin.auth.admin.updateUserById(body.id, { password })
        if (error) throw error
        await admin.from('profiles').update({ must_change_password: true }).eq('id', body.id)
        return json({ ok: true })
      }
      case 'set_disabled': {
        if (body.id === caller.user.id) return json({ error: "You can't disable yourself" }, 400)
        const { error } = await admin.auth.admin.updateUserById(body.id, {
          ban_duration: body.disabled ? '876000h' : 'none',
        })
        if (error) throw error
        return json({ ok: true })
      }
      case 'delete': {
        if (body.id === caller.user.id) return json({ error: "You can't delete yourself" }, 400)
        const { error } = await admin.auth.admin.deleteUser(body.id)
        if (error) throw error
        return json({ ok: true })
      }
      default:
        return json({ error: 'Unknown action' }, 400)
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Failed' }, 500)
  }
})
