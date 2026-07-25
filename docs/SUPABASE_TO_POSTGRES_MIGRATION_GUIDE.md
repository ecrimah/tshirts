# Supabase → Plain Postgres (VPS) — Migration Guide

Reusable playbook for Next.js store projects. Example domain: **mamator.com**. No secrets in this doc—use placeholders only.

---

## 1. Inventory checklist

Before changing code, audit the repo and Supabase dashboard:

| Area | What to find | Notes |
|------|----------------|-------|
| **Auth** | `@supabase/ssr`, `createClient`, magic link/OAuth, session refresh | Map to cookie/JWT session in Next.js |
| **RLS / `auth.uid()`** | Policies on tables; `auth.uid()` in views/RPCs | RLS goes away; enforce in API + SQL roles |
| **Storage** | Buckets, public URLs, `storage.from()` | → `/uploads` on VPS + nginx |
| **RPC** | `supabase.rpc('…')` | Keep as `SECURITY DEFINER` functions in Postgres |
| **Client vs service role** | Browser anon key vs server service role | → `DATABASE_URL` server-only; no anon key in browser |
| **Realtime / Edge** | Channels, Deno functions | Replace with polling/webhooks or drop if unused |

Deliverable: spreadsheet or markdown list of every Supabase touchpoint (file path + feature).

---

## 2. Target architecture

```
Browser → Next.js (App Router)
            ├── Middleware: session cookie
            ├── Route Handlers / Server Actions: business logic
            └── lib/db: pg Pool (DATABASE_URL)

Postgres on VPS (localhost or private network)
Uploads: UPLOAD_DIR on disk → nginx location /uploads/
```

- **Auth**: signed HTTP-only cookie (e.g. `iron-session` or custom JWT + `AUTH_SECRET`).
- **DB**: single `pg` pool; parameterized queries only.
- **Files**: write to `UPLOAD_DIR`; serve via `https://mamator.com/uploads/...` (or CDN later).

---

## 3. Schema remap

1. **`auth.users` → `public.users`** (or `app.users`): export id, email, encrypted_password/metadata; align with your app’s `profiles` FK.
2. **Drop RLS** on all tables: `ALTER TABLE … DISABLE ROW LEVEL SECURITY;` then drop policies.
3. **Replace `auth.uid()`** in functions/views with `current_setting('app.user_id', true)::uuid` (set per request in API) or pass `user_id` as RPC argument.
4. **Keep useful RPCs** as `SECURITY DEFINER` with explicit `GRANT EXECUTE` to app role; revoke public access where needed.
5. **Sequences / UUIDs**: preserve Supabase defaults (`gen_random_uuid()`) where already used.

---

## 4. Environment mapping

| Supabase / old | New (VPS Postgres) | Purpose |
|----------------|----------------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_APP_URL` | e.g. `https://mamator.com` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(remove)* | No client DB key |
| `SUPABASE_SERVICE_ROLE_KEY` | *(remove)* | Replaced by server DB access |
| `SUPABASE_URL` + keys | `DATABASE_URL` | `postgresql://app:***@127.0.0.1:5432/mamator` |
| *(implicit JWT)* | `AUTH_SECRET` | Session signing (long random string) |
| Storage bucket paths | `UPLOAD_DIR` | e.g. `/var/www/mamator/uploads` |
| `SUPABASE_JWT_SECRET` | `AUTH_SECRET` or separate `JWT_SECRET` | If you issue JWTs |

Add VPS-only vars as needed: `NODE_ENV=production`, `PORT=3000`.

---

## 5. Dump / restore steps

### Database

```bash
# From Supabase (or linked Postgres)
pg_dump "$SUPABASE_DB_URL" --no-owner --no-acl -F c -f supabase.dump

# On VPS
createdb mamator
pg_restore -d mamator --no-owner --no-acl supabase.dump
```

### Auth users

- Export `auth.users` (and identities if OAuth): CSV or `COPY` via service role SQL.
- Transform into `public.users` insert script; hash passwords only if migrating compatible format or force password reset.

### Storage

- List objects per bucket (Supabase CLI or script); download to local staging.
- Upload to VPS `UPLOAD_DIR` preserving key paths (`products/abc.jpg`).
- **URL rewrite**: replace `https://*.supabase.co/storage/v1/object/public/...` with `https://mamator.com/uploads/...` in DB (`products.image_url`, etc.).

### Sanity SQL

```sql
SELECT count(*) FROM public.users;
SELECT count(*) FROM pg_policies;  -- expect 0 after cleanup
```

