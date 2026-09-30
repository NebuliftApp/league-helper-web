-- league-helper-web: accounts, coaching sessions, invites, shared notes.
-- Authorization lives here (RLS); the browser only ever holds the anon key.

create type public.app_role as enum ('admin', 'coach', 'user');
create type public.member_role as enum ('coach', 'student');
create type public.invite_status as enum ('pending', 'accepted', 'declined');
create type public.note_kind as enum ('note', 'goal');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  role public.app_role not null default 'user',
  display_name text,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  owner_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.session_members (
  session_id uuid not null references public.coaching_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null,
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- session_title / invited_by_username are snapshots so an invitee (not yet a
-- member, so unable to read the session) can still see what they were asked to join.
create table public.session_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coaching_sessions (id) on delete cascade,
  session_title text not null,
  invited_user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  invited_by_username text not null,
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now()
);
create unique index session_invites_one_pending
  on public.session_invites (session_id, invited_user_id) where status = 'pending';

create table public.session_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.coaching_sessions (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  kind public.note_kind not null default 'note',
  body text not null check (length(body) between 1 and 5000),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Helpers. SECURITY DEFINER so policies can consult tables without recursing into RLS.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function public.is_member(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from session_members where session_id = p_session and user_id = auth.uid());
$$;

create function public.shares_session(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from session_members a
    join session_members b on a.session_id = b.session_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.coaching_sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.session_invites enable row level security;
alter table public.session_notes enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.shares_session(id));
-- Users may only touch display_name / must_change_password (enforced by column grants below).
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name, must_change_password) on public.profiles to authenticated;

create policy sessions_read on public.coaching_sessions for select to authenticated
  using (public.is_member(id) or public.is_admin());
create policy sessions_insert on public.coaching_sessions for insert to authenticated
  with check (owner_id = auth.uid());
create policy sessions_update on public.coaching_sessions for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy sessions_delete on public.coaching_sessions for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy members_read on public.session_members for select to authenticated
  using (public.is_member(session_id) or public.is_admin());
-- Members leave themselves; the owner can remove anyone. Joining only via the functions below.
create policy members_delete on public.session_members for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from coaching_sessions s where s.id = session_id and s.owner_id = auth.uid())
  );

create policy invites_read on public.session_invites for select to authenticated
  using (invited_user_id = auth.uid() or public.is_member(session_id) or public.is_admin());
create policy invites_cancel on public.session_invites for delete to authenticated
  using (invited_by = auth.uid());

create policy notes_read on public.session_notes for select to authenticated
  using (public.is_member(session_id) or public.is_admin());
create policy notes_insert on public.session_notes for insert to authenticated
  with check (author_id = auth.uid() and public.is_member(session_id));
create policy notes_update on public.session_notes for update to authenticated
  using (public.is_member(session_id)) with check (public.is_member(session_id));
create policy notes_delete on public.session_notes for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Creator joins their own session, as coach or student according to their account role.
create function public.add_owner_as_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into session_members (session_id, user_id, role)
  select new.id, new.owner_id,
         case when p.role = 'user' then 'student'::member_role else 'coach'::member_role end
  from profiles p where p.id = new.owner_id;
  return new;
end $$;
create trigger coaching_sessions_add_owner after insert on public.coaching_sessions
  for each row execute function public.add_owner_as_member();

-- Invite by username. Caller must already be a member.
create function public.invite_to_session(p_session uuid, p_username text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  target profiles;
  me profiles;
  sess coaching_sessions;
  invite_id uuid;
begin
  select * into me from profiles where id = auth.uid();
  select * into sess from coaching_sessions where id = p_session;
  if sess.id is null or not is_member(p_session) then
    raise exception 'Not a member of that session';
  end if;
  select * into target from profiles where username = lower(trim(p_username));
  if target.id is null then raise exception 'No user named %', p_username; end if;
  if target.id = me.id then raise exception 'You are already in this session'; end if;
  if exists (select 1 from session_members where session_id = p_session and user_id = target.id) then
    raise exception '% is already in this session', target.username;
  end if;
  insert into session_invites (session_id, session_title, invited_user_id, invited_by, invited_by_username)
  values (p_session, sess.title, target.id, me.id, me.username)
  returning id into invite_id;
  return invite_id;
exception when unique_violation then
  raise exception '% already has a pending invite', lower(trim(p_username));
end $$;

create function public.respond_to_invite(p_invite uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  inv session_invites;
  me profiles;
begin
  select * into inv from session_invites
   where id = p_invite and invited_user_id = auth.uid() and status = 'pending';
  if inv.id is null then raise exception 'Invite not found'; end if;
  if p_accept then
    select * into me from profiles where id = auth.uid();
    insert into session_members (session_id, user_id, role)
    values (inv.session_id, me.id,
            case when me.role = 'user' then 'student'::member_role else 'coach'::member_role end)
    on conflict do nothing;
    update session_invites set status = 'accepted' where id = inv.id;
  else
    update session_invites set status = 'declined' where id = inv.id;
  end if;
end $$;

revoke all on function public.invite_to_session(uuid, text) from public, anon;
revoke all on function public.respond_to_invite(uuid, boolean) from public, anon;
grant execute on function public.invite_to_session(uuid, text) to authenticated;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;

-- Live updates while coach and student work in the same session.
alter publication supabase_realtime add table public.session_notes, public.session_members;
