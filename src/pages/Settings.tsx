import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../lib/auth.tsx'
import { supabase } from '../lib/supabase.ts'
import ChangePassword from './ChangePassword.tsx'

export default function Settings() {
  const { profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [saved, setSaved] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    await supabase.from('profiles').update({ display_name: name.trim() || null }).eq('id', profile!.id)
    await refreshProfile()
    setSaved(true)
  }

  return (
    <div className="narrow-block">
      <h1>Settings</h1>
      <section>
        <h2>Profile</h2>
        <p className="muted">Username: <code>{profile?.username}</code> (set by the admin)</p>
        <form onSubmit={save} className="stack">
          <label>
            Display name
            <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} maxLength={60} />
          </label>
          {saved && <p className="ok">Saved.</p>}
          <button className="primary">Save</button>
        </form>
      </section>
      <section>
        <h2>Password</h2>
        <ChangePassword />
      </section>
    </div>
  )
}
