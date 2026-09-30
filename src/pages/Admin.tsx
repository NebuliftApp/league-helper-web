import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Callout, Icon, PageHeader, RoleChip, Section } from '../components/ui.tsx'
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
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null)
  const [copied, setCopied] = useState(false)

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
      setSecret({ label: `Created ${name}. Temporary password, shown once:`, value: password })
      setCopied(false)
      setUsername('')
      setPassword(randomPassword())
      await load()
    }
  }

  async function reset(u: AdminUser) {
    const pw = randomPassword()
    const { error } = await call({ action: 'reset_password', id: u.id, password: pw })
    setError(error ?? null)
    if (!error) { setSecret({ label: `New temporary password for ${u.username}, shown once:`, value: pw }); setCopied(false) }
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

  async function copy(v: string) {
    await navigator.clipboard.writeText(v).catch(() => undefined)
    setCopied(true)
  }

  return (
    <>
      <PageHeader title="Accounts" subtitle="Create and manage coach and user accounts. There is no public sign-up." />
      {error && <Callout tone="error">{error}</Callout>}
      {secret && (
        <Callout tone="info">
          <span>{secret.label}</span>
          <code className="secret">{secret.value}</code>
          <button className="btn" onClick={() => void copy(secret.value)}><Icon name="copy" size={14} />{copied ? 'Copied' : 'Copy'}</button>
        </Callout>
      )}

      <Section title="Everyone">
        {users === null ? <p className="sub">Loading…</p> : (
          <div className="group">
            {users.map((u) => (
              <div className="row" key={u.id} style={{ flexWrap: 'wrap' }}>
                <div className="row-main">
                  <div className="row-title">{u.username}</div>
                </div>
                <div className="end">
                  <RoleChip role={u.role} />
                  {u.disabled && <span className="chip chip-off">disabled</span>}
                </div>
                {u.role !== 'admin' && (
                  <div className="actions" style={{ width: '100%', margin: 0, paddingLeft: 0 }}>
                    <button className="btn" onClick={() => void reset(u)}>Reset password</button>
                    <button className="btn" onClick={() => void setDisabled(u, !u.disabled)}>{u.disabled ? 'Enable' : 'Disable'}</button>
                    <button className="btn danger" onClick={() => void remove(u)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="New account">
        <form onSubmit={create} className="form">
          <label className="field">Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} pattern="[a-zA-Z0-9_]{3,24}" title="3 to 24 letters, digits or underscore" autoCapitalize="none" required />
          </label>
          <label className="field">Role
            <select value={role} onChange={(e) => setRole(e.target.value as 'user' | 'coach')}>
              <option value="coach">Coach</option>
              <option value="user">User</option>
            </select>
          </label>
          <label className="field">Temporary password
            <input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required style={{ fontFamily: 'var(--mono)' }} />
          </label>
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn primary">Create account</button>
          </div>
        </form>
      </Section>
    </>
  )
}
