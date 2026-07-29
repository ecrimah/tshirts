# Performance Report — Mamator

**Date:** 2026-07-29  
**Site:** https://mamator.com

---

## Baseline measurements

| Metric | Value | Notes |
|--------|-------|-------|
| Homepage TTFB (curl) | ~200ms class | Live site responsive |
| ESLint | Pass | No blocking issues |
| TypeScript | Pass | |
| Local build | Blocked without VPS DB | `/categories` SSR at build time |
| pg pool max | 20 connections | Single Coolify container |

*Full Lighthouse / Web Vitals profiling requires browser run — not automated in this audit.*

---

## Slow pages / rendering

| Page | Issue | Cause |
|------|-------|-------|
| Admin dashboard | Heavy client bundles | recharts + large data tables |
| Admin products/orders | Unpaginated client fetches in some views | Full list loaded to browser |
| Storefront product | Client-heavy detail page | Variant UI, cart, image gallery |
| All pages | CMSContext provider | Client fetch of settings + CMS blocks on mount |

---

## Slow APIs (identified by code review)

| API | Risk | Mitigation |
|-----|------|------------|
| `/api/catalog/products` | Large JSON with variants | Already uses aggregated variant JSON |
| `/api/admin/stats` | Multiple aggregate queries | Acceptable for admin-only |
| `/api/storefront/search` | ILIKE on text fields | Add index on `products.name`, `products.description` if slow |
| Payment verify/callback | External Moolre API (15s timeout) | Async; does not block page render |

---

## Database

| Finding | Recommendation |
|---------|----------------|
| Order lookup by `order_number` | Ensure index exists (likely unique) |
| Product slug lookup | Index on `products.slug` |
| N+1 in checkout | Batched product fetch by UUID array — OK |
| Connection pooling | Singleton pool — OK for current scale |

Suggested indexes (apply if EXPLAIN shows seq scans):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status_created ON orders(payment_status, created_at);
```

---

## Frontend / bundle

| Item | Impact |
|------|--------|
| `@react-google-maps/api` | Loaded only where maps used |
| recharts | Admin-only — consider dynamic import |
| Many `'use client'` pages | Larger JS payload vs RSC-first |
| HomeHeroSlider | Client carousel — acceptable for UX |

---

## Freezing causes (reported → investigated)

| Symptom | Likely cause | Fix status |
|---------|--------------|------------|
| Infinite loading on admin | Failed API without error state | Partial — some pages have try/catch |
| Checkout stuck | Payment API hang | Moolre fetch has no explicit timeout on link route — recommend 15s AbortController |
| Order success spinner | Waiting for verify | 3s delay + verify endpoint — by design |
| DB connection errors locally | Wrong DATABASE_URL host | Expected — use VPS network |

---

## Fixes applied

- Idempotent payment processing reduces duplicate work on callback retries
- Rate limiting on payment/callback/notification endpoints
- Removed unnecessary Supabase cookie check in middleware (minor middleware savings)

---

## Recommended next steps

1. **Deploy** current hardening — reduces failed payment retries and duplicate notifications.
2. Add **15s timeout** to Moolre link creation fetch (mirror verify timeout).
3. Split **CMSContext** — server-load public settings in layout; client only for cart/user.
4. Add **pagination** to admin orders/products list APIs.
5. Run **Lighthouse** on `/`, `/shop`, `/product/[slug]`, `/checkout` post-deploy.
6. Add **Redis or in-memory cache** for public catalog (short TTL) if traffic grows.

---

## Before / after (expected post-deploy)

| Area | Before | After |
|------|--------|-------|
| Duplicate payment confirmations | Possible | Prevented via `confirmation_sent_at` |
| Callback replay on paid orders | Re-processed | Skipped (idempotent RPC) |
| Failed callback after success | Could mark failed | Blocked |
| Cron abuse | Open if no secret | Requires CRON_SECRET |

Infrastructure changes (CDN, read replicas) not required at current scale.
