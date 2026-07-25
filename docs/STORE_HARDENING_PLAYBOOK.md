# Store Hardening Playbook (reusable)

Use this when bringing another MultiMey / Next.js store to production on **big-vps + Coolify + plain Postgres**.

This is distilled from **Affordable Perfumes GH** (`affordableperfume`) work in July 2026. Projects differ in schema names, brand copy, and payment providers — follow the **intent**, then adapt the **paths**.

Related docs in this repo:

| Doc | When to use |
|-----|-------------|
| [`SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`](./SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md) | Short project-specific cutover notes + env checklist |
| [`COOLIFY_SETUP.md`](./COOLIFY_SETUP.md) | Mamator Coolify app + env on big-vps |
| [`MIGRATION_RECOVERY_LOG.md`](./MIGRATION_RECOVERY_LOG.md) | Audit findings after Supabase to Postgres cutover |

### Mamator verification (native PG)

```bash
BASE=https://mamator.com
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/shop"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/blog"
curl -s "$BASE/api/storefront/products?featured=true&limit=2" | head -c 300
curl -s -X POST "$BASE/api/newsletter/subscribe" -H "Content-Type: application/json" -d '{"email":"verify-newsletter@example.com"}'
ssh big-vps "sudo fleet app mamator-app"
```

---

## 0. How to use this playbook

1. Clone / open the target store repo.
2. Skim each section below. Mark **Apply / Skip / Adapt**.
3. Prefer copying **patterns** (helpers, scripts, aggregation logic) over blind file paste.
4. Deploy only after the verification checklist at the end passes.
5. Never invent secrets; wait for real `.env` / Coolify env / `DATABASE_URL`.

**Staff VPS (this machine):**

```bash
ssh big-vps
sudo fleet apps
sudo fleet app <coolify-app-name>
sudo fleet deploy <coolify-app-name>
```

Coolify stores encrypted env in its DB — editing only the on-disk container `.env` is not enough for durable changes.

---

## 1. Architecture baseline (every migrated store)

### Goal

Keep `supabase.from(...)` / `supabase.auth` / `supabase.storage` in app code, but point them at **this app** + plain Postgres.

### Must-have pieces

| Concern | Typical path | Notes |
|---------|--------------|-------|
| Mode switch | `lib/db/mode.ts` | `DATABASE_URL` → plain PG |
| Pool | `lib/db/pool.ts` | Shared `pg` pool |
| Query compat | `lib/db/supabase-compat.ts` | Select/embed/upsert |
| FK embeds | `lib/db/fk-map.ts` | **Per-project** — update for each schema |
| Auth shim | `lib/db/auth.ts` + `app/auth/v1/[...path]` | bcrypt + JWT |
| Storage shim | `lib/db/storage.ts` + `app/storage/v1/object/...` | Disk under `STORAGE_ROOT` |
| REST shim | `app/rest/v1/[table]` + `rpc/[fn]` | Browser supabase-js |
| Server DB | `lib/server-db.ts` / `supabaseAdmin` | Prefer for API routes |

### Env cutover trio (set together)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Enables in-process Postgres |
| `NEXT_PUBLIC_USE_PLAIN_PG=true` | Edge middleware JWT path (no `pg` on Edge) |
| `NEXT_PUBLIC_SUPABASE_URL` | **App origin**, not `*.supabase.co` |

Also usually required: `AUTH_JWT_SECRET` (or `JWT_SECRET`), `NEXT_PUBLIC_APP_URL`, `STORAGE_ROOT` / `STORAGE_LOCAL_PATH`, `RESEND_API_KEY`, payment/SMS keys.

**Failure mode:** `DATABASE_URL` set but `NEXT_PUBLIC_USE_PLAIN_PG` unset → server on PG, middleware still hitting hosted Supabase → admin lockouts.

### Shim pitfalls to re-check on every project

- Nested embeds need correct `fk-map` (and often auto-include join FK columns).
- Browser storage uploads: multipart / Content-Type handling on storage routes.
- Upsert via REST vs in-process client differences.
- RPCs used at checkout (`mark_order_paid`, `upsert_customer_from_order`, `update_customer_stats`) must exist in the live DB.
- Order lookups by `order_number` must not cast non-UUID strings to UUID.

