# Smart Inventory and Business Management System

An **educational** full-stack project: a smart inventory & business management
system for a small shop — products, customers, employees, expenses, a POS
terminal, an admin dashboard, and an audit trail.

- **Backend:** FastAPI + PostgreSQL, **raw SQL only (no ORM)** — `backend/`
- **Frontend:** React + Vite + Tailwind + shadcn/ui — `frontend/`
- **One-command run:** `./serve.sh` (local) or `python3 serve.py` (local + share link)

> Built phase-by-phase for a course (see `reports/` for each phase's
> technical report). Code is intentionally kept simple and readable.

---

## Features (100% complete)

| Module | What it does |
| ------ | ------------ |
| Auth & roles | register / login (PBKDF2 hashing, bearer tokens), `admin` vs `staff` views |
| POS Terminal | product grid, search, cart, stock-aware checkout, success toast |
| Products | table + add/delete; `Low Stock` badge via DB trigger |
| Customers | table + add/delete (guarded by sales history) |
| Employees | table + add/delete (guarded by sales/expenses) |
| Expenses | table + add/delete (feeds dashboard profit) |
| Sales history | last 100 sales with customer / employee names |
| Dashboard (admin) | monthly sales-vs-expenses chart, top sellers pie, low-stock alerts |
| Audit trail | automatic `stock_decrease` entries written by a DB trigger |
| Live share | `python3 serve.py` prints a public tunnel URL to send to a teammate |

### Database design (raw SQL, `schema.sql`)

- **8 tables:** `users`, `api_tokens`, `employees`, `customers`, `products`,
  `sales`, `sales_items`, `expenses`, `audit_logs`
- **Foreign keys** guard every relationship (a product with past sales cannot
  be deleted)
- **Triggers:** sales automatically reduce stock + write audit entries;
  `products.status` stays in sync (`'In Stock'` / `'Low Stock'`)
- **Views:** `top_selling_products_view`, `monthly_profit_view`,
  `low_stock_products_view` power the dashboard

---

## Quick start

Prerequisites: `uv`, a running local PostgreSQL (user/db `postgres`,
password `postgres` by default), Node 20+.

```bash
./serve.sh                 # backend (:8000) + frontend (:5173), one command
```

Open <http://localhost:5173> and log in:

| Role | Username | Password |
| ---- | -------- | -------- |
| Admin | `admin01` | `secret123` |
| Staff | `cashier` | `secret123` |

### Share with a teammate

```bash
python3 serve.py           # boots the stack AND opens a public tunnel
```

The banner prints a `https://…loca.lt` URL you can text to a teammate — the
whole app (login, POS, dashboard) works through it.

### Manual run (separate terminals)

```bash
# terminal 1 — backend (DB_NAME=inventory_test is important for demo logins)
cd backend
DB_NAME=inventory_test uv run uvicorn inventory_management_system.main:app --reload

# terminal 2 — frontend
cd frontend
npm run dev
```

See `serve.md` for the full guide (DB setup, troubleshooting, seeding).

---

## Project layout

```
inventory_management_system/
├── backend/               # FastAPI + raw SQL (uv project)
├── frontend/              # React + Vite + Tailwind + shadcn/ui
├── reports/               # technical report per phase
├── serve.sh               # one-command local stack runner
├── serve.py               # stack runner + public tunnel + banner
└── serve.md               # serving guide
```

---

## Progress log

- Phase 0–1: foundation, schema, FKs, triggers, views
- Phase 2: API routers (products, sales, analytics) — raw SQL
- Phase 3: authentication + role-based access
- Phase 4: React frontend (login, POS, products, dashboard) — 50% demo
- Phase 5: customers, employees, expenses, sales history, audit — 100%

## License

Educational project — use freely for learning.