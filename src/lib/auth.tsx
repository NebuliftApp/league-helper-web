import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import type { Profile } from './types'

// Accounts are username-first; Supabase Auth needs an email, so one is synthesised.
// Keep in sync with supabase/functions/admin-users/index.ts.
const EMAIL_DOMAIN = 'league-helper.invalid'
export const usernameToEmail = (u: string) => `${u.trim().toLowerCase()}@${EMAIL_DOMAIN}`

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  changePassword: (password: string) => Promise<string | null>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, role, display_name, must_change_password')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data as Profile | null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      // Defer: calling supabase inside this callback can deadlock the client.
      setTimeout(() => void loadProfile(next?.user.id), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      signIn: async (username, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: usernameToEmail(username),
          password,
        })
        return error ? 'Wrong username or password' : null
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
      changePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) return error.message
        await supabase.from('profiles').update({ must_change_password: false }).eq('id', session?.user.id ?? '')
        await loadProfile(session?.user.id)
        return null
      },
      refreshProfile: () => loadProfile(session?.user.id),
    }),
    [session, profile, loading, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