---

## 2. Deploy & build hygiene (Coolify / nixpacks)

### Workflow

1. Commit on `main` (or staging branch).
2. `git push origin HEAD`.
3. `sudo fleet deploy <app-name>`.
4. Confirm live image hash matches commit (`docker ps` image tag ≈ git SHA).
5. Smoke-test home, auth, one admin write, one storefront read.

### Common build failures

| Symptom | Fix pattern |
|---------|-------------|
| `npm ci` `ECONNRESET` | Retry deploy (network); not a code bug |
| TypeScript: local `const sendEmail = Boolean(...)` shadows import | Rename local flag (`wantEmail`) |
| Invalid `eslint-disable` | Remove / fix directive so `next build` passes |
| Build OK but runtime 503 on `/auth/v1` or `/rest/v1` | Missing `DATABASE_URL` in Coolify env |

### Image optimizer on Coolify

If `/_next/image?url=...` returns **HTTP 200 with `Content-Length: 0`**, sharp is broken in the image:

```ts
// next.config.ts
images: {
  unoptimized: true, // serve originals until sharp runtime is healthy
  // keep remotePatterns for /storage/** on your domain
}
```

Static files under `public/` still work; Next Image just skips optimization.

---

## 3. Performance: images

### Apply on every store with heavy heroes / uploads

1. **Batch compress `public/`** → WebP (keep PWA icons as PNG if manifest requires).
2. **Batch compress production storage** on VPS (`STORAGE_ROOT`).
3. **Compress on upload** in storage route via `lib/image-compress.ts` (sharp).
4. Point code at `.webp` paths; keep a **resolver** for legacy `.png` CMS/DB URLs.

### Typical scripts

| Script | Purpose |
|--------|---------|
| `scripts/compress-public-images.mjs` | Local `public/` → WebP |
| `scripts/compress-storage.mjs` | VPS storage tree |
| `npm run compress:images` / `compress:storage` | Wrappers |

### After converting heroes to WebP

Update both:

- Code defaults (`/hero-….webp`, `/heroes/….webp`)
- **DB `banners.image_url`** (admin homepage often still stores old `.png`)

```sql
UPDATE banners
SET image_url = replace(image_url, '.png', '.webp')
WHERE image_url LIKE '%.png';
```

Or map known paths in the homepage hero sanitizer so old CMS values keep working.

---

## 4. Storefront UX (adapt per brand)

These are product decisions — apply only when the merchant wants them.

| Change | Intent | Adapt |
|--------|--------|-------|
| Remove homepage hero trust strip | Less clutter in first viewport | Delete the absolute bottom bar on hero; don't remove shipping facts from `/shipping` unless asked |
| Denser category / product grids | Faster scan on mobile | Compact card width, tighter gaps |
| Footer Collection links | Dead links kill SEO/trust | Map “Signature / Featured / New” to real routes (`/categories`, `?featured=true`, `?sort=new`) |
| Shipping copy | Match real ops | Nationwide window + price range; express via rider apps if that is policy |
| PageHero / about cards | Consistency | Reuse shared hero image map (`lib/hero-images.ts`) |

**Rule:** one job per section; don’t leave fake UI that looks clickable.

---

## 5. Newsletter (replace fake subscribe)

### Problem

Many templates use `setTimeout` “success” with no backend.

### Pattern

1. `POST /api/newsletter/subscribe` (rate-limited).
2. Upsert into `customers` with a tag (e.g. `newsletter`).
3. Send welcome email via existing mail helper (`lib/notifications.ts`).
4. Promo code from env: `NEWSLETTER_PROMO_CODE` (create matching coupon in admin if you promise a code).
5. Admin campaigns: audience filter = that tag.

### Env

- `RESEND_API_KEY`
- `ADMIN_EMAIL` / merchant inbox
- `NEWSLETTER_PROMO_CODE`
- Brand From: usually `noreply@{store-host}` derived from site settings

---

