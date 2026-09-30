import { useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader, RoleChip, Section } from '../components/ui.tsx'
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
    <>
      <PageHeader title="Settings" />
      <Section title="Profile">
        <div className="group">
          <div className="row">
            <div className="row-main"><div className="row-title">Username</div><div className="row-meta">Set by your admin</div></div>
            <div className="end"><code>{profile?.username}</code><RoleChip role={profile!.role} /></div>
          </div>
        </div>
        <form onSubmit={save} className="form" style={{ marginTop: 16 }}>
          <label className="field">Display name
            <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} maxLength={60} placeholder={profile?.username} />
          </label>
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn primary">Save</button>
            {saved && <span className="row-meta">Saved</span>}
          </div>
        </form>
      </Section>
      <Section title="Password"><ChangePassword /></Section>
    </>
  )
}
