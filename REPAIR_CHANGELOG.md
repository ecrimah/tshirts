# Repair Changelog — Mamator System Audit

**Date:** 2026-07-29  
**Scope:** Supabase→Postgres migration hardening, payments, security, documentation

---

## Files changed

### New files

| File | Purpose |
|------|---------|
| `lib/payment/moolre.ts` | Centralized Moolre verify, callback secret, ref resolution |
| `db/migrations/002_mark_order_paid_idempotent.sql` | Idempotent paid marking + stock guard |
| `FULL_SYSTEM_AUDIT.md` | Master audit document |
| `SUPABASE_TO_POSTGRES_MIGRATION_REPORT.md` | Migration status |
| `PAYMENT_AND_CALLBACK_AUDIT.md` | Payment flow documentation |
| `PERFORMANCE_REPORT.md` | Performance findings |
| `REPAIR_CHANGELOG.md` | This file |

### Modified files

| File | Change |
|------|--------|
| `app/api/payment/moolre/callback/route.ts` | Secret required, API verify, amount check, dedupe |
| `app/api/payment/moolre/verify/route.ts` | Uses stored externalref, idempotent confirm |
| `app/api/payment/moolre/route.ts` | Persists `moolre_externalref` in metadata |
| `app/api/notifications/route.ts` | Admin-only sensitive types; order_created from DB |
| `app/api/cron/payment-reminders/route.ts` | CRON_SECRET required in production |
| `lib/data/orders.ts` | Server-side price validation; clamp shipping/tax |
| `app/api/orders/summary/route.ts` | Returns email, phone, shipping_address; optional email verify |
| `middleware.ts` | Removed legacy `sb-access-token` cookie fallback |

### Prior session (already deployed)

| File | Change |
|------|--------|
| `lib/product-variants.ts` | Variant JSON SQL helper |
| `lib/data/products.ts` | Include variant options |
| `app/api/catalog/products/route.ts` | Full variant payload |
| `app/product/[slug]/ProductDetailClient.tsx` | Variant selection fix |
| Admin pages | POS, inventory, customers, reviews fixes |
| Brand/theme files | Gold/black/white rebrand |

---

## Bugs fixed

- Variant color/size selection not working on product pages
- Payment verification using wrong Moolre external reference
- Callback could confirm payment without provider verification
- Duplicate order confirmation SMS/email
- Paid orders potentially overwritten by late failure callbacks
- Public `order_created` notification abuse
- Unauthenticated cron endpoint in production
- Negative shipping/tax from client checkout payload
- Order success page missing delivery fields from summary API
- Admin auth fallback to obsolete Supabase cookie

---

## Database migrations

| Migration | Applied staging/VPS | Production safe |
|-----------|---------------------|-----------------|
| `002_mark_order_paid_idempotent.sql` | Yes (2026-07-29) | Yes — replaces function in place |

---

## Packages

No packages added or removed in this audit cycle.

---

## Tests added

None automated in this cycle. Recommended:

- Payment callback idempotency tests
- Auth authorization tests
- Order summary access tests

---

## Manual actions required

1. **Commit and deploy** payment hardening changes to mamator-app
2. Set **`CRON_SECRET`** in `.env.local` → sync to Coolify
3. Verify **`MOOLRE_CALLBACK_SECRET`** in Moolre dashboard
4. Admin users: **re-login** after Supabase cookie removal
5. Run **one sandbox payment** end-to-end after deploy
6. Optional: apply suggested DB indexes from `PERFORMANCE_REPORT.md`

---

## Deployment status

| Item | Status |
|------|--------|
| Migration 002 on VPS DB | Deployed |
| Payment hardening code | Local — pending git push + fleet deploy |
| Live site health | OK (HTTP 200) |
| Callback endpoint | Reachable |
