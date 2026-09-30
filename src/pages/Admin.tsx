import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase.ts'
import type { AdminUser } from '../lib/types.ts'

async function call<T = unknown>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    // Non-2xx responses carry our {error} JSON in the response context.
    const res = (error as { context?: Response }).context
    const msg = res ? ((await res.json().catch(() => null)) as { error?: string } | null)?.error : undefined
    return { error: msg ?? error.message }
  }
  return { data: data as T }
}

const randomPassword = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('')

export default function Admin() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<'user' | 'coach'>('coach')
  const [password, setPassword] = useState(randomPassword)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await call<{ users: AdminUser[] }>({ action: 'list' })
    if (error) setError(error)
    else setUsers(data!.users)
  }, [])

  useEffect(() => { void load() }, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    const name = username.trim().toLowerCase()
    const { error } = await call({ action: 'create', username: name, role, password })
    setError(error ?? null)
    if (!error) {
      setNotice(`Created ${name}. Give them this temporary password (shown once): ${password}`)
      setUsername('')
      setPassword(randomPassword())
      await load()
    }
  }

  async function reset(u: AdminUser) {
    const pw = randomPassword()
    const { error } = await call({ action: 'reset_password', id: u.id, password: pw })
    setError(error ?? null)
    if (!error) setNotice(`New temporary password for ${u.username} (shown once): ${pw}`)
  }

  async function setDisabled(u: AdminUser, disabled: boolean) {
    const { error } = await call({ action: 'set_disabled', id: u.id, disabled })
    setError(error ?? null)
    await load()
  }

  async function remove(u: AdminUser) {
    if (!confirm(`Delete ${u.username} and everything they own? This can't be undone.`)) return
    const { error } = await call({ action: 'delete', id: u.id })
    setError(error ?? null)
    await load()
  }

  return (
    <div className="narrow-block">
      <h1>Accounts</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="ok">{notice}</p>}

      <section>
        <h2>Create account</h2>
        <form onSubmit={create} className="stack">
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} pattern="[a-zA-Z0-9_]{3,24}" title="3-24 letters, digits or _" required />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as 'user' | 'coach')}>
              <option value="coach">Coach</option>
              <option value="user">User</option>
            </select>
          </label>
          <label>
            Temporary password
            <input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </label>
          <button className="primary">Create account</button>
        </form>
      </section>

      <section>
        <h2>Everyone</h2>
        {users === null ? <p className="muted">Loading…</p> : (
          <ul className="list">
            {users.map((u) => (
              <li key={u.id}>
                <span>
                  <strong>{u.username}</strong> <span className="muted">{u.role}{u.disabled ? ' · disabled' : ''}</span>
                </span>
                {u.role !== 'admin' && (
                  <span className="row">
                    <button onClick={() => void reset(u)}>Reset password</button>
                    <button onClick={() => void setDisabled(u, !u.disabled)}>{u.disabled ? 'Enable' : 'Disable'}</button>
                    <button onClick={() => void remove(u)}>Delete</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
