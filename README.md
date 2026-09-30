# league-helper-web

Web companion to the native `league-helper` macOS app: accounts for you and your
coach, and shared coaching sessions. Static SPA on GitHub Pages; Supabase
(Postgres + Auth + Edge Functions) as the backend. No public sign-up.

## Model
- **Accounts** are created by the admin in `/admin` (username + temporary password,
  forced change on first login). Roles: `admin`, `coach`, `user`.
- **Sessions**: anyone can create one. Members invite others by username; the
  invitee accepts or declines. Members share notes and goals, live.
- Authorization is Postgres RLS (`supabase/migrations/0001_init.sql`); the browser
  only holds the public anon key. Admin actions go through the `admin-users` Edge
  Function, which holds the service-role key and checks the caller is an admin.

## One-time setup
1. Create a Supabase project. Auth → Providers → Email: **disable "Allow new users to sign up"**
   and "Confirm email".
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Create your admin: Auth → Users → Add user (email `<username>@league-helper.invalid`,
   a password, auto-confirm), then in the SQL editor:
   ```sql
   insert into profiles (id, username, role, must_change_password)
   select id, '<username>', 'admin', false from auth.users where email = '<username>@league-helper.invalid';
   ```
4. Deploy the function: `supabase link --project-ref <ref> && supabase functions deploy admin-users`.
5. GitHub repo → Settings → Pages → Source: **GitHub Actions**; Settings → Variables →
   add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (both public values).
6. Supabase → Auth → URL config: add the Pages URL as a site URL.

## Develop
```sh
cp .env.example .env.local   # fill in
npm install && npm run dev
npm run build && npm run lint
```
