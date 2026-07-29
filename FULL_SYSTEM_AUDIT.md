# Mamator — Full System Audit

**Date:** 2026-07-29  
**Environment:** Staging / production at https://mamator.com  
**Stack:** Next.js 15.5 (App Router), React 19, TypeScript, `pg` pool, custom JWT auth (jose + bcryptjs), Resend email, Moolre payments + SMS

---

## Baseline (before repairs)

| Check | Result |
|-------|--------|
| ESLint (`npm run lint`) | Pass — no warnings or errors |
| TypeScript (`npx tsc --noEmit`) | Pass |
| Local production build | Fails prerender on `/categories` without VPS DB (`ENOTFOUND fleet-pgbouncer`) — expected locally |
| Live homepage | HTTP 200 |
| Live Moolre callback GET | HTTP 200 — endpoint reachable |
| Supabase runtime imports | None in `app/`, `lib/`, `components/` |
| Hubtel / Paystack | Not implemented in codebase |
| Payment callback secret | Required in production after hardening |
| `CRON_SECRET` | Empty in container — cron reminders disabled until set |
| DB migration `002` | Applied on VPS `store_mamator` (2026-07-29) |

---

## Architecture summary

```
Browser
  └── Next.js App Router (port 3005, Coolify mamator-app)
        ├── middleware.ts — admin auth, security headers
        ├── app/** — pages + route handlers
        ├── lib/db.ts — singleton pg Pool (max 20)
        ├── lib/data/* — repository-style queries
        ├── lib/auth/* — JWT session cookies
        ├── lib/payment/moolre.ts — verify + callback helpers
        └── lib/notifications.ts — Resend + Moolre SMS

PostgreSQL: store_mamator @ fleet-postgres (VPS)
Uploads: UPLOAD_DIR → /uploads/*
Payments: Moolre embed/link + callback + server verify
```

**No ORM** — parameterized SQL via `lib/db.ts` and `lib/data/*`.

---

## Route inventory

### Public pages (59 total)

| Area | Routes | Auth |
|------|--------|------|
| Storefront | `/`, `/shop`, `/product/[slug]`, `/categories`, `/cart`, `/checkout`, `/wishlist` | None |
| Order flow | `/order-success`, `/order-tracking`, `/pay/[orderId]` | None (order ref) |
| Auth | `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password` | Guest |
| Account | `/account`, `/account/verify-*`, `/account/invoice/[id]`, `/account/privacy` | Customer session |
| Content | `/about`, `/blog`, `/blog/[id]`, `/contact`, `/faqs`, `/help`, `/help/article/[id]`, `/terms`, `/privacy`, `/shipping`, `/returns`, `/returns/confirmation` | None |
| Support | `/support/tickets`, `/support/ticket` | Optional |
| Utility | `/offline`, `/maintenance`, `/pwa-settings` | None |

### Admin pages (22)

All under `/admin/*` except `/admin/login` — require staff role (`admin`, `manager`, etc.) via middleware + API `verifyAuth`.

Key: dashboard, products, orders, POS, inventory, customers, reviews, coupons, analytics, blog, notifications, test-sms.

### API routes (47)

| Category | Paths |
|----------|-------|
| Auth | `/api/auth/login`, `logout`, `signup`, `me`, `profile`, `forgot-password`, `reset-password` |
| Catalog (admin) | `/api/catalog/products`, `/api/catalog/categories` (+ `[id]`) |
| Storefront | `/api/storefront/products`, `categories`, `search`, `blog` (+ slug) |
| Orders | `/api/orders`, `/api/orders/[id]`, `/api/orders/summary`, `/api/orders/track` |
| Payments | `/api/payment/moolre`, `callback`, `verify` |
| Notifications | `/api/notifications` |
| Uploads | `/api/uploads`, `/api/uploads/[...path]` |
| Admin | `/api/admin/stats`, `customers`, `coupons`, `reviews`, `blog`, `pos/checkout` |
| Misc | `/api/settings`, `/api/addresses`, `/api/reviews`, `/api/newsletter/subscribe`, `/api/recaptcha/verify`, `/api/cron/payment-reminders` |

---

## Supabase migration findings

| Feature | Replacement | Status |
|---------|-------------|--------|
| Supabase Auth | Custom JWT + `users`/`profiles` | Complete |
| PostgREST client | `pg` + SQL | Complete |
| RLS | App-layer auth in API routes | Partial — see security section |
| Storage | Local disk + `/uploads` | Complete; legacy URL rewrite in `lib/site-brand.ts` |
| Realtime | Not used | N/A |
| Edge functions | Next.js route handlers | Complete |
| RPC | Postgres functions (`mark_order_paid`, etc.) | Complete |