## 6. Payments & notifications

### Merchant identity

Set Coolify env (not only container file):

- `MOOLRE_MERCHANT_EMAIL` → real store inbox  
- Fallback in code should also use the store domain, not a template default like `admin@standardecom.com`

### When payment confirms

Ensure RPC (or equivalent) runs:

- `mark_order_paid`
- `update_customer_stats` (or UI aggregates orders live — see §7)

### Campaign / notify route

Never shadow imported helpers:

```ts
// BAD
const sendEmail = Boolean(channels?.email);
await sendEmail({ ... }); // TypeError / build fail

// GOOD
const wantEmail = Boolean(channels?.email);
```

---

## 7. Admin: customers order counts

### Problem

`customers.total_orders` / `total_spent` / `last_order_at` go stale if RPCs aren’t called on every paid path (POS, cash, failed RPC, migration).

### Pattern (recommended UI fix)

On admin customers list:

1. Load `customers`.
2. Load recent `orders` (cap, e.g. 5000).
3. Aggregate in memory by **email** and **user_id** (skip cancelled for totals).
4. Merge onto each customer row.
5. Optionally append “guest” rows that have orders but no `customers` row.

Detail page should also query orders by `user_id` **or** `email`.

### Optional DB backfill

```sql
UPDATE customers cu SET
  total_orders = s.orders,
  total_spent = s.spent,
  last_order_at = s.last_order
FROM (
  SELECT lower(email) AS email,
         count(*) FILTER (WHERE status IS DISTINCT FROM 'cancelled')::int AS orders,
         coalesce(sum(total) FILTER (WHERE status IS DISTINCT FROM 'cancelled'), 0) AS spent,
         max(created_at) FILTER (WHERE status IS DISTINCT FROM 'cancelled') AS last_order
  FROM orders
  WHERE email IS NOT NULL AND email <> ''
  GROUP BY 1
) s
WHERE lower(cu.email) = s.email;
```

Prefer live aggregation in admin UI even after backfill.

---

## 8. Product SEO

### Pattern

1. Shared helper: `lib/product-seo.ts` (`slugify`, `buildProductSeo`).
2. Admin product form: auto-fill SEO when empty / on name change; merge metadata on save.
3. Status casing: match DB enum (`active` vs `Active`).
4. One-shot backfill: `scripts/backfill-product-seo.cjs` with `DATABASE_URL`  
   (`npm run seo:backfill` inside app container if needed).

### Verify

- Product page `<title>` / meta description populated.
- Slugs unique; no collisions on create.

---

## 9. Blog (don’t leave “coming soon” alerts)

### Pattern

| Piece | Path pattern |
|-------|----------------|
| List | `app/admin/blog/page.tsx` |
| Form | `components/admin/BlogPostForm.tsx` |
| New / edit | `app/admin/blog/new`, `app/admin/blog/[id]/edit` |
| Storefront list/detail | `app/(store)/blog/...` reading `blog_posts` where `status = 'published'` |

### Requirements

- Real insert/update/delete on `blog_posts` (no `alert('coming soon')`).
- Slug auto from title; unique slug.
- Featured image upload to storage bucket (`media` / `blog` — match project).
- Storefront uses **slug** URLs; resolve by slug or id.
- Sanitize HTML on render (`sanitizeHtml`).

If the merchant doesn’t want a blog, hide the module in admin modules — don’t leave a stub button.

---

## 10. Admin reliability checklist

Run through these on every store after migration:

| Area | What to verify |
|------|----------------|
| Admin layout | Session resolves; no infinite “Loading Admin…” |
| Products list | Category + stock filters work; select-all = filtered set |
| Product create | Slug collision handling; images upload |
| Categories | Cascade / unlink products on delete (FK-safe) |
| Orders list | Shows new orders; payment link resend sends `Authorization` |
| Reviews | Status values match DB enum |
| POS | Loads products with limit; can create order + customer |
| Coupons | Create/edit/list |
| Customers | Order counts accurate (§7) |
| Marketing campaigns | Email and/or SMS; subject not required for SMS-only |
| Wishlist (storefront) | Same storage source as header badge |
| Auth | Signup, login, logout, address book persist |

