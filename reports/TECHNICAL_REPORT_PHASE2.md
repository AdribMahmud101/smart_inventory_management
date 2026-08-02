# Technical Report — Phase 2: API Routing & Data Access

**Project:** Smart Inventory and Business Management System
**Report date:** 2026-08-02
**Scope:** Phase 2 — FastAPI routers, raw-SQL data access, POS checkout
**Files created:** `schemas.py`, `routers/products.py`, `routers/sales.py`,
`routers/analytics.py`
**Files updated:** `main.py`

---

## 1. Executive Summary

Phase 1 delivered the database logic (FKs, triggers, views). Phase 2 builds
the **API bridge** that receives HTTP requests from a future UI and executes
raw SQL against PostgreSQL through psycopg. The result is a modular FastAPI
application with nine routes across three domain routers, strict Pydantic
validation, and a POS checkout endpoint that drives the Phase 1 triggers
automatically.

**No ORM was introduced** — database interaction remains 100% raw SQL via
psycopg. All connections are managed with `with` blocks around the
`get_connection()` helper. Every endpoint was verified live against
PostgreSQL 18.4 with an end-to-end simulation.

---

## 2. Architecture

```
HTTP request (JSON)
      │
      ▼
FastAPI (main.py)  ── includes 3 routers
      │
      ├─ routers/products.py    CRUD on the products table
      ├─ routers/sales.py       POST /sales POS checkout
      └─ routers/analytics.py   SELECT * on the 3 dashboard views
      │
      ▼
schemas.py (Pydantic)  ── validates request/response ONLY
      │
      ▼
database.py get_connection()  ── with-block managed psycopg connection
      │
      ▼
PostgreSQL ── raw SQL; Phase 1 triggers/views fire automatically
```

### New/changed files

```
src/inventory_management_system/
├── main.py               # + include_router() registration
├── schemas.py            # NEW: all Pydantic request/response models
└── routers/
    ├── __init__.py       # NEW: package marker
    ├── products.py       # NEW: product CRUD (5 endpoints)
    ├── sales.py          # NEW: POST /sales checkout (1 endpoint)
    └── analytics.py      # NEW: view queries (3 endpoints)
```

---

## 3. `schemas.py` — Pydantic Models

The schema module defines models in three groups. These are strictly
validation/serialization — they never touch the database.

| Group | Models | Purpose |
| ----- | ------ | ------- |
| Products | `ProductBase`, `ProductCreate`, `ProductUpdate`, `ProductOut` | CRUD payloads; `ProductOut` adds `id`, `status`, `created_at` |
| Sales | `CartItem`, `CheckoutRequest`, `SaleItemOut`, `CheckoutResponse` | Cart validation + checkout response |
| Analytics | `TopSellingProduct`, `MonthlyProfit`, `LowStockProduct` | One model per view row |

Validation rules used:

- `CartItem.quantity: int = Field(ge=1)` — negative/zero quantities rejected
- `CheckoutRequest.items: list[CartItem] = Field(min_length=1)` — empty carts rejected
- Money fields are `Decimal` (`NUMERIC` fidelity), non-negative via `ge=0`

These constraints power FastAPI's automatic **422 validation errors** and the
interactive `/docs` schema display.

---

## 4. Router: `products.py` (Product Management)

Five endpoints, all raw SQL:

| Method | Path | SQL behavior |
| ------ | ---- | ------------ |
| GET | `/products` | `SELECT * FROM products ORDER BY id` |
| GET | `/products/{product_id}` | `SELECT * FROM products WHERE id = %s`; 404 if absent |
| POST | `/products` | `INSERT ... RETURNING *` (201); trigger sets `status` |
| PUT | `/products/{product_id}` | `UPDATE ... WHERE id = %s RETURNING *`; 404 if absent |
| DELETE | `/products/{product_id}` | `DELETE ... RETURNING id`; 404/409 handling |

Key implementation points:

- **`RETURNING *`** returns the full inserted/updated row in one round trip —
  including trigger-managed columns (`status`, `created_at`).
- **409 handling:** `DELETE` on a product referenced by `sales_items` raises
  `psycopg.errors.ForeignKeyViolation`, which is caught and re-raised as an
  HTTP 409 — the FK constraint (`fk_sales_items_product`) protects historical
  sales data.
- **Trigger cooperation:** creating a product with `quantity_in_stock = 2`
  immediately returns `"status": "Low Stock"` because the Phase 1
  `low_stock_alert` trigger fires on INSERT.

---

## 5. Router: `sales.py` (POS Checkout)

Single `POST /sales` endpoint implementing the checkout as **one database
transaction**:

```
1. For each cart line:  SELECT unit_price, quantity_in_stock FROM products
                        → 404 if product missing
                        → 400 if stock insufficient
                        → compute subtotal, accumulate total
2. INSERT INTO sales (customer_id, employee_id, total_amount, payment_method)
                        RETURNING id            → the sale header
3. For each line:       INSERT INTO sales_items  → FIRES Phase 1 triggers:
                          update_stock_after_sale (stock ↓ + audit log)
                          low_stock_alert (status sync)
4. with-block exit      → COMMIT
   any exception above  → ROLLBACK, connection closed
```

Design decisions:

