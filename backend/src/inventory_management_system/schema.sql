-- =====================================================================
-- Master Database Schema (Phase 1)
-- Smart Inventory and Business Management System
--
-- Contents:
--   1. Core tables (8) with primary keys and basic columns
--   2. Entity relationships (foreign key constraints)
--   3. Database triggers (automated inventory management)
--   4. Analytical views (admin dashboard aggregations)
--
-- The whole script is IDEMPOTENT: safe to re-run any time.
--   * CREATE TABLE IF NOT EXISTS  -> tables are only created once
--   * guarded ADD CONSTRAINT      -> FKs are only added once
--   * CREATE OR REPLACE FUNCTION  -> functions can be redefined
--   * DROP TRIGGER IF EXISTS      -> triggers are recreated cleanly
--   * CREATE OR REPLACE VIEW      -> views can be redefined
-- =====================================================================


-- =====================================================================
-- 1. CORE TABLES
-- =====================================================================

-- Users: system accounts used to log in to the application.
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(50)   NOT NULL UNIQUE,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(20)   NOT NULL DEFAULT 'staff',
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- API Tokens: bearer tokens issued at login (used for authentication).
-- Only the SHA-256 hash of each token is stored, never the raw token.
CREATE TABLE IF NOT EXISTS api_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL,              -- FK -> users.id (section 2)
    token_hash VARCHAR(64)  NOT NULL UNIQUE,       -- sha256 hex of the raw token
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Employees: staff members (e.g., shop workers) tied to user accounts.
CREATE TABLE IF NOT EXISTS employees (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT,                        -- FK -> users.id (added in section 2)
    full_name  VARCHAR(100) NOT NULL,
    position   VARCHAR(50),
    hire_date  DATE,
    phone      VARCHAR(20),
    salary     NUMERIC(10, 2),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Customers: people who buy from us.
CREATE TABLE IF NOT EXISTS customers (
    id             BIGSERIAL PRIMARY KEY,
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(255),
    phone          VARCHAR(20),
    address        TEXT,
    loyalty_points INTEGER       NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Products: items we stock and sell.
-- NOTE: the `status` column is added below with ADD COLUMN IF NOT EXISTS
-- so pre-existing Phase 0 tables get upgraded on re-run.
CREATE TABLE IF NOT EXISTS products (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(150)   NOT NULL,
    sku                VARCHAR(50)    UNIQUE,
    category           VARCHAR(50),
    unit_price         NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cost_price         NUMERIC(10, 2) NOT NULL DEFAULT 0,
    quantity_in_stock  INTEGER        NOT NULL DEFAULT 0,
    reorder_level      INTEGER        NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Add the status column if it does not exist yet (idempotent upgrade).
-- Used by the low_stock_alert trigger in section 3.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'In Stock';

-- Sales: one row per sale transaction (the "header").
CREATE TABLE IF NOT EXISTS sales (
    id             BIGSERIAL PRIMARY KEY,
    customer_id    BIGINT,                        -- FK -> customers.id (section 2)
    employee_id    BIGINT,                        -- FK -> employees.id (section 2)
    sale_date      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    total_amount   NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(20)   NOT NULL DEFAULT 'cash',
    status         VARCHAR(20)   NOT NULL DEFAULT 'completed'
);

-- Sales Items: individual product lines inside a sale (the "detail").
-- Junction table implementing the Many-to-Many relationship between
-- sales and products.
CREATE TABLE IF NOT EXISTS sales_items (
    id         BIGSERIAL PRIMARY KEY,
    sale_id    BIGINT NOT NULL,                  -- FK -> sales.id (section 2)
    product_id BIGINT NOT NULL,                  -- FK -> products.id (section 2)
    quantity   INTEGER      NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    subtotal   NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- Expenses: money spent on running the business (rent, utilities, etc.).
CREATE TABLE IF NOT EXISTS expenses (
    id           BIGSERIAL PRIMARY KEY,
    category     VARCHAR(50)   NOT NULL,
    description  TEXT,
    amount       NUMERIC(10, 2) NOT NULL DEFAULT 0,
    expense_date DATE,
    paid_by      BIGINT,                         -- FK -> employees.id (section 2)
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Audit Logs: record of important actions for accountability.
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT,                          -- FK -> users.id (section 2)
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),                     -- e.g. 'product', 'sale'
    entity_id   BIGINT,                          -- id of the affected row
    details     TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- =====================================================================
-- 2. ENTITY RELATIONSHIPS (FOREIGN KEYS)
-- =====================================================================
--
-- Each constraint is added inside a DO block that first checks
-- pg_constraint, because PostgreSQL does not support
-- "ADD CONSTRAINT IF NOT EXISTS". This keeps the script idempotent:
-- on a fresh database every FK is created; on an old database created
-- in Phase 0 (which had no FKs) they are added on the next run.
--
-- ON DELETE behavior is left as the default (NO ACTION) on purpose:
-- we do not want accidental cascade deletes at this stage.

-- 2.1 customers -> sales  (One-to-Many: one customer has many sales)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_customer') THEN
        ALTER TABLE sales
            ADD CONSTRAINT fk_sales_customer
            FOREIGN KEY (customer_id) REFERENCES customers (id);
    END IF;
END $$;

-- 2.2 employees -> sales  (One-to-Many: one employee processes many sales)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_employee') THEN
        ALTER TABLE sales
            ADD CONSTRAINT fk_sales_employee
            FOREIGN KEY (employee_id) REFERENCES employees (id);
    END IF;
END $$;

-- 2.3 employees -> expenses  (One-to-Many: one employee records many expenses)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_expenses_paid_by') THEN
        ALTER TABLE expenses
            ADD CONSTRAINT fk_expenses_paid_by
            FOREIGN KEY (paid_by) REFERENCES employees (id);
    END IF;
END $$;

-- 2.4 sales <-> products via sales_items  (Many-to-Many junction)
--     A sale contains many products, and a product appears in many sales.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_items_sale') THEN
        ALTER TABLE sales_items
            ADD CONSTRAINT fk_sales_items_sale
            FOREIGN KEY (sale_id) REFERENCES sales (id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sales_items_product') THEN
        ALTER TABLE sales_items
            ADD CONSTRAINT fk_sales_items_product
            FOREIGN KEY (product_id) REFERENCES products (id);
    END IF;
END $$;

-- 2.5 users -> employees  (One-to-One: each employee is backed by a user account)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_employees_user') THEN
        ALTER TABLE employees
            ADD CONSTRAINT fk_employees_user
            FOREIGN KEY (user_id) REFERENCES users (id);
    END IF;
END $$;

-- 2.6 users -> audit_logs  (One-to-Many: one user produces many log entries)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_user') THEN
        ALTER TABLE audit_logs
            ADD CONSTRAINT fk_audit_logs_user
            FOREIGN KEY (user_id) REFERENCES users (id);
    END IF;
END $$;

-- 2.7 users -> api_tokens  (One-to-Many: one user may hold many tokens)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_api_tokens_user') THEN
        ALTER TABLE api_tokens
            ADD CONSTRAINT fk_api_tokens_user
            FOREIGN KEY (user_id) REFERENCES users (id);
    END IF;
END $$;


-- =====================================================================
-- 3. DATABASE TRIGGERS (AUTOMATED INVENTORY MANAGEMENT)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3.1 update_stock_after_sale
--
-- Purpose: automatically reduce product stock when a sale is recorded,
-- and write an audit log entry to track the change.
--
-- NOTE: the trigger fires on INSERT into sales_items, not sales,
-- because the products being sold only become known at the line-item
-- level (a sale row has no product info by itself).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_stock_after_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- 1) Reduce the product's stock by the sold quantity.
    UPDATE products
       SET quantity_in_stock = quantity_in_stock - NEW.quantity
     WHERE id = NEW.product_id;

    -- 2) Insert an audit trail record.
    --    user_id is NULL for now (no authentication yet).
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (NULL,
            'stock_decrease',
            'product',
            NEW.product_id,
            'Stock reduced by ' || NEW.quantity ||
            ' (sale item #' || NEW.id || ')');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger cleanly on every run (idempotency).
DROP TRIGGER IF EXISTS trg_update_stock_after_sale ON sales_items;
CREATE TRIGGER trg_update_stock_after_sale
AFTER INSERT ON sales_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_after_sale();

-- ---------------------------------------------------------------------
-- 3.2 low_stock_alert
--
-- Purpose: keep the products.status field in sync with stock levels.
-- Whenever quantity_in_stock is inserted or updated, set the status
-- to 'Low Stock' when the quantity drops below 5, and restore it to
-- 'In Stock' when restocked to 5 or more.
--
-- NOTE: this trigger ALSO fires when update_stock_after_sale modifies
-- quantity_in_stock, so both paths stay consistent automatically.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_low_stock_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity_in_stock < 5 THEN
        NEW.status := 'Low Stock';
    ELSE
        NEW.status := 'In Stock';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_low_stock_alert ON products;
CREATE TRIGGER trg_low_stock_alert
BEFORE INSERT OR UPDATE OF quantity_in_stock ON products
FOR EACH ROW
EXECUTE FUNCTION set_low_stock_status();


-- =====================================================================
-- 4. ANALYTICAL VIEWS (ADMIN DASHBOARD)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4.1 top_selling_products_view
--
-- Purpose: product ranking by total units sold, for the dashboard.
-- Uses SUM() + GROUP BY to aggregate across all sale line items.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW top_selling_products_view AS
SELECT
    p.name        AS product_name,
    SUM(si.quantity) AS total_sold
FROM sales_items AS si
JOIN products AS p ON p.id = si.product_id
GROUP BY p.name
ORDER BY total_sold DESC;

-- ---------------------------------------------------------------------
-- 4.2 monthly_profit_view
--
-- Purpose: consolidated financial overview per month:
--   total sales, total expenses, and the resulting profit.
--
-- Months are taken from BOTH tables (FULL OUTER JOIN) so that a month
-- with only expenses (or only sales) still appears in the report.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW monthly_profit_view AS
WITH monthly_sales AS (
    SELECT
        DATE_TRUNC('month', sale_date)::date AS month,
        SUM(total_amount)                    AS total_sales
    FROM sales
    GROUP BY 1
),
monthly_expenses AS (
    SELECT
        DATE_TRUNC('month', expense_date)::date AS month,
        SUM(amount)                             AS total_expenses
    FROM expenses
    GROUP BY 1
)
SELECT
    COALESCE(s.month, e.month)                        AS month,
    COALESCE(s.total_sales, 0)                        AS total_sales,
    COALESCE(e.total_expenses, 0)                     AS total_expenses,
    COALESCE(s.total_sales, 0) - COALESCE(e.total_expenses, 0) AS profit
FROM monthly_sales AS s
FULL OUTER JOIN monthly_expenses AS e ON s.month = e.month
ORDER BY month DESC;

-- ---------------------------------------------------------------------
-- 4.3 low_stock_products_view
--
-- Purpose: quick list of products running out of stock.
-- Filters rows where quantity_in_stock is below the 5-unit threshold.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW low_stock_products_view AS
SELECT
    p.name              AS product_name,
    p.quantity_in_stock AS current_stock,
    p.status            AS stock_status
FROM products AS p
WHERE p.quantity_in_stock < 5
ORDER BY p.quantity_in_stock ASC;
