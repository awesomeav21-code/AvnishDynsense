#!/bin/sh
set -e

echo "=== Dynsense API Entrypoint ==="

# Run database migrations (docker-compose depends_on healthcheck ensures DB is ready)
echo "Running database migrations..."
node packages/db/dist/run-migrations.js
echo "Migrations complete."

# Seed demo data (idempotent — skips if data exists)
echo "Seeding demo data..."
node packages/db/dist/seed.js
echo "Seed complete."

# Start the API server
echo "Starting API server..."
exec node apps/api/dist/index.js
