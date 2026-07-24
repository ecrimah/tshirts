# Migration recovery log (Supabase → Postgres)

Date: 2026-07-24  
App: Mamator (`mamator.com`)  
Source: Supabase project `ueuggrixyuiviuqpecie`  
Target DB: VPS `store_mamator` (Coolify fleet)

## Audit findings → fixes

| Issue | Root cause | Fix |
|-------|------------|-----|
| Uploaded images 404 | Upload API returned `/uploads/...` but Next had no handler (nginx-only assumption) | `next.config.ts` rewrite `/uploads/:path*` → `/api/uploads/:path*` |
| Test SMS always Unauthorized | Server action used empty Bearer token after cookie-auth cutover | `test-sms/actions.ts` now reads HttpOnly session cookie |
| Review create failed for guests / null user_id | POST inserted `user_id = null` against FK to `users` | Require login; insert authenticated user id |
| Admin analytics incomplete item data | `listOrdersAdmin` only returned quantity/name | Expanded `order_items` JSON payload |
| Coupons create/edit/delete stubs | Only GET API existed | Added POST + `[id]` PATCH/DELETE; wired admin UI |
| Forgot password fake timeout | Never called backend after Auth removal | Real `/api/auth/forgot-password` + `/api/auth/reset-password` + reset page |
| Runtime TS | Previously broken `supabase` refs on analytics | Migrated to `api('/api/orders')`; `tsc --noEmit` clean |

## Progress since recovery pass

- Downloaded **22** Storage objects into local `uploads/` and VPS `~/mamator-restore/uploads/`
- Regenerated restore bundle with `/uploads/...` URLs (`migration-data/vps-bundle/` → VPS `~/mamator-restore/`)
- Added [`docs/COOLIFY_SETUP.md`](./COOLIFY_SETUP.md)
- Temporarily allow Supabase image host in `next.config.ts` until uploads cutover

## Remaining ops blockers (not code)

1. **DB restore on VPS** still needs sudo: `bash ~/mamator-restore/restore-to-vps.sh`
2. **Coolify app** for mamator must be created by owner — see COOLIFY_SETUP.md
3. **GitHub** does not yet contain this migration — **commit + push required** before Coolify build
4. **Mamator payment/email env** must be filled in Coolify (MOOLRE/RESEND/CRON)
5. Legacy `scripts/*.mjs` still import `@supabase/supabase-js` (ops-only; not runtime)

## Verification checklist (run after DB restore + env)

- [ ] `npm run db:migrate` / schema applied on `store_mamator`
- [ ] Admin login with migrated password hashes
- [ ] Catalog + product images load
- [ ] Checkout creates order + order_items
- [ ] Order tracking by email + order number
- [ ] Admin products CRUD + upload
- [ ] Admin coupons CRUD
- [ ] Reviews (logged-in)
- [ ] Moolre payment verify/callback RPCs
- [ ] `rg @supabase app components context lib middleware` → empty
