import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Callout, EmptyState, Icon, PageHeader, Section } from '../components/ui.tsx'
import { useAuth } from '../lib/auth.tsx'
import { supabase } from '../lib/supabase.ts'
import type { CoachingSession, Invite, Member, Note } from '../lib/types.ts'

export default function SessionDetail() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [session, setSession] = useState<CoachingSession | null | undefined>(undefined)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [username, setUsername] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<'note' | 'goal'>('note')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [s, m, i, n] = await Promise.all([
      supabase.from('coaching_sessions').select('*').eq('id', id).maybeSingle(),
      supabase.from('session_members').select('user_id, role, profiles(username, display_name)').eq('session_id', id),
      supabase.from('session_invites').select('*, profiles:invited_user_id(username)').eq('session_id', id).eq('status', 'pending'),
      supabase.from('session_notes').select('*, profiles:author_id(username)').eq('session_id', id).order('created_at'),
    ])
    setSession((s.data as CoachingSession | null) ?? null)
    setMembers((m.data as unknown as Member[]) ?? [])
    setInvites((i.data as unknown as Invite[]) ?? [])
    setNotes((n.data as unknown as Note[]) ?? [])
  }, [id])

  useEffect(() => { void load() }, [load])

  // Both people work in the same session, so pick up each other's edits.
  useEffect(() => {
    const channel = supabase
      .channel(`session-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_notes', filter: `session_id=eq.${id}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_members', filter: `session_id=eq.${id}` }, () => void load())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [id, load])

  async function invite(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.rpc('invite_to_session', { p_session: id, p_username: username })
    setError(error?.message ?? null)
    if (!error) { setUsername(''); await load() }
  }

  async function addNote(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('session_notes').insert({ session_id: id, kind, body: body.trim() })
    setError(error?.message ?? null)
    if (!error) { setBody(''); await load() }
  }

  async function toggle(n: Note) {
    await supabase.from('session_notes').update({ done: !n.done }).eq('id', n.id)
    await load()
  }
  async function removeNote(n: Note) {
    await supabase.from('session_notes').delete().eq('id', n.id)
    await load()
  }
  async function cancelInvite(i: Invite) {
    await supabase.from('session_invites').delete().eq('id', i.id)
    await load()
  }
  async function leaveOrDelete() {
    const isOwner = session?.owner_id === profile?.id
    if (!confirm(isOwner ? 'Delete this session for everyone?' : 'Leave this session?')) return
    if (isOwner) await supabase.from('coaching_sessions').delete().eq('id', id)
    else await supabase.from('session_members').delete().eq('session_id', id).eq('user_id', profile!.id)
    navigate('/')
  }

  if (session === undefined) return <p className="sub">Loading…</p>
  if (session === null) return <EmptyState title="Session not found" hint="It may have been deleted, or you're not a member." />

  const isOwner = session.owner_id === profile?.id
  const back = <Link to="/" className="back"><Icon name="back" size={16} />Sessions</Link>

  return (
    <>
      <PageHeader title={session.title} back={back} subtitle={`${members.length} ${members.length === 1 ? 'person' : 'people'}`} />
      {error && <Callout tone="error">{error}</Callout>}

      <Section title="People">
        <div className="group">
          {members.map((m) => {
            const n = m.profiles?.display_name || m.profiles?.username || '?'
            return (
              <div className="row" key={m.user_id}>
                <Avatar name={n} />
                <div className="row-main">
                  <div className="row-title">{n}</div>
                  <div className="row-meta">@{m.profiles?.username}</div>
                </div>
                <div className="end row-meta">{m.role}</div>
              </div>
            )
          })}
          {invites.map((i) => (
            <div className="row" key={i.id}>
              <Avatar name={i.profiles?.username ?? '?'} />
              <div className="row-main">
                <div className="row-title">@{i.profiles?.username}</div>
                <div className="row-meta">Invitation pending</div>
              </div>
              <div className="end"><button className="btn quiet" onClick={() => void cancelInvite(i)}>Cancel</button></div>
            </div>
          ))}
        </div>
        <form onSubmit={invite} className="actions">
          <input className="grow" placeholder="Invite by username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <button className="btn primary">Invite</button>
        </form>
      </Section>

      <Section title="Notes and goals">
        {notes.length === 0 ? (
          <EmptyState title="Nothing here yet" hint="Add the first note or goal below. Everyone in the session sees it live." />
        ) : (
          <div className="group">
            {notes.map((n) => {
              const who = n.profiles?.username ?? '?'
              return (
                <div className="row" key={n.id} style={{ alignItems: 'flex-start' }}>
                  {n.kind === 'goal'
                    ? <input type="checkbox" checked={n.done} onChange={() => void toggle(n)} aria-label="Goal done" style={{ marginTop: 3 }} />
                    : <Avatar name={who} />}
                  <div className="row-main">
                    <div className={`note-body ${n.done ? 'done' : ''}`}>{n.body}</div>
                    <div className="row-meta">{n.kind === 'goal' ? 'Goal · ' : ''}@{who}</div>
                  </div>
                  {n.author_id === profile?.id && (
                    <div className="end"><button className="btn quiet" onClick={() => void removeNote(n)}>Delete</button></div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <form onSubmit={addNote} className="form" style={{ marginTop: 12 }}>
          <textarea placeholder={kind === 'goal' ? 'Write a goal' : 'Write a note'} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={5000} required />
          <div className="actions" style={{ marginTop: 0 }}>
            <div className="seg" role="group" aria-label="Type">
              <button type="button" aria-pressed={kind === 'note'} onClick={() => setKind('note')}>Note</button>
              <button type="button" aria-pressed={kind === 'goal'} onClick={() => setKind('goal')}>Goal</button>
            </div>
            <button className="btn primary" style={{ marginLeft: 'auto' }}>Add</button>
          </div>
        </form>
      </Section>

      <div className="actions">
        <button className="btn danger" onClick={() => void leaveOrDelete()}>{isOwner ? 'Delete session' : 'Leave session'}</button>
      </div>
    </>
  )
}
