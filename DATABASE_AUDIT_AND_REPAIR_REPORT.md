# Database Audit and Repair Report — Mamator

**Date:** 2026-08-02  
**Site:** [mamator.com](https://mamator.com) (production Coolify app `mamator-app`)  
**Database:** `store_mamator` on `fleet-postgres` (PostgreSQL 16.14)  
**App DB role:** `store_mamator`

> **Environment note:** The audit prompt referenced a “staging” context, but the connected database is the **live production store** (`store_mamator` serving mamator.com). There is no separate Mamator staging database on fleet-postgres. All findings and repair targets below apply to production.

---

## 1. Architecture summary

| Layer | Implementation |
|-------|----------------|
| **Database** | PostgreSQL 16.14 in Docker container `fleet-postgres` on big VPS |
| **Database name** | `store_mamator` |
| **Application role** | `store_mamator` (full CRUD on public tables; EXECUTE on payment RPCs) |
| **Runtime access** | Single `pg` connection pool in `lib/db.ts` (`max: 20`, singleton via `global.__mamatorPgPool`) |
| **ORM** | None — no Prisma, Drizzle, or Supabase client in runtime app code |
| **Migrations (active)** | `db/migrations/*.sql` applied by `node scripts/migrate-db.mjs`, tracked in `schema_migrations` |
| **Migrations (legacy)** | `supabase/migrations/` — historical Supabase-era SQL only; **not** applied by migrate-db |
| **Auth** | Custom JWT sessions (`jose` + `AUTH_SECRET`) + `bcryptjs` against `public.users` / `public.profiles` |
| **Authorization** | App-layer (`verifyAuth`, `isStaffRole` in route handlers) — RLS removed at cutover |
| **Payments** | Moolre only (`record_order_payment`, `mark_order_paid` PostgreSQL functions) |
| **SMS** | Moolre VAS API via `lib/notifications.ts` — no `sms_messages` table; dedupe via `orders.metadata.confirmation_sent_at` |

Connection string is supplied at runtime as `DATABASE_URL` (Coolify env / `.env.local` locally). Do not commit credentials.

---

## 2. Baseline inventory (live, 2026-08-02)

Audit executed against `store_mamator` via VPS inventory scripts (`scripts/_db_audit_inventory.sh`, `scripts/_db_integrity.sh`).

### Row counts

| Entity | Count |
|--------|------:|
| Orders (total) | 3 |
| Orders (paid) | 1 |
| Orders (pending payment) | 2 |
| Products | 13 |
| Users | 6 |

### Schema objects

- **32 base tables** in `public` at initial audit (before migrations 008–009)
- **51 enum labels** across 14 custom types (`order_status`, `payment_status` including `partially_paid`, etc.)
- **35 foreign keys**, **15 unique constraints**, **79 indexes** (pre-009)
- **47 functions** in `public` (includes `pgcrypto` helpers and store RPCs)

### Data integrity scan (live)

All checks returned **0** anomalies:

| Check | Result |
|-------|--------|
| Orphan `order_items` (no parent order) | 0 |
| Orphan `profiles` (no parent user) | 0 |
| Users without profiles | 0 |
| Duplicate order numbers | 0 |
| Duplicate product slugs | 0 |
| Duplicate user emails (case-insensitive) | 0 |
| Negative order totals | 0 |
| Order items with quantity ≤ 0 | 0 |
| Paid orders stuck in `awaiting_payment` | 0 |
| Orders with missing `user_id` FK target | 0 |

---

## 3. Drift and gaps found

### 3.1 Missing migration tracking

`schema_migrations` did **not exist** on live `store_mamator` at audit time. Payment and schema SQL files in `db/migrations/` had been applied manually or piecemeal during Supabase→Postgres cutover, but there was no canonical ledger.

**Impact:** `migrate-db.mjs` could not safely skip already-applied files; re-running risked duplicate-object errors or unintended re-execution.

**Repair:** Migration `006_schema_migrations_bootstrap.sql` creates the table and backfills rows for `001`–`005`.

### 3.2 Payment hardening gaps (pre-repair)

| Issue | Risk |
|-------|------|
| Callback accepted success without Moolre API verify | Fraudulent or replayed callbacks could mark orders paid |
| No row lock in `record_order_payment` | Concurrent callbacks could double-apply partial payments |
| Admin PATCH could set `payment_status` | Manual bypass of payment reconciliation |
| Public order summary exposed PII | Email, phone, full addresses visible without proof of ownership |
| No callback event log | No idempotency audit trail for gateway references |
| Reminder SMS used raw `order.total` | Half-pay orders reminded for full amount instead of balance due |
| `orders.currency` default was `USD` | New orders defaulted to wrong currency for Ghana store |
| `rpc()` accepted arbitrary function names | Injection surface if caller passed untrusted names |

### 3.3 Legacy Supabase artifacts

- `supabase/migrations/` retained for history (`20260209000000_complete_schema.sql`, etc.)
- `is_admin_or_staff()` stub returns `false` (RLS-era helper; app uses JWT role checks instead)
- `users` table mirrors former `auth.users` shape (`encrypted_password`, `raw_user_meta_data`)
- Some orders may still have `currency = 'USD'` from pre-009 defaults (existing rows unchanged; new default is GHS)

### 3.4 Not implemented (confirmed absent)

- **Hubtel** — no routes, env vars, or SDK references
- **Paystack** — no routes, env vars, or SDK references
- Dedicated **SMS log table** — SMS is fire-and-forget via Moolre API

---

## 4. Repairs applied (code + migrations)

### Application layer

| Area | Fix |
|------|-----|
| **Moolre callback** | Requires `verifyMoolrePayment()` before `record_order_payment`; logs to `payment_callback_events`; dedupes processed gateway references |
| **Order summary API** | PII redaction for unauthenticated callers; full detail only for staff or matching `email` query param |
| **Admin order PATCH** | Rejects `payment_status` in body — must use Payment Reconcile |
| **Payment reminders** | `sendPaymentLink()` uses `getChargeAmountForOrder()` for correct half/full balance |
| **DB health** | New `GET /api/health/db` — connection + critical table existence |
| **RPC helper** | `lib/db.ts` `rpc()` validates function name against `[a-zA-Z_][a-zA-Z0-9_]*` |

### Database migrations (007–009)

| Migration | Purpose |
|-----------|---------|
| `007_record_order_payment_lock.sql` | `SELECT … FOR UPDATE` in `record_order_payment`; grants EXECUTE to `store_mamator` |
| `008_payment_callback_events.sql` | Idempotent callback/verify event log with partial unique indexes |
| `009_integrity_constraints_indexes.sql` | GHS default on `orders.currency`; non-negative CHECK constraints; hot-path indexes |

### Tooling

| Script | Purpose |
|--------|---------|
| `scripts/migrate-db.mjs` | Apply pending migrations with transaction + ledger insert |
| `scripts/test-db-schema.mjs` | Smoke test critical tables/functions; exit non-zero on failure |

Run after deploy:

```bash
node scripts/migrate-db.mjs
node scripts/test-db-schema.mjs
```

---

## 5. Remaining issues and recommendations

| Priority | Item | Notes |
|----------|------|-------|
| **High** | Apply migrations 007–009 on live if not yet run | Verify via `SELECT id FROM schema_migrations ORDER BY id` |
| **High** | Run `node scripts/test-db-schema.mjs` in CI or post-deploy | Fails if `payment_callback_events` or RPCs missing |
| **Medium** | Existing USD currency rows | Historical orders keep `USD`; consider one-off UPDATE if business requires |
| **Medium** | `orders_paid_no_paid_at` | Pre-007 paid orders may lack `metadata.paid_at`; informational only |
| **Medium** | No automated payment integration tests | Callback idempotency and half-pay flows should be scripted |
| **Low** | `is_admin_or_staff()` stub | Harmless; could be removed or wired to session context |
| **Low** | Admin list N+1 / unpaginated fetches | See `DATABASE_PERFORMANCE_REPORT.md` |
| **Future** | Hubtel / Paystack | Not in scope; would need new tables/RPCs and routes |

---

## 6. Verification checklist

- [ ] `GET /api/health/db` returns `status: "healthy"` on mamator.com
- [ ] `node scripts/test-db-schema.mjs` passes against production `DATABASE_URL`
- [ ] `schema_migrations` contains `001`–`009` filenames
- [ ] Sandbox Moolre payment: full pay → `payment_status = paid`, stock reduced once
- [ ] Half pay → `partially_paid`, reminder SMS shows balance not full total
- [ ] Duplicate callback with same gateway reference → idempotent 200, no double charge metadata
- [ ] Admin PATCH with `payment_status` → 400 rejection
- [ ] Public `/api/orders/summary?order_number=…` → no email/phone without email match

---

## 7. Related documents

| Document | Scope |
|----------|-------|
| `DATABASE_SCHEMA_REFERENCE.md` | Table-by-table reference |
| `MIGRATION_STATUS_REPORT.md` | Migrations 001–009 ledger and rollback |
| `SUPABASE_TO_POSTGRES_DATABASE_REPORT.md` | Feature parity matrix |
| `PAYMENT_DATABASE_AUDIT.md` | Moolre payment schema and flows |
| `DATABASE_PERFORMANCE_REPORT.md` | Pool, indexes, query patterns |
| `DATABASE_RECOVERY_GUIDE.md` | Backup/restore and rollback procedures |
