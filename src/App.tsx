import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Avatar, Icon } from './components/ui.tsx'
import { useAuth } from './lib/auth.tsx'
import { isConfigured } from './lib/supabase.ts'
import Admin from './pages/Admin.tsx'
import ChangePassword from './pages/ChangePassword.tsx'
import Login from './pages/Login.tsx'
import SessionDetail from './pages/SessionDetail.tsx'
import Sessions from './pages/Sessions.tsx'
import Settings from './pages/Settings.tsx'

function Plain({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth"><div className="auth-inner"><h1>{title}</h1>{children}</div></div>
  )
}

export default function App() {
  const { session, profile, loading, signOut } = useAuth()

  if (!isConfigured) {
    return (
      <Plain title="Not configured">
        <p className="sub">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>).</p>
      </Plain>
    )
  }
  if (loading) return <Plain title="League Helper"><p className="sub">Loading…</p></Plain>
  if (!session) return <Login />
  if (!profile) {
    return (
      <Plain title="No profile">
        <p className="sub" style={{ marginBottom: 16 }}>Your login exists but has no profile. Ask the admin to set it up.</p>
        <button className="btn" onClick={() => void signOut()}>Sign out</button>
      </Plain>
    )
  }
  if (profile.must_change_password) return <ChangePassword forced />

  const name = profile.display_name || profile.username
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">League<span>Helper</span></div>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end><Icon name="sessions" /><span>Sessions</span></NavLink>
          <NavLink to="/settings"><Icon name="settings" /><span>Settings</span></NavLink>
          {profile.role === 'admin' && (
            <>
              <div className="nav-label">Admin</div>
              <NavLink to="/admin"><Icon name="people" /><span>Accounts</span></NavLink>
            </>
          )}
        </nav>
        <div className="me">
          <Avatar name={name} />
          <div className="me-text">
            <div className="me-name">{name}</div>
            <div className="me-role">{profile.role}</div>
          </div>
          <button className="btn quiet" onClick={() => void signOut()}>Sign out</button>
        </div>
      </aside>
      <main className="content">
        <div className="content-inner">
          <Routes>
            <Route path="/" element={<Sessions />} />
            <Route path="/sessions/:id" element={<SessionDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={profile.role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
