import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Callout, EmptyState, PageHeader, Section } from '../components/ui.tsx'
import { supabase } from '../lib/supabase.ts'
import type { CoachingSession, Invite } from '../lib/types.ts'

const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export default function Sessions() {
  const [sessions, setSessions] = useState<CoachingSession[] | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id ?? ''
    const [s, i] = await Promise.all([
      supabase.from('coaching_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('session_invites').select('*').eq('status', 'pending').eq('invited_user_id', uid),
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
    <>
      <PageHeader title="Sessions" subtitle="Coaching sessions you and your coach work on together." />
      {error && <Callout tone="error">{error}</Callout>}

      {invites.length > 0 && (
        <Section title="Invitations">
          <div className="group">
            {invites.map((i) => (
              <div className="row" key={i.id}>
                <div className="row-main">
                  <div className="row-title">{i.session_title}</div>
                  <div className="row-meta">Invited by @{i.invited_by_username}</div>
                </div>
                <div className="end">
                  <button className="btn primary" onClick={() => void respond(i.id, true)}>Accept</button>
                  <button className="btn" onClick={() => void respond(i.id, false)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Your sessions">
        {sessions === null ? <p className="sub">Loading…</p> : sessions.length === 0 ? (
          <EmptyState title="No sessions yet" hint="Name one below to start, or accept an invitation from your coach." />
        ) : (
          <div className="group">
            {sessions.map((s) => (
              <Link className="row" to={`/sessions/${s.id}`} key={s.id}>
                <div className="row-main"><div className="row-title">{s.title}</div></div>
                <div className="end row-meta">{fmt.format(new Date(s.created_at))}<span className="chev">›</span></div>
              </Link>
            ))}
          </div>
        )}
        <form onSubmit={create} className="actions">
          <input className="grow" placeholder="Session name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          <button className="btn primary">New session</button>
        </form>
      </Section>
    </>
  )
}
