import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

  if (session === undefined) return <p className="muted">Loading…</p>
  if (session === null) return <p>Session not found. <Link to="/">Back</Link></p>

  const isOwner = session.owner_id === profile?.id
  return (
    <div className="narrow-block">
      <p><Link to="/">← Sessions</Link></p>
      <h1>{session.title}</h1>
      {error && <p className="error" role="alert">{error}</p>}

      <section>
        <h2>People</h2>
        <ul className="list">
          {members.map((m) => (
            <li key={m.user_id}>
              <span>{m.profiles?.display_name || m.profiles?.username} <span className="muted">@{m.profiles?.username}</span></span>
              <span className="muted">{m.role}</span>
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.id}>
              <span>@{i.profiles?.username} <span className="muted">invited</span></span>
              {i.invited_user_id && <button onClick={() => void cancelInvite(i)}>Cancel</button>}
            </li>
          ))}
        </ul>
        <form onSubmit={invite} className="row">
          <input placeholder="Invite by username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <button className="primary">Invite</button>
        </form>
      </section>

      <section>
        <h2>Notes &amp; goals</h2>
        {notes.length === 0 && <p className="muted">Nothing here yet. Add the first note or goal below.</p>}
        <ul className="list">
          {notes.map((n) => (
            <li key={n.id}>
              <span className={n.done ? 'done' : ''}>
                {n.kind === 'goal' && (
                  <input type="checkbox" checked={n.done} onChange={() => void toggle(n)} aria-label="Goal done" />
                )}{' '}
                {n.body} <span className="muted">— {n.profiles?.username}</span>
              </span>
              {(n.author_id === profile?.id) && <button onClick={() => void removeNote(n)}>Delete</button>}
            </li>
          ))}
        </ul>
        <form onSubmit={addNote} className="stack">
          <textarea placeholder="Write a note or goal" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={5000} required />
          <span className="row">
            <select value={kind} onChange={(e) => setKind(e.target.value as 'note' | 'goal')}>
              <option value="note">Note</option>
              <option value="goal">Goal</option>
            </select>
            <button className="primary">Add</button>
          </span>
        </form>
      </section>

      <p><button onClick={() => void leaveOrDelete()}>{isOwner ? 'Delete session' : 'Leave session'}</button></p>
    </div>
  )
}
