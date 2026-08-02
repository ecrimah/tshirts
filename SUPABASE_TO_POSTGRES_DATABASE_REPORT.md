# Supabase to Postgres Database Report — Mamator

**Project:** Mamator e-commerce (mamator.com)  
**Cutover target:** `store_mamator` on fleet-postgres (PostgreSQL 16.14)  
**Status:** Runtime fully on plain Postgres; Supabase not used in app code

> **Environment clarification:** Audit work connected to the **production** `store_mamator` database, not a separate staging instance.

---

## Feature matrix

| Capability | Supabase (before) | Plain Postgres (now) | Status |
|------------|-------------------|----------------------|--------|
| **PostgreSQL database** | Managed Supabase Postgres | `fleet-postgres` / `store_mamator` | ✅ Migrated |
| **Schema** | `supabase/migrations/` + dashboard | `db/migrations/` + restored dump | ✅ Migrated |
| **Connection** | `@supabase/supabase-js` service role | `pg` Pool in `lib/db.ts` (`DATABASE_URL`) | ✅ Migrated |
| **Auth users** | `auth.users` (GoTrue) | `public.users` + `public.profiles` | ✅ Migrated |
| **Sessions** | Supabase JWT / cookies | Custom JWT (`jose`) + HttpOnly cookie | ✅ Migrated |
| **Password hashing** | bcrypt (GoTrue) | `bcryptjs` against `users.encrypted_password` | ✅ Compatible |
| **RLS policies** | Per-table policies | Removed — app-layer `verifyAuth()` | ✅ Removed |
| **RPC / functions** | `supabase.rpc()` | `lib/db.ts` `query()` + `rpc()` with name validation | ✅ Migrated |
| **Storage** | Supabase Storage buckets | Local disk `UPLOAD_DIR` + `/api/uploads` | ✅ Migrated |
| **Realtime** | Supabase channels | Not used | ➖ N/A |
| **Edge Functions** | Deno edge | Next.js API routes | ✅ Replaced |
| **Migration tracking** | Supabase CLI history | `schema_migrations` (bootstrapped in 006) | ✅ Added |
| **Payment: Moolre** | RPC + API routes | Same RPCs + hardened callbacks | ✅ Active |
| **Payment: Hubtel** | Never implemented | Never implemented | ➖ N/A |
| **Payment: Paystack** | Never implemented | Never implemented | ➖ N/A |
| **SMS** | Moolre VAS via app code | Same — no DB table | ✅ Active |
| **Email** | Resend via app code | Same | ✅ Active |
| **Cron / reminders** | External trigger | `/api/cron/payment-reminders` + `CRON_SECRET` | ✅ Active |
| **Admin analytics** | Supabase queries | Direct SQL via API routes | ✅ Migrated |
| **Type generation** | `supabase gen types` | Manual / inferred from schema | ⚠️ Manual |
| **Backups** | Supabase dashboard | Fleet `/data/fleet/backups` | ✅ VPS-managed |
| **Local dev** | Supabase local optional | `DATABASE_URL` → VPS or local Postgres | ✅ Documented |

---

## Auth migration detail

| Supabase | Mamator replacement |
|----------|---------------------|
| `auth.signUp()` | `POST /api/auth/signup` → `registerUser()` inserts `users`, trigger creates `profiles` |
| `auth.signInWithPassword()` | `POST /api/auth/login` → `authenticateWithPassword()` |
| `auth.getSession()` | `GET /api/auth/me` → JWT from cookie |
| `auth.signOut()` | `POST /api/auth/logout` → clear cookie |
| `auth.resetPasswordForEmail()` | `POST /api/auth/forgot-password` + `reset-password` |
| `auth.uid()` in RLS | `verifyAuth(request).user.id` in handlers |
| Service role key | `DATABASE_URL` server-side only |

Legacy columns retained for compatibility: `users.email_confirmed_at`, `users.raw_user_meta_data`, `users.last_sign_in_at`.

---

## Data layer migration detail

| Pattern | Before | After |
|---------|--------|-------|
| Client-side Supabase | Browser anon key | Removed — all data via API routes |
| Server Supabase | `createClient(cookies)` | `query()` / `queryOne()` / `withTransaction()` |
| `.from('orders').select()` | PostgREST | Parameterized SQL in `lib/data/*` and route handlers |
| `.rpc('mark_order_paid')` | PostgREST RPC | `SELECT mark_order_paid($1, $2)` or `record_order_payment(...)` |

---

## Storage migration detail

| Before | After |
|--------|-------|
| `supabase.storage.from('products').upload()` | `POST /api/uploads` writes to `UPLOAD_DIR` |
| Public URL from Supabase CDN | `https://mamator.com/uploads/...` (nginx or Next rewrite) |
| 22 objects migrated | Restored under `~/mamator-restore/uploads/` on VPS |

---

## Payment migration detail

| Component | Notes |
|-----------|-------|
| `mark_order_paid` | Retained; superseded by `record_order_payment` for half-pay |
| `record_order_payment` | Added in 004; row lock in 007 |
| `payment_reconciliation_log` | Added in 005 for admin audit |
| `payment_callback_events` | Added in 008 for gateway idempotency |
| Moolre env vars | Unchanged — `MOOLRE_API_*`, `MOOLRE_CALLBACK_SECRET` |
| Hubtel / Paystack | **Not present** in Supabase era or Postgres era |

---

## Schema source of truth

| Location | Role |
|----------|------|
| `db/migrations/001_plain_postgres.sql` | Canonical full schema for fresh installs |
| `db/migrations/002`–`009` | Incremental hardening |
| `supabase/migrations/*.sql` | Historical reference only |
| Live DB | Authoritative after cutover + migrate-db |

---

## Environment variable mapping

| Remove (Supabase) | Add / keep (Postgres) |
|-------------------|------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_APP_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — (remove) |
| `SUPABASE_SERVICE_ROLE_KEY` | — (remove) |
| `SUPABASE_URL` | — (remove) |
| — | `DATABASE_URL` |
| — | `AUTH_SECRET` |
| — | `AUTH_COOKIE_NAME` (optional) |
| — | `UPLOAD_DIR` |

Payment, email, and SMS vars (Moolre, Resend) unchanged.

---

## Verification (post-cutover)

```bash
# No Supabase in runtime app code
rg "@supabase" app lib middleware components context --glob "!scripts/**"

# DB connectivity
node scripts/test-db-schema.mjs

# HTTP health
curl -s https://mamator.com/api/health/db | jq .
```

Expected: zero `@supabase` imports in runtime paths; smoke test passes; health returns `"status": "healthy"`.

---

## Related docs

- `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` — reusable playbook
- `DATABASE_AUDIT_AND_REPAIR_REPORT.md` — live audit findings
- `MIGRATION_STATUS_REPORT.md` — migration ledger 001–009
- `DATABASE_RECOVERY_GUIDE.md` — backup and restore
