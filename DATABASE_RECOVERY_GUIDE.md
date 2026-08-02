# Database Recovery Guide — Mamator

**Database:** `store_mamator`  
**Host:** big VPS (`169.58.8.203`) — Docker container `fleet-postgres`  
**App role:** `store_mamator`  
**Production URL:** https://mamator.com

This guide covers backup locations, restore outline, and migration rollback. **Do not run destructive steps on production without a fresh backup.**

---

## 1. Backup locations (fleet)

| Location | Contents |
|----------|----------|
| `/data/fleet/backups/` | Automated fleet Postgres backups (`store_*` databases) |
| `/data/fleet/scripts/` | Provision and backup scripts |
| `~/mamator-restore/` | Mamator-specific restore bundle (SQL dump, uploads) |
| Supabase export (historical) | Pre-cutover source — no longer live |

List backups on VPS:

```bash
ssh big-vps 'sudo ls -lah /data/fleet/backups/ | tail -20'
```

Fleet CLI:

```bash
ssh big-vps 'sudo fleet db list'
```

---

## 2. Pre-recovery checklist

- [ ] Identify **point in time** to restore (before bad migration? before data accident?)
- [ ] Take a **new backup** of current state (even if corrupted — for forensics)
- [ ] Stop or scale down **mamator-app** Coolify deployment (prevent writes during restore)
- [ ] Notify stakeholders — mamator.com checkout will be unavailable
- [ ] Have `DATABASE_URL` credentials available (Coolify env — do not commit)

---

## 3. Full database restore (outline)

### 3.1 Stop application writes

In Coolify UI or via fleet: stop `mamator-app` or set maintenance mode.

### 3.2 Restore from fleet backup

Exact filename varies by date. Pattern:

```bash
ssh big-vps

# Example — adjust BACKUP_FILE to actual name in /data/fleet/backups/
BACKUP_FILE=/data/fleet/backups/store_mamator_YYYY-MM-DD_HHMMSS.dump

sudo docker exec -i fleet-postgres pg_restore \
  -U postgres \
  -d store_mamator \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  < "$BACKUP_FILE"
```

Alternative from custom SQL dump:

```bash
sudo docker exec -i fleet-postgres psql -U postgres -d store_mamator < ~/mamator-restore/dump.sql
```

### 3.3 Re-apply migrations (if backup predates 006–009)

```bash
# From local machine with DATABASE_URL tunnel or on VPS with env set
node scripts/migrate-db.mjs
node scripts/test-db-schema.mjs
```

### 3.4 Restore uploads (if needed)

Uploads are **not** in Postgres:

```bash
# Typical path — confirm on VPS
sudo rsync -a ~/mamator-restore/uploads/ /var/www/mamator/uploads/
```

### 3.5 Verify and restart app

```bash
curl -s https://mamator.com/api/health/db
# Expect status: healthy

# Spot-check
sudo docker exec fleet-postgres psql -U postgres -d store_mamator \
  -c "SELECT COUNT(*) FROM orders; SELECT COUNT(*) FROM products;"
```

Restart mamator-app in Coolify.

---

## 4. Partial recovery scenarios

### 4.1 Single migration failed mid-apply

`migrate-db.mjs` wraps each file in `BEGIN`/`ROLLBACK` on error. Fix the SQL file and re-run:

```bash
node scripts/migrate-db.mjs
```

Do **not** manually INSERT into `schema_migrations` unless the SQL actually succeeded.

### 4.2 Roll back one migration (007–009)

PostgreSQL has no built-in down migrations. Options:

| Migration | Manual rollback (destructive) |
|-----------|------------------------------|
| **007** | `CREATE OR REPLACE` with 004 function body — loses row lock |
| **008** | `DROP TABLE payment_callback_events CASCADE` |
| **009** | Drop CHECK constraints and new indexes; `ALTER COLUMN currency SET DEFAULT 'USD'` |

After manual rollback, remove the migration id:

```sql
DELETE FROM schema_migrations WHERE id = '009_integrity_constraints_indexes.sql';
```

Only do this on dev or when restoring from backup is not an option.

### 4.3 Accidental payment_status change

If admin manually updated DB (bypassing app):

1. Restore from backup taken before change, **or**
2. Use Payment Reconcile admin UI + Moolre verify to re-establish truth, **or**
3. Inspect `payment_callback_events` and `payment_reconciliation_log` for last known good state

### 4.4 Lost schema_migrations table

Re-run migration 006 only (idempotent):

```bash
node scripts/migrate-db.mjs
```

If 006 already applied but table dropped, recreate manually from `006_schema_migrations_bootstrap.sql`.

---

## 5. Connection for local recovery tools

From Windows dev machine, `DATABASE_URL` in `.env.local` typically points at VPS Postgres (direct or tunnel).

Test connectivity:

```bash
node scripts/test-db-schema.mjs
```

Never commit `.env.local` or print full connection strings in logs.

---

## 6. Supabase → Postgres re-cutover (disaster)

If fleet DB is lost entirely:

1. Restore latest **Supabase export** or `~/mamator-restore/` bundle
2. Run `002_post_supabase_import.sql` if dump still has `auth.users`
3. Run full migration chain: `node scripts/migrate-db.mjs`
4. Restore uploads from backup
5. Redeploy app with Postgres env vars only (no Supabase keys)

See `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md` and `SUPABASE_TO_POSTGRES_DATABASE_REPORT.md`.

---

## 7. Post-recovery verification

| Check | Command / endpoint |
|-------|-------------------|
| Schema smoke | `node scripts/test-db-schema.mjs` |
| HTTP health | `GET /api/health/db` |
| Migration ledger | `SELECT id FROM schema_migrations ORDER BY id` |
| Integrity | `bash scripts/_db_integrity.sh` (on VPS) |
| Admin login | JWT session against restored `users` |
| Moolre sandbox | One test payment end-to-end |

---

## 8. Backup policy recommendations

| Frequency | Scope |
|-----------|-------|
| Daily | fleet automated `store_mamator` dump |
| Before each migration | Manual `pg_dump` before `migrate-db.mjs` on production |
| Before schema DDL | Coolify deploy with migration step |

Example manual backup:

```bash
ssh big-vps 'sudo docker exec fleet-postgres pg_dump -U postgres -Fc store_mamator \
  > /data/fleet/backups/store_mamator_manual_$(date +%Y%m%d_%H%M%S).dump'
```

---

## 9. Emergency contacts and paths

| Resource | Path / command |
|----------|----------------|
| VPS SSH | `ssh big-vps` |
| Coolify | `http://169.58.8.203:8000` |
| Postgres shell | `sudo docker exec -it fleet-postgres psql -U postgres -d store_mamator` |
| App logs | Coolify → mamator-app → Logs |
| Restore scripts | `~/mamator-restore/`, `/data/fleet/scripts/` |

---

## Related documents

- `MIGRATION_STATUS_REPORT.md` — migration ids and rollback notes
- `DATABASE_AUDIT_AND_REPAIR_REPORT.md` — current schema state
- `docs/MIGRATION_RECOVERY_LOG.md` — historical recovery log
