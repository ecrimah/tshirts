# Migration Status Report — Mamator

**Database:** `store_mamator` @ `fleet-postgres` (PostgreSQL 16.14)  
**Runner:** `node scripts/migrate-db.mjs`  
**Ledger table:** `public.schema_migrations` (`id text PRIMARY KEY`, `applied_at timestamptz`)

> **Environment:** Production store database for mamator.com. The audit prompt said “staging”; the connected target is the live `store_mamator` DB.

---

## How migrations work

1. Files in `db/migrations/*.sql` are sorted lexicographically by filename.
2. Each file’s **full filename** (e.g. `006_schema_migrations_bootstrap.sql`) is the migration `id`.
3. On apply: `BEGIN` → run SQL → `INSERT INTO schema_migrations (id)` → `COMMIT`.
4. Already-applied ids are skipped.
5. `migrate-db.mjs` also ensures `schema_migrations` exists before iterating (CREATE IF NOT EXISTS).

**Legacy path:** `supabase/migrations/` is **not** read by migrate-db. Those files document the original Supabase schema evolution only.

---

## Migration catalog (001–009)

| ID | File | Purpose | Bootstrap / live state |
|----|------|---------|------------------------|
| **001** | `001_plain_postgres.sql` | Full plain-Postgres schema: enums, tables, indexes, triggers, `mark_order_paid`, helper RPCs | Applied at Supabase→Postgres cutover; **backfilled** by 006 |
| **002a** | `002_mark_order_paid_idempotent.sql` | Idempotent `mark_order_paid` + stock reduction guard | Applied manually pre-ledger; **backfilled** by 006 |
| **002b** | `002_post_supabase_import.sql` | Post-dump fixes: `public.users` from `auth.users`, disable RLS, grant to app role | Applied at import; **backfilled** by 006 |
| **003** | `003_add_partially_paid_enum.sql` | Adds `partially_paid` to `payment_status` enum | Applied pre-ledger; **backfilled** by 006 |
| **004** | `004_record_order_payment.sql` | `record_order_payment()` for full + half (deposit) payments | Applied pre-ledger; **backfilled** by 006 |
| **005** | `005_payment_reconciliation_log.sql` | `payment_reconciliation_log` table + indexes + grants | Applied pre-ledger; **backfilled** by 006 |
| **006** | `006_schema_migrations_bootstrap.sql` | Creates `schema_migrations`; inserts 001–005 as already applied | **Required first** on live DB that lacked ledger |
| **007** | `007_record_order_payment_lock.sql` | Replaces `record_order_payment` with `FOR UPDATE` row lock; EXECUTE grant | Pending until migrate-db run after 006 |
| **008** | `008_payment_callback_events.sql` | `payment_callback_events` table + idempotency indexes | Pending until migrate-db run after 006 |
| **009** | `009_integrity_constraints_indexes.sql` | GHS currency default, CHECK constraints, performance indexes | Pending until migrate-db run after 006 |

### Filename ordering note

Two files share prefix `002_`. Lexicographic sort applies `002_mark_order_paid_idempotent.sql` before `002_post_supabase_import.sql`. On a **fresh** database both would run in that order; on live Mamator, 002b was applied at import time and 006 prevents re-execution.

---

## Expected ledger after full apply

```sql
SELECT id, applied_at FROM schema_migrations ORDER BY id;
```

Expected rows (9 files):

```
001_plain_postgres.sql
002_mark_order_paid_idempotent.sql
002_post_supabase_import.sql
003_add_partially_paid_enum.sql
004_record_order_payment.sql
005_payment_reconciliation_log.sql
006_schema_migrations_bootstrap.sql
007_record_order_payment_lock.sql
008_payment_callback_events.sql
009_integrity_constraints_indexes.sql
```

Verify:

```bash
node scripts/migrate-db.mjs
node scripts/test-db-schema.mjs
```

---

## Per-migration detail

### 001 — `001_plain_postgres.sql`