**Remaining references:** comment/URL guard only (`lib/site-brand.ts` supabase.co storage check). Legacy `sb-access-token` cookie fallback **removed** from middleware.

---

## Broken features discovered & root causes

| Issue | Root cause | Fix |
|-------|------------|-----|
| Variant selection broken | API omitted `option1`/`option2`/`metadata` on variants | `lib/product-variants.ts` + catalog routes |
| Order success missing delivery details | `/api/orders/summary` omitted `email`, `phone`, `shipping_address` | Summary route expanded |
| Payment verify used wrong externalref | Moolre link uses `{orderRef}-R{timestamp}` | Store `moolre_externalref` in order metadata |
| Callback could mark paid without API verify | Trusted callback body alone | Server-side Moolre status API + amount check |
| Duplicate SMS/email on pay | Callback + verify both sent confirmation | `confirmation_sent_at` in metadata |
| Paid order overwritten to failed | Failed callback after success | Skip update when `payment_status = paid` |
| Public order_created notifications | Unauthenticated POST | Admin-only + load order from DB |
| Cron endpoint open | Optional secret | Require `CRON_SECRET` in production |
| Client shipping/tax manipulation | Accepted negative/zero from client | Server clamps ≥ 0; subtotal from DB prices |
| Admin session after migration | Old Supabase cookie name | Removed `sb-access-token` fallback |

---

## Authentication & authorization

- **Sessions:** HTTP-only cookie signed with `AUTH_SECRET` (jose).
- **Admin:** Middleware checks staff role; each admin API re-validates via `verifyAuth`.
- **Customer APIs:** `/api/orders/[id]` and account routes check session ownership.
- **Gap (documented):** `/api/orders/summary` is public by order number (hard-to-guess `ORD-*` format). Optional `email` query param adds verification when provided.

---

## Payment architecture (Moolre only)

1. Checkout creates order with server-computed totals.
2. `POST /api/payment/moolre` generates link with unique `externalref`.
3. Customer pays on Moolre.
4. Moolre POSTs to `/api/payment/moolre/callback` (secret required in prod).
5. Server verifies via Moolre status API; calls idempotent `mark_order_paid()`.
6. Fallback: `/api/payment/moolre/verify` from order-success page (does not trust redirect alone).

Hubtel and Paystack: **not present** — documented as future work only.

---

## Performance findings

| Area | Finding | Severity |
|------|---------|----------|
| CMSContext | Client provider fetches settings + CMS on every page | Medium — causes client waterfall |
| Admin pages | Large client components with full-table fetches | Medium |
| `/categories` | SSR requires live DB at build time | Low — VPS build only |
| pg pool | Singleton with max 20 — appropriate for single container | OK |
| Images | sharp available; placeholder URLs on some legacy products | Low |

See `PERFORMANCE_REPORT.md` for details and recommendations.

---

## Security findings

| Finding | Severity | Status |
|---------|----------|--------|
| Optional callback secret (pre-fix) | Critical | Fixed — required in production |
| Public notification triggers | High | Fixed — admin-only types |
| Open cron in production | High | Fixed — requires CRON_SECRET |
| Order summary enumeration | Medium | Mitigated — opaque order numbers; optional email check |
| No Hubtel/Paystack | N/A | — |

---

## Fixes applied (this audit cycle)

- New `lib/payment/moolre.ts` — centralized verify, callback parsing, secret validation
- New `db/migrations/002_mark_order_paid_idempotent.sql` — applied on VPS
- Hardened Moolre callback, verify, and link routes
- Hardened notifications and cron routes
- Server-side price validation in `lib/data/orders.ts`
- Expanded orders summary API for order-success page
- Removed Supabase cookie fallback in middleware

---

## Remaining risks / manual actions

1. **Deploy** local payment-hardening commits to production (not yet pushed).
2. Set **`CRON_SECRET`** in Coolify and re-sync env.
3. Confirm **`MOOLRE_CALLBACK_SECRET`** registered with Moolre dashboard.
4. Re-login admin users still using old Supabase cookies (one-time).
5. Hubtel/Paystack — implement if business requires multi-gateway.
6. Add automated callback/payment tests (recommended).
7. Coolify deploy queue — env changes may need manual container recreate (see `docs/COOLIFY_SETUP.md`).

---

## Final verification checklist

- [x] No Supabase SDK in runtime app code
- [x] Lint + TypeScript pass
- [x] Live site responds
- [x] Callback endpoint reachable
- [x] Idempotent `mark_order_paid` on production DB
- [ ] Payment hardening deployed to live container
- [ ] CRON_SECRET configured
- [ ] Full E2E payment test in staging sandbox

**Production readiness:** Ready after listed manual actions (deploy + CRON_SECRET + payment smoke test).
