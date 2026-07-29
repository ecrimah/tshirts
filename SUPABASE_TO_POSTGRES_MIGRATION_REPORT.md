# Supabase → PostgreSQL Migration Report — Mamator

**Project:** mamator.com  
**Database:** `store_mamator` on VPS fleet-postgres  
**Migration branch:** `staging/plain-postgres` (historical) → current `main`

---

## Supabase features previously used

| Feature | Evidence | Replacement |
|---------|----------|-------------|
| Supabase Auth | Historical `auth.users`, session cookies | `users` + `profiles` + JWT cookie (`lib/auth/*`) |
| PostgREST / JS client | Removed from runtime | `pg` pool + SQL (`lib/db.ts`, `lib/data/*`) |
| Row Level Security | Policies on tables (removed in dump) | API route authorization |
| Storage buckets | Product/CMS image URLs | `UPLOAD_DIR` + nginx `/uploads/` |
| Realtime | Not used in current UI | N/A |
| Edge Functions | Not used | Next.js API routes |
| Database RPC | `mark_order_paid`, `update_customer_stats`, etc. | Retained as Postgres functions |

---

## Remaining Supabase references

| Location | Type | Action |
|----------|------|--------|
| `lib/site-brand.ts` | URL rewrite for old storage URLs | Keep — handles legacy DB URLs |
| `scripts/dump-from-supabase.mjs` | One-off migration script | Keep in `scripts/` |
| `scripts/migrate-storage-urls.mjs` | URL rewrite utility | Keep |
| `docs/*` | Documentation | Keep |
| Runtime `app/`, `lib/`, `components/` | **None** | Clean |

**Supabase query patterns** (`.eq()`, `.select()`, `createClient`): **0 matches** in runtime TypeScript.

---

## Schema differences & data integrity

- **IDs:** UUID primary keys preserved from Supabase.
- **Enums:** `order_status`, `payment_status` retained as Postgres enums.
- **Users:** `users.encrypted_password` (bcrypt) replaces Supabase auth hashes where migrated; password reset available.
- **Metadata:** JSONB columns on orders/products — used for Moolre refs, stock flags, variant data.
- **Legacy URLs:** Products/CMS may still contain old `supabase.co/storage` paths — rewritten at display time via `lib/site-brand.ts` and migration scripts.

### Migration applied during audit

`db/migrations/002_mark_order_paid_idempotent.sql` — makes `mark_order_paid()` skip re-processing already-paid orders and prevents stock double-reduction.

---

## Authentication changes

| Before | After |
|--------|-------|
| Supabase session + `sb-access-token` cookie | `mamator_session` JWT cookie |
| `auth.uid()` in RLS | Explicit `user_id` in queries + `verifyAuth()` |
| Supabase magic link / OAuth | Email/password only (OAuth not migrated) |

**Middleware:** Removed fallback to `sb-access-token` (2026-07-29). Admins with stale cookies must re-login once.

---

## Storage changes

| Before | After |
|--------|-------|
| `https://*.supabase.co/storage/v1/object/public/...` | `https://mamator.com/uploads/...` |
| Supabase signed URLs | Direct public paths under `/uploads/` |

Upload flow: `POST /api/uploads` → disk → served by Next/nginx.

---

## RLS replacement

RLS policies were disabled during DB restore. Authorization now enforced in:

- `middleware.ts` — admin routes
- `lib/auth/index.ts` — `verifyAuth()`, `requireAdmin`
- Per-route checks on orders, addresses, profile APIs

**Gap:** Public read endpoints (storefront catalog, order summary by ref) intentionally open.

---

## RPC replacements

All former Supabase RPC calls now use:

```typescript
await queryOne(`SELECT mark_order_paid($1, $2) AS result`, [orderRef, moolreRef]);
```

Functions live in `db/migrations/001_plain_postgres.sql` and `002_mark_order_paid_idempotent.sql`.

---

## Migration scripts

| Script | Purpose |
|--------|---------|
| `scripts/migrate-db.mjs` | Apply SQL migrations |
| `scripts/dump-from-supabase.mjs` | Historical Supabase dump |
| `scripts/migrate-storage-urls.mjs` | Rewrite storage URLs in DB |
| `scripts/download-supabase-storage.mjs` | Download bucket objects |

---

## Test results

| Test | Result |
|------|--------|
| Runtime Supabase import scan | Pass |
| Auth login/signup API | Code review pass |
| Admin middleware | Pass |
| Product catalog from Postgres | Pass (live site) |
| Variant metadata in API | Pass (deployed 37ef2e6) |
| Payment flow | Hardened locally; pending deploy |

---

## Recommendations

1. Deploy payment hardening branch to production.
2. Run `scripts/migrate-storage-urls.mjs` if any broken images remain.
3. Add integration tests for auth + order ownership.
4. Document that Hubtel/Paystack were never part of this Supabase app.

See also: `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` (playbook for other stores).