- Creates 14 enum types, ~30 tables, FK graph, indexes, triggers (`update_updated_at_column`, `handle_new_user`, review stats).
- Defines initial `mark_order_paid(order_ref, moolre_ref)`.
- **Rollback:** Destructive — drop schema only on empty/dev DB. Never run DROP on production.

### 002a — `002_mark_order_paid_idempotent.sql`

- Replaces `mark_order_paid` to no-op when already paid; reduces stock once via `metadata.stock_reduced`.
- **Rollback:** `CREATE OR REPLACE` with prior function body from 001 (loses idempotency).

### 002b — `002_post_supabase_import.sql`

- Idempotent import helper: copies `auth.users` → `public.users`, disables RLS on all public tables, renames policies away.
- Safe to re-run (`IF NOT EXISTS`, `ON CONFLICT`).
- **Rollback:** Not needed on plain Postgres (RLS stays off).

### 003 — `003_add_partially_paid_enum.sql`

- `ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partially_paid'`.
- **Rollback:** PostgreSQL cannot remove enum values easily; leave in place.

### 004 — `004_record_order_payment.sql`

- Adds `record_order_payment(order_ref, moolre_ref, charged_amount)` — handles deposit and full settlement, updates `metadata.amount_paid`, `balance_due`.
- **Rollback:** `DROP FUNCTION` + revert app to `mark_order_paid` only (loses half-pay).

### 005 — `005_payment_reconciliation_log.sql`

- Audit table for admin reconcile actions.
- **Rollback:** `DROP TABLE payment_reconciliation_log CASCADE` (loses audit history).

### 006 — `006_schema_migrations_bootstrap.sql`

- Creates ledger; backfills 001–005 so migrate-db skips them.
- **Rollback:** Do not drop `schema_migrations` on production.

### 007 — `007_record_order_payment_lock.sql`

- Adds `FOR UPDATE` on order row; handles concurrent update return path; UTC timestamps in metadata.
- **Rollback:** Replace function with 004 body (removes locking — not recommended).

### 008 — `008_payment_callback_events.sql`

- New table for callback/verify events; unique partial indexes on `(gateway, gateway_reference)` and `(gateway, external_ref, event_type)` when `processing_status = 'processed'`.
- **Rollback:** `DROP TABLE payment_callback_events CASCADE` (loses event audit).

### 009 — `009_integrity_constraints_indexes.sql`

- `ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'GHS'`.
- CHECK: `orders.total >= 0`, `orders.subtotal >= 0`, `order_items.quantity > 0`, `order_items.unit_price >= 0`, `products.quantity >= 0`.
- Indexes: `idx_orders_payment_status_created`, `idx_orders_email_lower`, `idx_order_items_product`, `idx_product_images_product_pos`, `idx_users_email_lower`.
- **Rollback:** Drop constraints/indexes individually; revert default to `'USD'` only if business requires.

---

## Rollback strategy (production-safe)

| Scenario | Action |
|----------|--------|
| **Failed mid-migration** | migrate-db rolls back transaction for that file; fix SQL and re-run |
| **Bad 007–009 deploy** | Restore from fleet backup (see `DATABASE_RECOVERY_GUIDE.md`); do not hand-edit paid orders |
| **Revert app without reverting DB** | Newer columns/tables ignored by old app if additive only; 008/009 are additive |
| **Full schema reset (dev only)** | Drop database `store_mamator`, recreate, restore backup, re-run migrate-db |

**Never** delete rows from `schema_migrations` on production unless you intend to re-apply that file and understand side effects.

---

## Commands

```bash
# Apply pending migrations
node scripts/migrate-db.mjs

# Smoke test schema
node scripts/test-db-schema.mjs

# Inspect ledger (on VPS)
sudo docker exec fleet-postgres psql -U postgres -d store_mamator \
  -c "SELECT id, applied_at FROM schema_migrations ORDER BY applied_at;"
```

---

## npm script (if configured)

Check `package.json` for `"db:migrate"` alias; canonical command is `node scripts/migrate-db.mjs`.
