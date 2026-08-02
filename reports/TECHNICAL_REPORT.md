# Technical Report — Backend Foundation

**Project:** Smart Inventory and Business Management System
**Report date:** 2026-08-02
**Scope:** Initial backend foundation (Phase 0 setup)
**Location:** `backend/`

---

## 1. Executive Summary

The backend foundation for the Smart Inventory and Business Management System
has been established. The project is a Python backend using **FastAPI** for
the web layer and **PostgreSQL** (via **psycopg**) for persistence, built on
**raw SQL only explicitly — no ORM**. The implementation covers: project
initialization and dependency management with `uv`, a bootable FastAPI
application with a health-check endpoint, a database connection helper with
environment-variable-driven configuration, and a placeholder master schema
defining the eight core business tables.

No API business logic, authentication, or foreign-key-level relationships
have been implemented yet; this phase is intentionally the structural
foundation.

---

## 2. Project Structure

```
inventory_management_system/
└── backend/
    ├── pyproject.toml               # Project metadata + dependency manifest
    ├── uv.lock                      # Locked dependency resolution
    ├── README.md                    # How-to-run documentation
    ├── .gitignore
    ├── .python-version              # CPython 3.12
    ├── .venv/                       # Virtual environment (git-ignored)
    └── src/inventory_management_system/
        ├── __init__.py              # Package marker + CLI entry `main()`
        ├── main.py                  # FastAPI app + health check route
        ├── database.py              # psycopg connection + schema loader
        └── schema.sql               # Raw CREATE TABLE statements
```

The **src layout** (`src/<package>/`) is used, which enforces clean separation
package metadata versus exported code. The whole backend is isolated under
`backend/` so a future `frontend/` can coexist at the repo root.

---

## 3. Initialization & Dependency Management

### 3.1 `uv` project init

Initialized with `uv init --name inventory-management-system --python 3.12`.
`uv` is used as the package/venv manager — it creates `pyproject.toml`,
`.python-version`, and a virtual environment, resolving and locking all
dependencies into `uv.lock` for reproducible installs.

### 3.2 Dependencies

Installed via `uv add fastapi uvicorn psycopg[binary]`. Locked versions:

| Package        | Version | Purpose                                        |
| -------------- | ------- | ---------------------------------------------- |
| `fastapi`      | 0.141.1 | ASGI web framework + OpenAPI generation        |
| `uvicorn`      | 0.52.1  | ASGI server to run the app                      |
| `psycopg[binary]` | 3.3.4 | PostgreSQL driver (raw SQL), binary wheel       |
| `pydantic`     | 2.13.4  | Transitive dep: FastAPI request/response models |
| `starlette`    | 1.3.1   | Transitive dep: underlying ASGI layer           |

`requires-python = ">=3.12"` pins the language floor. The environment was
provisioned with **CPython 3.12.13**.

`[project.scripts]` exposes a console entry point
(`inventory-management-system`), currently a placeholder that prints a
greeting.

---

## 4. Application Layer (`main.py`)

The FastAPI application is defined in `main.py`.

```python
app = FastAPI(
    title="Smart Inventory and Business Management System",
    version="0.1.0",
    description="Backend for a simple inventory management system (educational project).",
)
```

- **Route** — `GET /` returns `{"status": "System Online"}`, tagged
  `["system"]`. Acts as a health check to confirm the process is up.
- **Purpose** — only a bootstrapping stub today; entity routers will be added
  in later phases.

Verified behavior: starting `uvicorn` and curling `/` returns the expected
JSON payload. FastAPI also auto-serves interactive docs at `/docs`.

---

## 5. Database Layer (`database.py`)

Raw SQL only — psycopg is called directly; there are **no ORM models** and
none are planned.

### 5.1 Connection configuration

Credentials are read once at module import from environment variables with
local-development fallbacks:

| Environment variable | Default       | Used for |
| -------------------- | ------------- | -------- |
| `DB_HOST`            | `localhost`   | Host      |
| `DB_PORT`            | `5432`        | Port      |
| `DB_NAME`            | `postgres`    | Database  |
| `DB_USER`            | `postgres`    | User      |
| `DB_PASSWORD`        | `postgres`    | Password  |

### 5.2 `get_connection()`

Returns a `psycopg.Connection` via `psycopg.connect(...)`. A fresh connection
is created per call — a deliberate, simple choice for this educational stage
(no pooling/complex connection management yet).

### 5.3 `init_db()`

Applies the schema by:
1. Locating `schema.sql` relative to the module file (`os.path.dirname(...)`)
   so it works regardless of the launch directory.
