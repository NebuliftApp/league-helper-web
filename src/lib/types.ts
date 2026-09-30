export type AppRole = 'admin' | 'coach' | 'user'

export interface Profile {
  id: string
  username: string
  role: AppRole
  display_name: string | null
  must_change_password: boolean
}

export interface CoachingSession {
  id: string
  title: string
  owner_id: string
  created_at: string
}

export interface Member {
  user_id: string
  role: 'coach' | 'student'
  profiles: { username: string; display_name: string | null } | null
}

export interface Invite {
  id: string
  session_id: string
  session_title: string
  invited_by_username: string
  invited_user_id: string
  status: 'pending' | 'accepted' | 'declined'
  profiles?: { username: string } | null
}

export interface Note {
  id: string
  author_id: string
  kind: 'note' | 'goal'
  body: string
  done: boolean
  created_at: string
  profiles: { username: string } | null
}

export interface AdminUser {
  id: string
  username: string
  role: AppRole
  display_name: string | null
  disabled: boolean
}
