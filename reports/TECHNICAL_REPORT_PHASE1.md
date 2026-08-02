# Technical Report — Phase 1: Database Logic & Relationships

**Project:** Smart Inventory and Business Management System
**Report date:** 2026-08-02
**Scope:** Phase 1 — foreign keys, triggers, analytical views
**Files changed:** `backend/src/inventory_management_system/schema.sql`, `backend/README.md`

---

## 1. Executive Summary

Phase 0 delivered the structural foundation (8 placeholder tables, no
relationships). Phase 1 turns that structure into a functional data layer:
the placeholder tables are now connected with **foreign key constraints**, a
fully **automated inventory pipeline** runs at the database level through
**triggers**, and three **analytical views** expose dashboard-ready
aggregations.

Everything continues to be **raw SQL only — no ORM**. The entire Phase 1
implementation is SQL inside `schema.sql`, executed unchanged through the
existing `init_db()` helper in `database.py` — no Python code changes were
required. The schema is **idempotent** (safe to re-run), and every feature was
verified against a live PostgreSQL 18.4 instance with a full end-to-end
simulation (product → customer → employee → sale → sale items → expense →
aggregations).

---

## 2. Changes to `schema.sql`

The file grew from 98 to 347 lines and is reorganized into four clearly
labeled sections:

1. Core tables (8)
2. Entity relationships (foreign keys)
3. Database triggers (automated inventory management)
4. Analytical views (admin dashboard)

### 2.1 Structural additions to tables

- `products` gained a `status` column — `VARCHAR(20) NOT NULL DEFAULT
  'In Stock'` — added via `ALTER TABLE products ADD COLUMN IF NOT EXISTS
  status ...` so that databases created in Phase 0 are upgraded in place
  on the first Phase 1 run.

---

## 3. Entity Relationships (Foreign Keys)

Seven `FOREIGN KEY` constraints were added, implementing the three requested
relationship types. Each is created inside a `DO $$ ... $$` block that first
checks `pg_constraint` — **PostgreSQL does not support
`ADD CONSTRAINT IF NOT EXISTS`**, so this guard is what makes the script
idempotent for constraints.

| Relationship | Constraint | Direction |
| ------------ | ---------- | --------- |
| customers → sales | `fk_sales_customer` | One-to-Many (one customer has many sales) |
| employees → sales | `fk_sales_employee` | One-to-Many (one employee processes many sales) |
| employees → expenses | `fk_expenses_paid_by` | One-to-Many (one employee records many expenses) |
| sales ↔ products | `fk_sales_items_sale`, `fk_sales_items_product` | Many-to-Many via the `sales_items` junction table |
| users → employees | `fk_employees_user` | One-to-One (each employee is backed by a user account) |
| users → audit_logs | `fk_audit_logs_user` | One-to-Many (one user produces many log entries) |

The last two were declared as planned links in Phase 0 comments and are now
formalized.

**Design decision:** `ON DELETE` is left at the default (`NO ACTION`). No
cascade deletes at this stage, to protect data integrity during development.

---

## 4. Database Triggers

### 4.1 `update_stock_after_sale`

```sql
CREATE OR REPLACE FUNCTION update_stock_after_sale() RETURNS TRIGGER ...
DROP TRIGGER IF EXISTS trg_update_stock_after_sale ON sales_items;
CREATE TRIGGER trg_update_stock_after_sale
AFTER INSERT ON sales_items
FOR EACH ROW EXECUTE FUNCTION update_stock_after_sale();
```

Behavior, per inserted line item:

1. **Stock reduction** — `UPDATE products SET quantity_in_stock =
   quantity_in_stock - NEW.quantity WHERE id = NEW.product_id;`
2. **Audit trail** — inserts a row into `audit_logs`:
   `action = 'stock_decrease'`, `entity_type = 'product'`,
   `entity_id = product_id`, with a human-readable `details` string.
   `user_id` is `NULL` for now (no authentication yet).

**Important design note:** the trigger fires on `sales_items` INSERT, not on
`sales` INSERT. A `sales` row alone contains no product information — the
products sold only become known at the line-item level, and a sale is always
written together with its items.

### 4.2 `low_stock_alert`

```sql
CREATE OR REPLACE FUNCTION set_low_stock_status() RETURNS TRIGGER ...
DROP TRIGGER IF EXISTS trg_low_stock_alert ON products;
CREATE TRIGGER trg_low_stock_alert
BEFORE INSERT OR UPDATE OF quantity_in_stock ON products
FOR EACH ROW EXECUTE FUNCTION set_low_stock_status();
```

Behavior:

- `quantity_in_stock < 5` → `NEW.status := 'Low Stock'`
- otherwise → `NEW.status := 'In Stock'`

