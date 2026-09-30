import { useState } from 'react'
import type { FormEvent } from 'react'
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
    <main className="narrow">
      <h1>League Helper</h1>
      <p className="muted">Sign in with the username your admin gave you. There's no sign-up.</p>
      <form onSubmit={submit} className="stack">
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>Sign in</button>
      </form>
    </main>
  )
}