Purge obvious test accounts/orders before handoff (`example.com`, `cursor-audit-*`, smoke-test emails) only with merchant approval.

---

## 11. Brand / ops copy (project-specific)

Before launch, replace template leftovers:

- Merchant email defaults (`MOOLRE_MERCHANT_EMAIL`, `ADMIN_EMAIL`)
- Announcement bar text
- Shipping policy (zones vs nationwide)
- Footer support email / socials (TikTok, etc.)
- `site_settings` name, logo, phone
- Sitemap / canonical host (`www` vs apex)
- Remove placeholder hero trust claims that contradict shipping policy

---

## 12. Verification checklist (copy per project)

Replace `$BASE` and app name.

```bash
# Deploy image matches commit
ssh big-vps "sudo docker ps --filter name=<uuid-or-name> --format '{{.Image}} {{.Status}}'"

# Storefront
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/shop"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/blog"

# Heroes (raw file, not only /_next/image)
curl -sI "$BASE/hero-areej.webp" | head -n 5

# REST / auth shims
curl -s "$BASE/rest/v1/site_settings?select=key&limit=1"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" -d '{"email":"x","password":"y"}'

# Newsletter
curl -s -X POST "$BASE/api/newsletter/subscribe" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-newsletter@example.com"}'

# Storefront APIs
curl -s "$BASE/api/storefront/products?featured=true&limit=2" | head -c 300
```

Manual:

- [ ] Homepage hero shows real photos (not black bar)
- [ ] Admin → Customers shows non-zero orders for known buyers
- [ ] Admin → Blog → New Post saves draft/publish
- [ ] Admin → Products SEO fields auto-fill
- [ ] Checkout / Moolre callback still marks paid
- [ ] No “coming soon” alerts on admin primary actions

---

## 13. Suggested apply order on a new store

1. Confirm Coolify app + `DATABASE_URL` + plain-PG env trio.  
2. Run migration playbook verification (REST, auth, embeds, storage upload).  
3. Fix build blockers (TS shadows, eslint).  
4. Images: compress public + storage; set `unoptimized` if optimizer is empty; fix banner URLs.  
5. Wire newsletter + merchant emails.  
6. Admin customers live order aggregation + optional SQL backfill.  
7. Product SEO helper + backfill.  
8. Replace blog stub with real editor (or hide module).  
9. Storefront UX / shipping / footer link audit.  
10. Full verification checklist → deploy → re-check image hash.

---

## 14. What differs between projects

Expect to **adapt**, not copy blindly:

| Area | Usually differs |
|------|-----------------|
| `fk-map.ts` | Table/column names |
| Payment provider | Moolre vs other |
| Storage path / volume | Coolify mount |
| Enum casings | `active` vs `Active` |
| Blog / wholesale / POS modules | Enabled set |
| Brand fonts/colors | Design system |
| Shipping rules | Ops reality |
| Whether Supabase was fully removed | Some stores still hybrid |

If a store was **never** on Supabase, skip §1 cutover and still apply §2–§12 for quality.

---

## 15. Affordable Perfumes GH — reference snapshot

| Item | Value |
|------|--------|
| Repo | `katalambano878/affordableperfume` |
| Coolify app | `affordableperfume-app` |
| Production | https://www.affordableperfumesgh.com |
| Notable commits (Jul 2026) | Plain-PG harden → SEO/perf/admin → hero/customers → blog editor |

Key reusable artifacts from this repo to port:

- `lib/db/*` + REST/auth/storage routes  
- `lib/image-compress.ts` + compress scripts  
- `lib/product-seo.ts` + `scripts/backfill-product-seo.cjs`  
- `app/api/newsletter/subscribe`  
- Admin customers aggregation in `app/admin/customers/page.tsx`  
- `components/admin/BlogPostForm.tsx` + blog admin/store routes  
- `next.config.ts` `images.unoptimized` + storage `remotePatterns`

---

*Keep this playbook updated when a new store invents a better pattern — add a short note under the relevant section, not a second competing doc.*
