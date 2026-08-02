# How to Serve the Project (Backend + Frontend)

This guide covers running the whole system locally for the course demo:
the **FastAPI backend** (raw SQL + PostgreSQL) and the **React frontend**
(Vite) that talks to it.

---

## 1. Prerequisites

| Tool | Version | Check with |
| ---- | ------- | ---------- |
| [uv](https://docs.astral.sh/uv/) | any recent | `uv --version` |
| PostgreSQL | 12+ (tested on 18) | `pg_isready` |
| Node.js + npm | Node 20+ (tested on 24) | `node --version` |

Make sure your local PostgreSQL is running:

```bash
pg_isready          # → "accepting connections"
```

---

## 2. One-time setup

### Backend

```bash
cd backend
uv sync             # create venv + install dependencies (fastapi, uvicorn, psycopg)
```

### Frontend

```bash
cd frontend
npm install         # install Vite, React, Tailwind, shadcn/ui, Recharts, axios
```

### Make the script executable

```bash
chmod +x serve.sh  # only needed once, after cloning
```

---

## 3. Serving everything — ONE command

```bash
./serve.sh
```

`serve.sh` (at the project root) does everything for you:

1. **Stops any already-running backend/frontend**, then restarts fresh —
   so `./serve.sh` always gives you a clean, correct stack (no stale
   "wrong database" servers left behind)
2. Creates the demo database (`inventory_test`, overridable via `DB_NAME`) if
   it doesn't exist
3. Applies the schema (tables, FKs, triggers, views — idempotent)
4. Starts the **backend** on <http://localhost:8000>
5. Starts the **frontend** on <http://localhost:5173>
6. Your `Ctrl+C` **completely shuts down both** — no orphan processes stay
   running (backup kill-by-port + process cleanup)

Output after startup:

```
  Backend : http://localhost:8000   (Swagger docs: /docs)
  Frontend: http://localhost:5173

  Demo login:  admin01 / secret123   (admin)
               cashier / secret123   (staff)

  Press Ctrl+C to stop both servers.
```

That's it — one command, nothing else to run.

---

## 4. Manual serving (advanced / alternative)

Only needed if you want the servers in separate terminals.

### 4.1 Backend

> **IMPORTANT — pick the right database.** The backend reads `DB_NAME` at
> startup. Without it, the app connects to the default `postgres` database
> and the demo accounts will **not** work (login returns
> "Invalid credentials").

```bash
cd backend
DB_NAME=inventory_test uv run uvicorn inventory_management_system.main:app --reload
```

- API: <http://localhost:8000>
- Health check: <http://localhost:8000/> → `{"status": "System Online"}`
- Interactive docs (Swagger UI): <http://localhost:8000/docs>

> **Gotcha:** if a previous backend is still using port 8000, kill it first
> or the old (wrong-database) process keeps serving:
>
> ```bash
> pkill -f "uvicorn inventory_management_system"
> ```

### 4.2 Frontend

```bash
cd frontend
npm run dev
```

- App: <http://localhost:5173>
- The Vite dev server **proxies** `/api/*` to `http://localhost:8000`
  (see `frontend/vite.config.js`), so the browser never hits CORS in dev.

> The backend must be running on port 8000 first, or the frontend's API
> calls will fail with network errors.

---

## 5. Demo accounts

The demo database `inventory_test` ships with two pre-registered accounts.
**They only work when the backend uses `inventory_test`** — `./serve.sh`
handles this automatically; when serving manually, start with
`DB_NAME=inventory_test` (section 4.1). A backend pointed at the default
`postgres` database will reject them with "Invalid credentials".

| Role | Username | Password | Sees in sidebar |
| ---- | -------- | -------- | --------------- |
| Admin | `admin01` | `secret123` | Dashboard, POS, Products, placeholders |
| Employee | `cashier` | `secret123` | POS, placeholders |

To start from scratch, drop the database, re-create it, apply the schema and
register your own users:

```bash
psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS inventory_test; CREATE DATABASE inventory_test;"
cd backend
DB_NAME=inventory_test uv run python -c "from inventory_management_system.database import init_db; init_db()"
DB_NAME=inventory_test uv run uvicorn inventory_management_system.main:app --reload
# then register users via the app at http://localhost:5173/login or POST /api/auth/register
```

---

## 6. Seeding sample data (optional)

```bash
cd backend
DB_NAME=inventory_test uv run python - <<'EOF'
import psycopg
conn = psycopg.connect(dbname="inventory_test", user="postgres", password="postgres", host="localhost")
with conn.cursor() as cur:
    cur.execute("""INSERT INTO products (name, sku, category, unit_price, cost_price, quantity_in_stock, reorder_level)
                   VALUES ('Wireless Mouse','WM-001','Electronics',25.00,12.00,10,3),
                          ('USB Cable','UC-002','Electronics',8.00,3.00,2,5),
                          ('Mechanical Keyboard','MK-001','Electronics',65.00,40.00,15,3),
                          ('Desk Lamp','DL-001','Office',30.00,18.00,4,5),
                          ('Notebook A5','NB-005','Stationery',4.50,2.00,50,10)""")
conn.commit(); conn.close()
print("seeded")
EOF
```

Demo data (users, products, customers, employees) is also applied as part of
the verification runs; drop and recreate the database to start fresh:

```bash
psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS inventory_test; CREATE DATABASE inventory_test;"
```

---

## 7. Stopping the servers

- **If you ran `./serve.sh`:** just press `Ctrl+C` in that terminal — it stops
  backend and frontend together.
- **Manual terminals:**

```bash
pkill -f "uvicorn inventory_management_system"   # stop backend
pkill -f vite                                     # stop frontend
```

---

## 8. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Login says **"Invalid credentials"** with the demo accounts | Backend is on the wrong database. Use `./serve.sh` (or start manually with `DB_NAME=inventory_test`, section 4.1) after killing any stale server on port 8000 |
| Frontend shows network errors | Start the backend first; check `http://localhost:8000/` |
| `Database "..." does not exist` | `./serve.sh` creates it automatically, or: `psql -U postgres -h localhost -c "CREATE DATABASE inventory_test;"` |
| 401 on API calls | Log in again — tokens expire after 7 days |
| "Address already in use" / port busy | `./serve.sh` kills stale servers and restarts fresh; manually: `pkill -f "uvicorn inventory_management_system"` and `pkill -f vite` |
| 403 on Dashboard/Products | You are logged in as a **staff** user; use an admin account |
