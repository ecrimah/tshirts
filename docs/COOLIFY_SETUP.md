# Coolify setup — mamator.com

Staff `fleet` **cannot** create apps. Create this in Coolify UI (owner), then deploy.

## 1. Application

| Field | Value |
|-------|--------|
| Name | `mamator-app` |
| Source | GitHub `ecrimah/tshirts` |
| Branch | `main` (after migration code is pushed) |
| Build | Dockerfile (repo root) **or** Nixpacks/Node with `npm run build` + `npm start` |
| Port | `3005` |
| Domains | `mamator.com`, `www.mamator.com` |

## 2. Environment variables

Paste from local `.env.local` (never commit):

```
DATABASE_URL=postgres://store_mamator:***@fleet-pgbouncer:6432/store_mamator
DIRECT_URL=postgres://store_mamator:***@fleet-postgres:5432/store_mamator
AUTH_SECRET=...
AUTH_COOKIE_NAME=mamator_session
NEXT_PUBLIC_APP_URL=https://mamator.com
NEXT_PUBLIC_SITE_NAME=Mamator
UPLOAD_DIR=/var/www/mamator/uploads
NEXT_PUBLIC_UPLOAD_BASE_URL=https://mamator.com/uploads
EMAIL_FROM=info@mamator.com
# plus RESEND_*, MOOLRE_*, CRON_SECRET when ready
```

DB already provisioned: `sudo fleet db list` → `store_mamator`  
Secrets on server: `/data/fleet/secrets/store_mamator.env` (root)

## 3. Persistent uploads volume

Mount host path into the container:

- Host: `/var/www/mamator/uploads`
- Container: `/var/www/mamator/uploads`

Or Coolify persistent storage at the same `UPLOAD_DIR`.

## 4. One-time DB + media restore (needs sudo once)

```bash
ssh big-vps
bash ~/mamator-restore/restore-to-vps.sh ~/mamator-restore
sudo mkdir -p /var/www/mamator/uploads
sudo cp -a ~/mamator-restore/uploads/. /var/www/mamator/uploads/
```

## 5. Deploy

```bash
sudo fleet deploy mamator-app
```

## 6. After deploy

- [ ] https://mamator.com loads
- [ ] Admin login (`admin@mamatortrading.com` from migrated users)
- [ ] Product images load
- [ ] Checkout creates orders
