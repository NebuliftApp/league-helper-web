import { useState } from 'react'
import type { FormEvent } from 'react'
import { Callout } from '../components/ui.tsx'
import { useAuth } from '../lib/auth.tsx'

export default function Login() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await signIn(username, password))
    setBusy(false)
  }

  return (
    <div className="auth">
      <div className="auth-inner">
        <h1>Sign in</h1>
        <p className="sub">Use the username your admin gave you. There's no sign-up.</p>
        {error && <Callout tone="error">{error}</Callout>}
        <form onSubmit={submit} className="form">
          <label className="field">Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus required />
          </label>
          <label className="field">Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          <button className="btn primary wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  )
}