**Trigger chaining is automatic:** when `update_stock_after_sale` performs its
`UPDATE products SET quantity_in_stock ...`, the `low_stock_alert` trigger
fires on that same update and keeps the status in sync — one sale event
drives both stock reduction and status change with zero application code.

---

## 5. Analytical Views

### 5.1 `top_selling_products_view`

- `SUM(si.quantity)` aggregated with `GROUP BY p.name`, joined
  `sales_items → products`, ordered by total sold descending.
- **Purpose:** product ranking for the dashboard.

### 5.2 `monthly_profit_view`

- Two CTEs (`monthly_sales`, `monthly_expenses`) aggregate
  `DATE_TRUNC('month', ...)` per month.
- Joined with `FULL OUTER JOIN` so a month with **only** sales or **only**
  expenses still appears in the report.
- Output columns: `month`, `total_sales`, `total_expenses`, `profit`
  (`sales − expenses`), with `COALESCE(..., 0)` filling gaps.

### 5.3 `low_stock_products_view`

- Filters `WHERE quantity_in_stock < 5`, displays `product_name`,
  `current_stock`, and `stock_status`, ordered by stock ascending.
- **Purpose:** quick "what needs restocking" list.

---

## 6. Verification (live PostgreSQL 18.4)

Testing was performed against a scratch database (`inventory_test`), which
was dropped afterwards. PostgreSQL 18.4 was running locally; credentials
matched the `database.py` defaults (`postgres`/`postgres`).

### 6.1 Idempotency

```
First run:  OK
Second run (idempotency): OK   → double execution is safe
```

### 6.2 End-to-end simulation

Seed data: 2 products (Mouse 10 units, USB Cable 2 units), 1 customer,
1 employee, 1 sale of 2 items, 1 expense.

**Stock after sale (trigger fired):**

```
Wireless Mouse → 8 units, 'In Stock'   (was 10, sold 2)
USB Cable      → 1 unit,  'Low Stock'  (was 2, sold 1)
```

**Audit log rows (2):**

```
('stock_decrease', 'product', 1, 'Stock reduced by 2 (sale item #1)')
('stock_decrease', 'product', 2, 'Stock reduced by 1 (sale item #2)')
```

**Views:**

```
top_selling_products_view:  [('Wireless Mouse', 2), ('USB Cable', 1)]
low_stock_products_view:    [('USB Cable', 1, 'Low Stock')]
monthly_profit_view:        [(2026-08-01, 58.00, 1000.00, -942.00)]
```

The monthly view correctly computed `58.00 − 1000.00 = −942.00` profit.

**Foreign keys (7 confirmed present):**

```
fk_audit_logs_user, fk_employees_user, fk_expenses_paid_by,
fk_sales_customer, fk_sales_employee, fk_sales_items_product,
fk_sales_items_sale
```

All three trigger behaviors, all three views, and all seven constraints
produced correct results. The `low_stock_alert` trigger also confirmed
chained execution: it fired from within the stock update performed by
`update_stock_after_sale`.

---

## 7. Deliverables summary

| Requirement | Delivered | Verified |
| ----------- | --------- | -------- |
| customers → sales FK | `fk_sales_customer` | Yes |
| employees → sales FK | `fk_sales_employee` | Yes |
| employees → expenses FK | `fk_expenses_paid_by` | Yes |
| sales ↔ products M:N via sales_items | 2 FKs on junction | Yes |
| Stock reduction + audit on sale | `update_stock_after_sale` trigger | Yes |
| Low-stock status below 5 units | `low_stock_alert` trigger | Yes |
| `top_selling_products_view` (SUM/GROUP BY) | Yes | Yes |
| `monthly_profit_view` (sales, expense, profit) | Yes | Yes |
| `low_stock_products_view` (stock < 5) | Yes | Yes |
| Idempotent, re-runnable script | Yes (double-run tested) | Yes |

---

## 8. Notes & open items

- **Negative stock is not yet prevented.** A sale of more units than in
  stock currently drives `quantity_in_stock` below zero. A future phase
  should add a `CHECK (quantity_in_stock >= 0)` constraint or a stock-check
  in the trigger.
- `update_stock_after_sale` only handles INSERT. UPDATE/DELETE of
  `sales_items` (edits, refunds) do not yet restore/adjust stock — candidates
  for a later phase.
- `sales.total_amount` is still application-managed; it could instead be
  computed by a trigger over its items.
- **Migration strategy still missing**: `CREATE OR REPLACE`/`IF NOT EXISTS`
  handles re-runs, but versioned migrations (e.g., numbered scripts) are
  recommended once the schema evolves further.
- No commits for this phase have been pushed yet (last push was the Phase 0
  initial commit).