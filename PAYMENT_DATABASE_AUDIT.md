# Payment Database Audit — Mamator

**Gateway implemented:** Moolre only  
**Hubtel:** Not implemented (no code, env, or schema)  
**Paystack:** Not implemented (no code, env, or schema)  
**Database:** `store_mamator` @ fleet-postgres  
**Currency:** GHS (default corrected in migration 009; legacy USD rows may remain)

---

## Overview

Mamator payment state lives primarily in the `orders` table (`payment_status`, `payment_method`, `payment_provider`, `payment_transaction_id`, `metadata` JSONB). Settlement is performed by PostgreSQL functions called from Next.js API routes — not by ORM models or external payment SDKs writing directly to the DB.

Half-payment (50% deposit) and full payment are both supported via `orders.metadata.payment_option` (`'full'` | `'half'`) and tracked amounts in metadata.

---

## Payment-related tables

### `orders`

| Column | Purpose |
|--------|---------|
| `payment_status` | Enum: `pending`, `paid`, `failed`, `refunded`, `partially_refunded`, **`partially_paid`** |
| `payment_method` | Display string (e.g. mobile money) |
| `payment_provider` | Typically `moolre` |
| `payment_transaction_id` | External reference when set |
| `currency` | Default **`GHS`** after 009 |
| `total`, `subtotal`, etc. | Server-calculated amounts |
| `metadata` | Payment plan, Moolre refs, amounts paid, dedupe flags |
| `payment_reminder_sent` | Cron dedupe for reminder SMS/email |
| `payment_reminder_sent_at` | Timestamp of reminder |

**Key metadata fields:**

| Key | Purpose |
|-----|---------|
| `payment_option` | `'full'` or `'half'` |
| `pending_charge_amount` | Amount next Moolre link should charge |
| `amount_paid` | Running total paid (half-pay) |
| `balance_due` | Remaining balance |
| `moolre_externalref` | Moolre external reference for verify API |
| `moolre_reference` | Gateway transaction reference |
| `payment_verified_at` / `deposit_verified_at` | ISO timestamps |
| `paid_at` | Full settlement timestamp (007+) |
| `stock_reduced` | `"true"` after inventory decrement |
| `confirmation_sent_at` | Prevents duplicate SMS/email on callback retry |

### `payment_reconciliation_log` (migration 005)

Admin audit trail for manual reconcile actions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `order_number` | text | |
| `action` | text | e.g. verify, force-mark |
| `result` | text | success / failure |
| `admin_user_id`, `admin_email` | uuid, text | Who performed action |
| `details` | jsonb | Provider response snippets |
| `created_at` | timestamptz | |

**API:** `POST /api/admin/payments/reconcile` (staff only)

### `payment_callback_events` (migration 008)

Idempotent log of Moolre callbacks and verifications.

| Column | Type | Notes |
|--------|------|-------|
| `gateway` | text | Default `'moolre'` |
| `order_number` | text | Merchant order ref |
| `external_ref` | text | Moolre externalref |
| `gateway_reference` | text | Moolre transaction ref |
| `event_type` | text | Default `'callback'` |
| `processing_status` | text | `received`, `processed`, `ignored`, `failed` |
| `amount` | numeric | Verified charge |
| `currency` | text | Default `GHS` |
| `details` | jsonb | Post-payment status snapshot |

**Unique indexes (partial):** prevent double-processing same gateway reference when status is `processed`.

---

## PostgreSQL functions

### `mark_order_paid(order_ref text, moolre_ref text)`

- **Migration:** 001, replaced by 002 (idempotent)
- **Behavior:** Sets `payment_status = paid`, advances order status from pending/awaiting_payment → processing, stores Moolre ref in metadata, reduces stock once.
- **Still callable** but superseded by `record_order_payment` for amount-aware flows.

### `record_order_payment(order_ref, moolre_ref, charged_amount)`

- **Migration:** 004, hardened in 007 (`FOR UPDATE` lock)
- **Behavior:**
  - If `charged_amount` + prior `amount_paid` ≥ order total → **paid**, balance 0
  - Else → **partially_paid**, updates `amount_paid`, `balance_due`
  - Reduces stock once per order (same guard as mark_order_paid)
  - Idempotent when already paid
- **Called from:** callback, verify, reconcile routes via `SELECT record_order_payment($1,$2,$3)`

### Supporting functions (non-gateway)

| Function | Role |
|----------|------|
| `update_customer_stats(email, total)` | Increment customer totals after paid order |
| `reduce_stock_on_order(uuid)` | Legacy/alternate stock path |
| `upsert_customer_from_order(...)` | Customer dedupe on checkout |

