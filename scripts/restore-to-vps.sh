#!/usr/bin/env bash
# Run ON big-vps: bash ~/mamator-restore/restore-to-vps.sh
set -euo pipefail

DB=store_mamator
ROLE=store_mamator
PASS="${STORE_MAMATOR_PASS:-e7d9129408b01ee38946dc6bb0a0f5f6666c997017d54538}"
WORKDIR="${1:-$HOME/mamator-restore}"

psql_store() {
  sudo docker exec -i -e PGPASSWORD="$PASS" fleet-postgres \
    psql -v ON_ERROR_STOP=1 -U "$ROLE" -d "$DB"
}

echo "==> Applying schema"
psql_store < "$WORKDIR/001_plain_postgres.sql"

echo "==> Applying data"
psql_store < "$WORKDIR/data.sql"

echo "==> Row counts"
psql_store <<SQL
SELECT 'users' t, count(*) FROM users
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'categories', count(*) FROM categories
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'product_images', count(*) FROM product_images;
SQL

if [[ -d "$WORKDIR/uploads" ]]; then
  echo "==> Copying uploads to /var/www/mamator/uploads"
  sudo mkdir -p /var/www/mamator/uploads
  sudo cp -a "$WORKDIR/uploads/." /var/www/mamator/uploads/
fi

echo "==> Done"