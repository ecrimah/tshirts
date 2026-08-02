# Database Performance Report — Mamator

**Database:** `store_mamator` @ fleet-postgres (PostgreSQL 16.14)  
**Runtime:** `lib/db.ts` — single `pg.Pool`, `max: 20`  
**ORM:** None  
**Site:** mamator.com (single Coolify container)

---

## Connection pool

| Setting | Value | Location |
|---------|-------|----------|
| `max` | 20 | `lib/db.ts` |
| `idleTimeoutMillis` | 30_000 | `lib/db.ts` |
| `connectionTimeoutMillis` | 10_000 | `lib/db.ts` |
| Singleton | `global.__mamatorPgPool` | Survives Next.js hot reload in dev |

**Assessment:** Appropriate for current scale (6 users, 13 products, 3 orders). One app instance × max 20 connections is well within fleet-postgres capacity. Monitor if horizontal scaling adds more containers (consider PgBouncer or lower per-instance `max`).

**Anti-pattern avoided:** No per-request Pool creation; all routes share `getPool()`.

---

## Indexes — baseline (001)

Already present from plain Postgres migration:

| Table | Index | Use case |
|-------|-------|----------|
| `orders` | `idx_orders_order_number`, unique on `order_number` | Payment callback, tracking |
| `orders` | `idx_orders_status` | Admin filters |
| `orders` | `idx_orders_user` | Account order history |
| `orders` | `idx_orders_pending_reminders` | Partial: unpaid + reminder not sent |
| `order_items` | `idx_order_items_order` | Order detail aggregation |
| `products` | `idx_products_slug`, `idx_products_category`, `idx_products_status` | Catalog, SSR |
| `products` | `idx_products_tags` (GIN) | Tag search |
| `profiles` | `idx_profiles_email`, `idx_profiles_role` | Login, admin |
| `customers` | `idx_customers_email`, `idx_customers_user_id` | CRM |
| `payment_reconciliation_log` | `idx_payment_reconciliation_log_order`, `_created` | Admin audit |
| `reviews` | `idx_reviews_product`, `idx_reviews_status` | Product pages |
| `notifications` | `idx_notifications_unread` (partial) | Unread badge |

---

## Indexes — added in 009

Migration `009_integrity_constraints_indexes.sql`:

```sql
idx_orders_payment_status_created   ON orders (payment_status, created_at DESC)
idx_orders_email_lower              ON orders (lower(email))
idx_order_items_product             ON order_items (product_id)
idx_product_images_product_pos      ON product_images (product_id, position)
idx_users_email_lower               ON users (lower(email))
```

| Index | Rationale |
|-------|-----------|
| `idx_orders_payment_status_created` | Admin payment queues, cron reminder candidate scan |
| `idx_orders_email_lower` | Order tracking by email (case-insensitive) |
| `idx_order_items_product` | Product sales / inventory reports |
| `idx_product_images_product_pos` | Product detail image ordering |
| `idx_users_email_lower` | Login lookup (`lower(email) = lower($1)`) |

**Apply status:** Present after migration 009 runs; verify with `\di idx_orders_payment_status_created` on VPS.

---

## Indexes — added in 008

```sql
idx_payment_callback_events_gateway_ref   (partial unique, processed)
idx_payment_callback_events_external_ref  (partial unique, processed)
idx_payment_callback_events_order
idx_payment_callback_events_status
```

Support callback idempotency checks without full table scan.

---

## CHECK constraints (009)

Additive integrity (minimal write overhead):

- `orders.total >= 0`, `orders.subtotal >= 0`
- `order_items.quantity > 0`, `order_items.unit_price >= 0`
- `products.quantity >= 0`

Existing: `products.moq >= 1`, `reviews.rating BETWEEN 1 AND 5`.

---

## Query patterns and N+1 analysis

### Well-batched (no N+1 concern)

