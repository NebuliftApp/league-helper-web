import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.ts'
import type { CoachingSession, Invite } from '../lib/types.ts'

export default function Sessions() {
  const [sessions, setSessions] = useState<CoachingSession[] | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [s, i] = await Promise.all([
      supabase.from('coaching_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('session_invites').select('*').eq('status', 'pending')
        .eq('invited_user_id', (await supabase.auth.getUser()).data.user?.id ?? ''),
    ])
    setSessions((s.data as CoachingSession[]) ?? [])
    setInvites((i.data as Invite[]) ?? [])
  }, [])

  useEffect(() => { void load() }, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('coaching_sessions').insert({ title: title.trim() })
    setError(error?.message ?? null)
    if (!error) { setTitle(''); await load() }
  }

  async function respond(id: string, accept: boolean) {
    const { error } = await supabase.rpc('respond_to_invite', { p_invite: id, p_accept: accept })
    setError(error?.message ?? null)
    await load()
  }

  return (
    <div className="narrow-block">
      <h1>Coaching sessions</h1>
      {error && <p className="error" role="alert">{error}</p>}

      {invites.length > 0 && (
        <section>
          <h2>Invitations</h2>
          <ul className="list">
            {invites.map((i) => (
              <li key={i.id}>
                <span><strong>{i.session_title}</strong> <span className="muted">from {i.invited_by_username}</span></span>
                <span className="row">
                  <button className="primary" onClick={() => void respond(i.id, true)}>Accept</button>
                  <button onClick={() => void respond(i.id, false)}>Decline</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        {sessions === null ? <p className="muted">Loading…</p> : sessions.length === 0 ? (
          <p className="muted">No sessions yet. Create one below, or wait for an invitation from your coach.</p>
        ) : (
          <ul className="list">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link to={`/sessions/${s.id}`}>{s.title}</Link>
                <span className="muted">{new Date(s.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={create} className="row">
          <input placeholder="New session title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          <button className="primary">Create session</button>
        </form>
      </section>
    </div>
  )
}
