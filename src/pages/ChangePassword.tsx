import { useState } from 'react'
import type { FormEvent } from 'react'
import { Callout } from '../components/ui.tsx'
import { useAuth } from '../lib/auth.tsx'

export default function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { changePassword, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setDone(false)
    if (password.length < 8) return setError('Use at least 8 characters')
    if (password !== confirm) return setError("Passwords don't match")
    const err = await changePassword(password)
    setError(err)
    if (!err) { setDone(true); setPassword(''); setConfirm('') }
  }

  const form = (
    <form onSubmit={submit} className="form">
      {error && <Callout tone="error">{error}</Callout>}
      {done && <Callout tone="ok">Password updated.</Callout>}
      <label className="field">New password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </label>
      <label className="field">Confirm password
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </label>
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="btn primary">Change password</button>
      </div>
    </form>
  )

  if (!forced) return form
  return (
    <div className="auth">
      <div className="auth-inner">
        <h1>Choose a password</h1>
        <p className="sub">Your account started with a temporary password. Set your own to continue.</p>
        {form}
        <div className="actions"><button className="btn quiet" onClick={() => void signOut()}>Sign out</button></div>
      </div>
    </div>
  )
}