---

## 6. App cutover order

1. **DB layer** — `lib/db.ts` pool; replace Supabase query helpers.
2. **Auth** — login/logout/register; middleware session; admin role checks.
3. **Storefront APIs** — catalog, cart, checkout read paths.
4. **Admin** — CRUD, uploads to disk, order management.
5. **Payments** — webhooks unchanged if external; ensure order writes use Postgres transactions.
6. **Remove SDK** — delete `@supabase/*` deps; grep repo for `supabase`; update env samples and CI.

Deploy to staging with production-like `DATABASE_URL` before DNS cutover.

---

## 7. VPS deploy notes (mamator.com)

**nginx** (example):

- `server_name mamator.com;`
- `location / { proxy_pass http://127.0.0.1:3000; }`
- `location /uploads/ { alias /var/www/mamator/uploads/; }`
- Separate `server` block for `www.mamator.com` → `301 https://mamator.com$request_uri`

**Process**: PM2 (`pm2 start npm --name mamator -- start`) or Docker with bind mount for uploads.

**Volumes**: persist `UPLOAD_DIR` and Postgres data directory; backup both on schedule.

**TLS**: certbot for `mamator.com` (+ redirect www).

**Firewall**: 5432 not public; Postgres listens on localhost or private IP only.

---

## 8. Verification matrix

| Check | How |
|-------|-----|
| Login / logout / session refresh | Manual + optional e2e |
| Guest checkout | Complete test order |
| Admin upload | File on disk + URL loads |
| Order payment webhook | Test mode event → row in DB |
| No Supabase in bundle | `rg '@supabase' src/` empty |
| Env on server | Only new vars set |
| HTTPS + www redirect | curl `-I` both hostnames |
| DB connections | No pool exhaustion under load smoke test |

Record pass/fail in project README or ticket.

---

## 9. Rollback notes

- Keep Supabase project **paused**, not deleted, until 48–72h stable traffic.
- Maintain pre-cutover DB dump and env snapshot (names only in git).
- DNS rollback: point `mamator.com` back only if you still have a running Supabase-backed build (tag release `pre-postgres-cutover`).
- Storage rollback: retain downloaded bucket copy until uploads verified.

If schema migrations are one-way, rollback = restore old app version + old DB dump, not forward-compatible downgrade.

---

## 10. Reuse on the next project

1. Copy this file to `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` in the new repo.
2. Run **§1 inventory**; append project-specific tables/RPCs/buckets.
3. Update **§4** with actual table prefixes and domain (replace mamator.com).
4. Use the user-level Cursor rule **agent-composer-collaboration**: main agent for §2–3 and verification; Composer for mechanical rewrites per **§6**.
5. After cutover, commit the filled-in guide (still no secrets) and note date + git tag.

**Mamator** is the reference implementation—align nginx paths and env names with whatever was deployed here when in doubt.

---

## 11. Mamator implementation status (2026-07-24)

### Done in repo
- Runtime app has **zero** `@supabase/*` imports (`app/`, `components/`, `context/`, `lib/`, `middleware`).
- Plain schema: `db/migrations/001_plain_postgres.sql`, post-import: `002_post_supabase_import.sql`.
- Auth: HttpOnly cookie JWT (`jose`) + `bcryptjs` against `public.users` / `profiles.role`.
- Data: `lib/db.ts` (`pg`), storefront/admin/payment/cron APIs, local uploads API.
- Deploy stubs: `docker-compose.yml`, `Dockerfile` (`output: 'standalone'`), `deploy/nginx/mamator.com.conf`.
- Env template: `.env.example` (`NEXT_PUBLIC_APP_URL=https://mamator.com`).
- One-time ops scripts: `db:dump-supabase`, `db:download-storage`, `db:migrate-storage-urls`, `db:migrate`, `create-admin`.
- User Cursor rule: `~/.cursor/rules/agent-composer-collaboration.mdc` (always apply).

### Waiting on you
1. Provide `.env.local` (`DATABASE_URL`, `AUTH_SECRET`, payments/email keys).
2. Big VPS SSH access.
3. Run dump → restore → `002` → storage download → URL rewrite → deploy nginx for **mamator.com**.

### Legacy
- Many old `scripts/*.mjs` maintenance tools still mention Supabase; they are not used at runtime. Prefer new `pg` scripts or archive them after cutover.

## Related

- [`STORE_HARDENING_PLAYBOOK.md`](./STORE_HARDENING_PLAYBOOK.md) — production hardening after cutover.
