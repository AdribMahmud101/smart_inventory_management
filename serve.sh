#!/usr/bin/env bash
# serve.sh — serve the whole system with ONE command.
#
#   ./serve.sh
#
# What it does:
#   1. Creates the demo database (default: inventory_test) if missing
#   2. Applies the schema (tables, FKs, triggers, views — idempotent)
#   3. Starts the backend on  :8000 (or skips it if already running)
#   4. Starts the frontend on :5173
#   5. Ctrl+C stops both servers.
#
# Overridable env vars: DB_NAME, DB_USER (defaults: inventory_test, postgres)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-inventory_test}"
DB_USER="${DB_USER:-postgres}"

echo "== Smart Inventory — serving backend + frontend =="

# ---- 1) Database: create if missing, then apply schema ----
if ! psql -U "$DB_USER" -h localhost -lqt 2>/dev/null | cut -d '|' -f 1 | grep -qw "$DB_NAME"; then
  echo "Creating database '$DB_NAME'..."
  psql -U "$DB_USER" -h localhost -c "CREATE DATABASE $DB_NAME" >/dev/null
fi

echo "Applying schema to '$DB_NAME'..."
(cd "$ROOT/backend" && DB_NAME="$DB_NAME" uv run python -c \
  "from inventory_management_system.database import init_db; init_db()")

# ---- 2) Backend (skip if something healthy is already on :8000) ----
BACKEND_PID=""
if curl -sf -m 2 http://127.0.0.1:8000/ >/dev/null 2>&1; then
  echo "Backend already running on :8000 — skipping."
else
  echo "Starting backend on :8000..."
  (cd "$ROOT/backend" && exec env DB_NAME="$DB_NAME" uv run uvicorn \
    inventory_management_system.main:app --port 8000) &
  BACKEND_PID=$!

  for _ in $(seq 1 30); do
    curl -sf -m 1 http://127.0.0.1:8000/ >/dev/null 2>&1 && break
    sleep 0.5
  done
  if ! curl -sf -m 2 http://127.0.0.1:8000/ >/dev/null 2>&1; then
    echo "Backend failed to start — check the output above."
    exit 1
  fi
fi

# ---- 3) Frontend ----
echo "Starting frontend on :5173..."
(cd "$ROOT/frontend" && exec npm run dev) &
FRONTEND_PID=$!

# ---- 4) Stop both on Ctrl+C / exit ----
cleanup() { kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo
echo "  Backend : http://localhost:8000   (Swagger docs: /docs)"
echo "  Frontend: http://localhost:5173"
echo
echo "  Demo login:  admin01 / secret123   (admin)"
echo "               cashier / secret123   (staff)"
echo
echo "  Press Ctrl+C to stop both servers."
wait
