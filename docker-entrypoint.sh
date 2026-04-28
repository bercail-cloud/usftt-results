#!/bin/sh
set -e

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"

echo "Waiting for PostgreSQL at ${PGHOST}:${PGPORT}..."
RETRIES=30
until nc -z -w 2 "$PGHOST" "$PGPORT"; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "ERROR: PostgreSQL is not reachable at ${PGHOST}:${PGPORT} after 30 attempts" >&2
    exit 1
  fi
  echo "Waiting for postgres, $RETRIES remaining..."
  sleep 1
done

echo "Running migrations..."
node packages/api/scripts/migrate.mjs

echo "Starting API server..."
exec node packages/api/dist/index.js
