# Smart Inventory and Business Management System — Backend

Educational backend for a smart inventory and business management system.
Built with **FastAPI** + **PostgreSQL**, using **raw SQL only** (no ORM).

> This README is updated incrementally as the project grows.

## Requirements

- [uv](https://docs.astral.sh/uv/) (Python package manager)
- A running local PostgreSQL instance

## Setup

```bash
cd backend
uv sync
```

This creates the virtual environment (`.venv`) and installs all dependencies
listed in `pyproject.toml`.

## Running the server

```bash
uv run uvicorn inventory_management_system.main:app --reload
```

Open <http://127.0.0.1:8000/> — you should see:

```json
{"status": "System Online"}
```

Interactive API docs are available at <http://127.0.0.1:8000/docs>.

## Environment variables

Database credentials default to local-dev values and can be overridden:

| Variable       | Default     |
| -------------- | ----------- |
| `DB_HOST`      | `localhost` |
| `DB_PORT`      | `5432`      |
| `DB_NAME`      | `postgres`  |
| `DB_USER`      | `postgres`  |
| `DB_PASSWORD`  | `postgres`  |

## Applying the database schema

Once your PostgreSQL server is up:

```bash
uv run python -c "from inventory_management_system.database import init_db; init_db()"
```

This creates the 8 core tables (`users`, `employees`, `customers`,
`products`, `sales`, `sales_items`, `expenses`, `audit_logs`), the foreign
key relationships, the inventory triggers (`update_stock_after_sale`,
`low_stock_alert`), and the dashboard views (`top_selling_products_view`,
`monthly_profit_view`, `low_stock_products_view`) using the raw SQL in
`src/inventory_management_system/schema.sql`. The script is idempotent —
safe to re-run any time.

## Project structure

```
backend/
├── pyproject.toml
├── uv.lock
└── src/inventory_management_system/
    ├── main.py       # FastAPI app + health check endpoint
    ├── database.py   # psycopg connection + schema loader
    └── schema.sql    # raw CREATE TABLE statements (placeholders)
```

## Current status

- [x] Project initialized with `uv`
- [x] FastAPI app with `/` health check endpoint
- [x] psycopg connection helper (env var driven)
- [x] Master schema: 8 placeholder tables (raw SQL)
- [x] Entity relationships (foreign keys)
- [x] Triggers: stock reduction + audit logging + low-stock alerts
- [x] Analytical views (top sellers, monthly profit, low stock)
- [x] API routers: products CRUD, POS checkout, analytics views
- [x] Pydantic request/response validation (interactive `/docs`)
- [x] Authentication & roles (`/auth/*`, PBKDF2 hashing, bearer tokens)
- [ ] Customers / employees / expenses endpoints
- [ ] Automated tests / linting / CI
- [ ] Frontend