| Flow | Pattern |
|------|---------|
| **Checkout pricing** | Single query with `WHERE id = ANY($1::uuid[])` for products/variants |
| **Order detail (API)** | Order + `jsonb_agg(order_items)` subquery in one round-trip |
| **Order summary** | Same aggregated subquery |
| **Catalog list** | Variant JSON aggregated in product list query (`lib/data/products.ts`) |
| **Payment callback** | Single order SELECT + one RPC + optional INSERT event |

### Potential N+1 / heavy patterns

| Location | Issue | Severity | Mitigation |
|----------|-------|----------|------------|
| Admin orders list (client) | May fetch full order list then expand client-side | Medium | Server pagination + limit columns |
| Admin dashboard stats | Multiple aggregate queries | Low | Admin-only; acceptable at current volume |
| Storefront search | `ILIKE` on name/description | Medium | Consider `pg_trgm` index if search slows |
| CMS / settings | Client fetch on mount (`CMSContext`) | Low | Cache settings; RSC preload |
| Product detail | Separate fetches for related data in some views | Low | Already consolidated in API for variants |
| Payment verify | External Moolre HTTP (up to ~15s) | N/A | Async; does not hold DB connection during full HTTP wait if implemented correctly |

### RPC vs round-trips

Payment settlement uses **one** `record_order_payment()` call inside the callback — stock updates happen inside the function. This avoids multi-round-trip N+1 updates to `products` / `product_variants` from application code.

---

## Enum and JSONB performance

- `payment_status` and `order_status` enums are compact; index on `payment_status` is efficient.
- `orders.metadata` JSONB: frequent keys (`amount_paid`, `moolre_externalref`) accessed in SQL via `->>`; no GIN index on metadata — acceptable at 3 orders; consider expression index if reporting on metadata keys at scale.

---

## Transaction usage

| Path | Transactions |
|------|--------------|
| `withTransaction()` in `lib/db.ts` | Available for multi-statement app logic |
| `record_order_payment()` | Single function transaction (implicit) |
| `migrate-db.mjs` | Explicit BEGIN/COMMIT per file |
| Most API routes | Single-statement or function-scoped — OK |

---

## External latency (not DB)

| Call | Impact |
|------|--------|
| Moolre link / verify API | Dominates payment path latency |
| Resend email | Async after DB commit |
| Moolre SMS | Async after DB commit |

DB pool wait time should remain negligible unless connection leak — monitor `pg_stat_activity` if timeouts appear.

---

## Monitoring recommendations

```sql
-- Active connections for app role
SELECT count(*) FROM pg_stat_activity WHERE usename = 'store_mamator';

-- Sequential scans on hot tables (after traffic)
SELECT relname, seq_scan, idx_scan FROM pg_stat_user_tables
WHERE relname IN ('orders', 'products', 'order_items')
ORDER BY seq_scan DESC;

-- Unused indexes (periodic review)
SELECT indexrelname, idx_scan FROM pg_stat_user_indexes
WHERE schemaname = 'public' AND idx_scan = 0;
```

---

## Suggested future optimizations (not yet applied)

| Item | When |
|------|------|
| `CREATE INDEX CONCURRENTLY` on `products` using gin (`to_tsvector(name \|\| description)`) | Search latency > 200ms |
| Paginate admin order/product APIs | > 500 orders |
| PgBouncer | Multiple app replicas |
| Materialized view for admin dashboard | Heavy reporting load |
| Archive old `payment_callback_events` | > 1M rows |

---

## Health check

`GET /api/health/db` — lightweight existence checks; use for uptime monitors.

Schema smoke test:

```bash
node scripts/test-db-schema.mjs
```

---

## Related documents

- `DATABASE_AUDIT_AND_REPAIR_REPORT.md`
- `MIGRATION_STATUS_REPORT.md` (009 indexes)
- `PERFORMANCE_REPORT.md` (app/frontend performance — prior audit)