---

## Application payment flow (Moolre)

```
Checkout POST /api/orders
  → INSERT orders + order_items (server-priced)
  → metadata.payment_option, pending_charge_amount set

POST /api/payment/moolre { orderId }
  → getChargeAmountForOrder(order)  ← server-trusted amount
  → Moolre link API (externalref = ORD-*-R*)
  → metadata.moolre_externalref persisted

Customer pays at Moolre

POST /api/payment/moolre/callback
  → validateCallbackSecret()
  → verifyMoolrePayment(externalRef, expectedCharge)  ← required
  → record_order_payment(orderRef, moolreRef, chargedAmount)
  → INSERT payment_callback_events
  → sendOrderConfirmation if not metadata.confirmation_sent_at

Fallback: POST /api/payment/moolre/verify
Admin:    POST /api/admin/payments/reconcile
Cron:     GET /api/cron/payment-reminders (getChargeAmountForOrder for SMS amount)
```

---

## API routes (payment)

| Route | Auth | DB touchpoints |
|-------|------|----------------|
| `POST /api/payment/moolre` | Rate limit | `orders` metadata update |
| `POST /api/payment/moolre/callback` | Callback secret | `record_order_payment`, `payment_callback_events`, `orders`, `customers` |
| `POST /api/payment/moolre/verify` | Rate limit | Same as callback |
| `POST /api/admin/payments/reconcile` | Admin JWT | `record_order_payment`, `payment_reconciliation_log` |
| `GET /api/cron/payment-reminders` | `CRON_SECRET` | `orders` reminder flags |
| `GET /api/orders/summary` | Public (PII redacted) | Read orders + items |
| `PATCH /api/orders/[id]` | Admin | **Cannot** set `payment_status` |

---

## SMS and notifications (no SMS table)

SMS is sent through Moolre VAS API (`lib/notifications.ts` → `sendSMS()`). There is **no** `sms_messages` or equivalent table.

| Concern | Mechanism |
|---------|-----------|
| Order confirmation SMS | `sendOrderConfirmation()` after successful payment |
| Payment reminder SMS | `sendPaymentLink()` from cron; amount from `getChargeAmountForOrder()` |
| Duplicate prevention | `orders.metadata.confirmation_sent_at` set after first successful notify |
| Reminder dedupe | `orders.payment_reminder_sent` + `payment_reminder_sent_at` |

Env vars: `MOOLRE_SMS_API_KEY` or fallback `MOOLRE_API_KEY`, `MOOLRE_SMS_SENDER_ID`.

---

## Security controls (post-repair)

| Control | Implementation |
|---------|----------------|
| Provider verify before DB update | `verifyMoolrePayment()` in callback/verify |
| Amount integrity | `getChargeAmountForOrder()` — not client-supplied |
| Callback authentication | `MOOLRE_CALLBACK_SECRET` in body |
| Idempotency | `payment_callback_events` unique indexes + paid-status short-circuit |
| Concurrency | `FOR UPDATE` in `record_order_payment` (007) |
| Admin payment bypass blocked | PATCH rejects `payment_status` |
| PII on summary endpoint | Redacted unless staff or email match |

---

## Hubtel / Paystack

| Gateway | Routes | DB tables | Env vars | Status |
|---------|--------|-----------|----------|--------|
| Hubtel | — | — | — | **Not implemented** |
| Paystack | — | — | — | **Not implemented** |

Adding a second gateway would require new API routes, callback tables or generalized `payment_callback_events.gateway`, and a new settlement function or generalized `record_order_payment` signature.

---

## Live data snapshot (2026-08-02)

| Metric | Value |
|--------|------:|
| Total orders | 3 |
| Paid | 1 |
| Pending payment | 2 |
| Integrity anomalies | 0 |

---

## Verification SQL

```sql
-- Payment functions exist
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname IN ('record_order_payment', 'mark_order_paid');

-- Half-pay orders
SELECT order_number, payment_status, metadata->>'amount_paid', metadata->>'balance_due'
FROM orders WHERE payment_status = 'partially_paid';

-- Callback audit
SELECT order_number, gateway_reference, processing_status, amount, received_at
FROM payment_callback_events ORDER BY received_at DESC LIMIT 20;
```

---

## Related documents

- `PAYMENT_AND_CALLBACK_AUDIT.md` — endpoint-level audit (prior doc)
- `DATABASE_AUDIT_AND_REPAIR_REPORT.md` — repair summary
- `MIGRATION_STATUS_REPORT.md` — migrations 004–008