2. Executing the full SQL text through a cursor and committing.

`execute()` runs multiple statements in a single call when `psycopg`
processes multi-statement SQL; it is wrapped in a `with` block so the
connection is always closed and the transaction committed/rolled back safely.

---

## 6. Database Schema (`schema.sql`)

A foundation-only schema of **8 tables**, each with `CREATE TABLE IF NOT
EXISTS` and a `BIGSERIAL PRIMARY KEY`. Complex constraints, foreign
keys, views, and triggers are intentionally deferred.

### 6.1 Table inventory

| # | Table        | Purpose                                   | Key columns |
| - | ------------ | ----------------------------------------- | ----------- |
| 1 | `users`      | System login accounts                     | `username`, `email`, `password_hash`, `role`, `is_active` |
| 2 | `employees`  | Staff members                             | `user_id`, `full_name`, `position`, `hire_date`, `salary` |
| 3 | `customers`  | Buyers / clients                          | `full_name`, `email`, `phone`, `address`, `loyalty_points` |
| 4 | `products`   | Stock items                              | `name`, `sku`, `category`, `unit_price`, `cost_price`, `quantity_in_stock`, `reorder_level` |
| 5 | `sales`      | Sale "header" per transaction             | `customer_id`, `employee_id`, `sale_date`, `total_amount`, `payment_method`, `status` |
| 6 | `sales_items`| Sale "detail" lines (products per sale)  | `sale_id`, `product_id`, `quantity`, `unit_price`, `subtotal` |
| 7 | `expenses`   | Business costs                           | `category`, `description`, `amount`, `expense_date`, `paid_by` |
| 8 | `audit_logs` | Action audit trail                      | `user_id`, `action`, `entity_type`, `entity_id`, `details` |

### 6.2 Conventions used

- **Id pattern:** `BIGSERIAL PRIMARY KEY` (auto-incrementing integer).
- **Money:** `NUMERIC(10, 2)` for all financial columns.
- **Timestamps:** `TIMESTAMPTZ` with `DEFAULT NOW()`.
- **Status fields:** `VARCHAR` with sensible defaults (`'staff'`,
  `'cash'`, `'completed'`).
- **Link columns** (e.g., `sales.customer_id`) exist as plain `BIGINT` — the
  actual `FOREIGN KEY` constraints are marked with comments for phase 2.

### 6.3 Deliberate design choices

- `users.password_hash` (never plain-text) and `is_active` are present from
  day one to support authentication later.
- `loyalty_points` on `customers` anticipates the loyalty feature.
- `reorder_level` + `quantity_in_stock` on `products` anticipates stock
  alerting.
- `audit_logs` stores `entity_type`/`entity_id` generically so later code can
  record any mutation without schema changes.

---

## 7. Implementation Verification

The following were executed and confirmed during this phase:

| Check | Command | Result |
| ----- | ------- | ------ |
| Dependencies resolve | `uv sync` | Resolved 18 packages, installed 16 |
| Server boots | `uv run uvicorn inventory_management_system.main:app` | Started on port 8000 |
| Health check | `curl http://127.0.0.1:8000/` | `{"status": "System Online"}` |
| Modules import | `import ...main, ...database` | OK |

Schema creation was **not** run against a live PostgreSQL instance during
this report; the SQL is valid and ready to apply once a local PostgreSQL
server is available.

Note: after relocating the project into `backend/`, the stale `.venv` was
deleted and rebuilt with `uv sync` because the binaries' shebang pointed to
the old absolute path. `schema.sql` is resolved relative to the module file,
so it remains location-independent.

---

## 8. What Is NOT Implemented (Next Phases)

| Area | Status |
| ---- | ------ |
| Foreign keys / constraints / indexes | Deferred |
| Views and triggers | Deferred |
| Entity API endpoints (CRUD) | Not started |
| Authentication & role-based access | Not started |
| Inventory stock-alert logic, sales flow, expenses reporting | Not started |
| Connection pooling | Not started |
| Automated tests / linting / CI | Not started |
| Frontend | Not started |

---

## 9. Risks & Notes

- **Single-connection-per-request**: acceptable for now, but PostgreSQL
  connection pooling (e.g., `psycopg_pool` or `pgbouncer`) should be revisited
  as soon as endpoints exercise real traffic.
- **Credentials in env vars only** — defaults are local-dev; provision real
  secrets outside source control in staging/production.
- `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, so it is safe to re-run,
  but a real **migration strategy** (versioned migrations) should be added
  before the schema evolves past the placeholder stage.
- The git repository contains no commits yet — an initial commit should be
  created to snapshot this foundation.