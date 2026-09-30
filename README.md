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

## One-time setup (done for the live project)
1. Create a Supabase project, then link it: `supabase link --project-ref <ref>`.
2. Schema: `supabase db query --linked -f supabase/migrations/0001_init.sql`.
3. Function: `supabase functions deploy admin-users --project-ref <ref>`.
4. Auth config (sign-up off, site URL): `supabase config push --project-ref <ref>`
   (`supabase/config.toml` declares only those settings).
5. Admin user: create via the Auth admin API with email `<username>@league-helper.invalid`
   (email_confirm true), then
   ```sql
   insert into profiles (id, username, role, must_change_password)
   select id, '<username>', 'admin', true from auth.users where email = '<username>@league-helper.invalid';
   ```
6. GitHub: Pages source = GitHub Actions; repo variables `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (both public values).

Live: https://nebuliftapp.github.io/league-helper-web/

## Develop
```sh
cp .env.example .env.local   # fill in
npm install && npm run dev
npm run build && npm run lint
```
