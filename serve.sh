#!/usr/bin/env bash
# serve.sh — serve the whole system with ONE command.
#
#   ./serve.sh
#
# Behavior:
#   1. Stops any already-running backend/frontend (fresh restart every run)
#   2. Creates the demo database (default: inventory_test) if missing
#   3. Applies the schema (tables, FKs, triggers, views — idempotent)
#   4. Starts the backend on  :8000  and the frontend on :5173
#   5. Ctrl+C completely shuts BOTH down (no orphan processes left behind)
#
# Overridable env vars: DB_NAME, DB_USER (defaults: inventory_test, postgres)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-inventory_test}"
DB_USER="${DB_USER:-postgres}"

BACKEND_PID=""
FRONTEND_PID=""
CLEANED_UP=""

# ---------------------------------------------------------------------------
# stop_all — kill every backend/frontend process (stale OR ours) by name.
# The  [u]vicorn / [v]ite  patterns use the classic trick that prevents the
# regex from matching THIS script's own command line, so we never kill
# ourselves. SIGTERM first, then SIGKILL after a grace period.
# ---------------------------------------------------------------------------
stop_all() {
  echo "Stopping running servers..."
  # Our own recorded children.
  for pid in "$BACKEND_PID" "$FRONTEND_PID"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
  done
  # Any backend (covers --reload parent+worker pairs) and frontend processes.
  pgrep -f '[u]vicorn inventory_management_system' | xargs -r kill 2>/dev/null || true
  pgrep -f '[v]ite' | xargs -r kill 2>/dev/null || true
  sleep 1
  pgrep -f '[u]vicorn inventory_management_system' | xargs -r kill -9 2>/dev/null || true
  pgrep -f '[v]ite' | xargs -r kill -9 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# cleanup — guaranteed to run on exit; kills children + everything on :8000/
# :5173 so NOTHING keeps running after the script exits.
# ---------------------------------------------------------------------------
cleanup() {
  if [ -n "$CLEANED_UP" ]; then return; fi
  CLEANED_UP="1"
  echo "Shutting down backend + frontend..."
  stop_all
  # Make sure the ports are actually released before we go.
  for _ in $(seq 1 10); do
    if ! ss -tln 2>/dev/null | grep -Eq ':8000 |:5173 '; then break; fi
    sleep 0.3
  done
}

trap 'cleanup; exit 0' INT TERM
trap cleanup EXIT

echo "== Smart Inventory — serving backend + frontend =="

# ---- 0) Kill any stale servers so we always restart fresh ----
stop_all

# ---- 1) Database: create if missing, then apply schema ----
if ! psql -U "$DB_USER" -h localhost -lqt 2>/dev/null | cut -d '|' -f 1 | grep -qw "$DB_NAME"; then
  echo "Creating database '$DB_NAME'..."
  psql -U "$DB_USER" -h localhost -c "CREATE DATABASE $DB_NAME" >/dev/null
fi

echo "Applying schema to '$DB_NAME'..."
(cd "$ROOT/backend" && DB_NAME="$DB_NAME" uv run python -c \
  "from inventory_management_system.database import init_db; init_db()")

# ---- 2) Backend ----
echo "Starting backend on :8000..."
(
  cd "$ROOT/backend"
  exec env DB_NAME="$DB_NAME" uv run uvicorn inventory_management_system.main:app --port 8000
) &
BACKEND_PID=$!

for _ in $(seq 1 30); do
  curl -sf -m 1 http://127.0.0.1:8000/ >/dev/null 2>&1 && break
  sleep 0.5
done
if ! curl -sf -m 2 http://127.0.0.1:8000/ >/dev/null 2>&1; then
  echo "Backend failed to start — check the output above."
  exit 1
fi

# ---- 3) Frontend ----
echo "Starting frontend on :5173..."
(
  cd "$ROOT/frontend"
  exec npm run dev
) &
FRONTEND_PID=$!

echo
echo "  Backend : http://localhost:8000   (Swagger docs: /docs)"
echo "  Frontend: http://localhost:5173"
echo
echo "  Demo login:  admin01 / secret123   (admin)"
echo "               cashier / secret123   (staff)"
echo
echo "  Press Ctrl+C to stop both servers."

# Wait for both server processes (Ctrl+C interrupts wait and triggers the trap).
wait "$BACKEND_PID" "$FRONTEND_PID"