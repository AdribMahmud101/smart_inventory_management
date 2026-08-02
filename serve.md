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

Apply the database schema (creates all tables, FKs, triggers, views —
idempotent, safe to re-run):

```bash
DB_NAME=postgres uv run python -c "from inventory_management_system.database import init_db; init_db()"
```

Credentials come from environment variables with local defaults
(`localhost:5432/postgres`). Override with `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, `DB_PASSWORD` as needed.

### Frontend

```bash
cd frontend
npm install         # install Vite, React, Tailwind, shadcn/ui, Recharts, axios
```

---

## 3. Serving the backend

```bash
cd backend
uv run uvicorn inventory_management_system.main:app --reload
```

- API: <http://localhost:8000>
- Health check: <http://localhost:8000/> → `{"status": "System Online"}`
- Interactive docs (Swagger UI): <http://localhost:8000/docs>

To run against a different database (e.g. the demo database used below):

```bash
DB_NAME=inventory_test uv run uvicorn inventory_management_system.main:app --reload
```

---

## 4. Serving the frontend

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

Register users through the app (or `POST /api/auth/register`):

| Role | Username | Password | Sees in sidebar |
| ---- | -------- | -------- | --------------- |
| Admin | `admin01` | `secret123` | Dashboard, POS, Products, placeholders |
| Employee | `cashier` | `secret123` | POS, placeholders |

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

```bash
# Ctrl+C in each terminal, or:
pkill -f "uvicorn inventory_management_system"   # stop backend
pkill -f vite                                     # stop frontend
```

---

## 8. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Frontend shows network errors | Start the backend first; check `http://localhost:8000/` |
| `Database "..." does not exist` | Create it: `psql -U postgres -h localhost -c "CREATE DATABASE inventory_test;"` |
| 401 on API calls | Log in again — tokens expire after 7 days |
| Port already in use | Change ports (`uvicorn ... --port 8001`, or edit `vite.config.js` proxy) |
| 403 on Dashboard/Products | You are logged in as a **staff** user; use an admin account |
