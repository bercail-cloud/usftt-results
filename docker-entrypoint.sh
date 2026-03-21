#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
RETRIES=30
until nc -z postgres 5432 || [ $RETRIES -eq 0 ]; do
  echo "Waiting for postgres, $((RETRIES--)) remaining..."
  sleep 1
done

echo "Running migrations..."
node packages/api/scripts/migrate.mjs

echo "Starting API server..."
exec node packages/api/dist/index.js
