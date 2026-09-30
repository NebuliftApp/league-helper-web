import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth.tsx'
import { isConfigured } from './lib/supabase.ts'
import Admin from './pages/Admin.tsx'
import ChangePassword from './pages/ChangePassword.tsx'
import Login from './pages/Login.tsx'
import SessionDetail from './pages/SessionDetail.tsx'
import Sessions from './pages/Sessions.tsx'
import Settings from './pages/Settings.tsx'

export default function App() {
  const { session, profile, loading, signOut } = useAuth()

  if (!isConfigured) {
    return (
      <main className="narrow">
        <h1>Not configured</h1>
        <p className="muted">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see{' '}
          <code>.env.example</code>).
        </p>
      </main>
    )
  }
  if (loading) return <main className="narrow muted">Loading…</main>
  if (!session) return <Login />
  if (!profile) {
    return (
      <main className="narrow">
        <h1>No profile</h1>
        <p className="muted">Your login exists but has no profile. Ask the admin to set it up.</p>
        <button onClick={() => void signOut()}>Sign out</button>
      </main>
    )
  }
  if (profile.must_change_password) return <ChangePassword forced />

  return (
    <>
      <header className="bar">
        <strong>League Helper</strong>
        <nav>
          <NavLink to="/" end>Sessions</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          {profile.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <span className="spacer" />
        <span className="muted">
          {profile.display_name || profile.username} · {profile.role}
        </span>
        <button onClick={() => void signOut()}>Sign out</button>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Sessions />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={profile.role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
