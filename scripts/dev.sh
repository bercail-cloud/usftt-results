#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Start postgres if not running
if ! docker ps --format '{{.Names}}' | grep -q 'usftt-pg'; then
  echo "Starting PostgreSQL..."
  docker rm -f usftt-pg 2>/dev/null || true
  docker run -d --name usftt-pg \
    -e POSTGRES_USER=usftt \
    -e POSTGRES_PASSWORD=usftt \
    -e POSTGRES_DB=usftt \
    -p 5433:5432 \
    postgres:17-alpine
  echo "Waiting for PostgreSQL..."
  sleep 3
fi

# Run migrations
echo "Running migrations..."
DATABASE_URL=postgresql://usftt:usftt@localhost:5433/usftt node packages/api/scripts/migrate.mjs

# Kill any existing processes on our ports
lsof -ti :3010 | xargs kill -9 2>/dev/null || true
lsof -ti :5180 | xargs kill -9 2>/dev/null || true

echo ""
echo "Starting dev servers..."
echo "  Frontend: http://localhost:5180"
echo "  API:      http://localhost:3010"
echo ""

# Start API and Web in parallel
npx tsx watch --env-file=.env.development packages/api/src/index.ts &
API_PID=$!

npx vite --config packages/web/vite.config.ts packages/web &
WEB_PID=$!

trap "kill $API_PID $WEB_PID 2>/dev/null; exit" INT TERM

wait