- **Prices are resolved from the database**, not trusted from the client —
  the client sends only `product_id` + `quantity`; the server computes
  `unit_price`, `subtotal`, and `total_amount`.
- **Stock is pre-validated** in Python against `quantity_in_stock` (Phase 1's
  open item: no DB `CHECK (quantity >= 0)` yet), returning 400 before any
  write happens.
- **Atomicity is proven:** raising `HTTPException` inside the `with
  get_connection()` block rolls back the whole transaction — failed
  checkouts leave zero rows behind.
- Inserting into `sales_items` needs no extra code for stock/audit — the
  Phase 1 triggers do it automatically.

---

## 6. Router: `analytics.py` (Admin Dashboard)

Three thin endpoints — `SELECT *` on the Phase 1 views, no application-side
aggregation:

| Endpoint | View |
| -------- | ---- |
| GET `/analytics/top-selling-products` | `top_selling_products_view` |
| GET `/analytics/monthly-profit` | `monthly_profit_view` |
| GET `/analytics/low-stock-products` | `low_stock_products_view` |

Each returns rows as dicts (`row_factory=dict_row`) validated by the
corresponding Pydantic response model.

---

## 7. Verification (live PostgreSQL 18.4)

Test environment: scratch database `inventory_test` (dropped afterwards),
schema applied via `init_db()`, server run with `uv run uvicorn`.

### 7.1 Product CRUD

```
POST /products (10 units)  → 201 {"name":"Wireless Mouse", "status":"In Stock", ...}
POST /products (2 units)   → 201 {"name":"USB Cable", "status":"Low Stock", ...}   ← trigger on INSERT
GET  /products/1           → full row
GET  /products/99          → 404 {"detail":"Product not found"}
PUT  /products/1           → 200 updated row (price 25→30)
DELETE /products/3         → 200 {"message":"Product deleted"}
DELETE /products/1         → 409 (referenced by sales_items)
DELETE /products/99        → 404
```

### 7.2 POS checkout

```
POST /sales {"items":[{"product_id":1,"quantity":2},{"product_id":2,"quantity":1}]}
→ 200 {"sale_id":1,"total_amount":"68.00",
       "items":[{"product_id":1,"quantity":2,"unit_price":"30.00","subtotal":"60.00"},
                {"product_id":2,"quantity":1,"unit_price":"8.00","subtotal":"8.00"}]}
```

| Negative test | Result | Effect on DB |
| ------------- | ------ | ------------ |
| Empty cart `{"items":[]}` | 422 (Pydantic `min_length=1`) | none |
| Oversell `quantity:12` (stock 8) | 400 "Insufficient stock" | rolled back |
| Unknown product `product_id:99` | 404 | rolled back |

**Transaction integrity confirmed:** after all failed checkouts, the database
still contained exactly one sale (id 1) with two line items.

### 7.3 Trigger side effects (no application code)

```
Stock after sale:   Wireless Mouse Pro 10 → 8 (In Stock)
                    USB Cable          2 → 1 (Low Stock)
Audit logs:         2 rows: 'stock_decrease' with details "Stock reduced by 2 (sale item #1)" ...
```

### 7.4 Analytics

```
top-selling-products:  [{"product_name":"Wireless Mouse Pro","total_sold":2},
                        {"product_name":"USB Cable","total_sold":1}]
low-stock-products:    [{"product_name":"USB Cable","current_stock":1,"stock_status":"Low Stock"}]
monthly-profit:        [{"month":"2026-08-01","total_sales":"68.00","total_expenses":"0","profit":"68.00"}]
```

### 7.5 Route registration (OpenAPI)

All 9 routes present: `GET/POST /products`, `GET/PUT/DELETE
/products/{id}`, `POST /sales`, 3 analytics routes, plus the `GET /` health
check.

---

## 8. Deliverables summary

| Requirement | Delivered | Verified |
| ----------- | --------- | -------- |
| `routers/` directory in package | Yes | Yes |
| Modular routers: products, sales, analytics | Yes | Yes |
| Routers wired into `main.py` | Yes (include_router) | Yes |
| Product CRUD (raw SQL, JSON) | 5 endpoints | Yes |
| POST /sales checkout → INSERT sales + sales_items | Yes | Yes |
| Triggers fire on checkout | Yes (stock/audit/status) | Yes |
| Transaction commit + 200 JSON response | Yes | Yes |
| Analytics `SELECT *` on 3 views | 3 endpoints | Yes |
| Pydantic models for request/response | schemas.py | Yes (422 tests) |
| `get_connection()` + `with` blocks | Every endpoint | Yes |
| No ORM | Confirmed | — |

---

## 9. Notes & open items

- **No authentication yet** — all endpoints are open; `audit_logs.user_id`
  stays NULL until Phase with auth.
- **`sales.total_amount` is server-computed** from current product prices.
  Since price is snapshotted into `sales_items.unit_price`, later price
  changes do not corrupt historical totals.
- **Refund/edit flows not implemented** — no `DELETE /sales` or
  sales_items UPDATE handling (would need inverse stock triggers).
- **Connection-per-request** remains (educational simplicity); pooling is a
  candidate when real traffic appears.
- **No automated tests yet** — verification was manual curl-based; pytest
  with TestClient is recommended in a later phase.
- Changes for this phase are **not yet committed or pushed**.