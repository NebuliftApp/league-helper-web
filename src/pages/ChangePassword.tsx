import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../lib/auth.tsx'

export default function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { changePassword, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters')
    if (password !== confirm) return setError("Passwords don't match")
    const err = await changePassword(password)
    setError(err)
    if (!err) {
      setDone(true)
      setPassword('')
      setConfirm('')
    }
  }

  const form = (
    <form onSubmit={submit} className="stack">
      <label>
        New password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </label>
      <label>
        Confirm
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {done && <p className="ok">Password updated.</p>}
      <button className="primary">Change password</button>
    </form>
  )

  if (!forced) return form
  return (
    <main className="narrow">
      <h1>Choose a new password</h1>
      <p className="muted">Your account was created with a temporary password. Set your own to continue.</p>
      {form}
      <p><button onClick={() => void signOut()}>Sign out</button></p>
    </main>
  )
}
