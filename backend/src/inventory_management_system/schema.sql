-- =====================================================================
-- Master Database Schema (Placeholders)
-- Smart Inventory and Business Management System
--
-- NOTE: This is a FOUNDATION-ONLY schema. It defines the 8 core tables
-- with their primary keys and basic columns. Complex constraints,
-- foreign keys, views, and triggers will be added in later steps.
-- =====================================================================

-- Users: system accounts used to log in to the application.
CREATE TABLE IF NOT EXISTS users (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'staff',
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Employees: staff members (e.g., shop workers) tied to user accounts.
CREATE TABLE IF NOT EXISTS employees (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT,                    -- links to users (FK added later)
    full_name   VARCHAR(100) NOT NULL,
    position    VARCHAR(50),
    hire_date   DATE,
    phone       VARCHAR(20),
    salary      NUMERIC(10, 2),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Customers: people who buy from us.
CREATE TABLE IF NOT EXISTS customers (
    id          BIGSERIAL PRIMARY KEY,
    full_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(20),
    address     TEXT,
    loyalty_points INTEGER    NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Products: items we stock and sell.
CREATE TABLE IF NOT EXISTS products (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    sku             VARCHAR(50)  UNIQUE,
    category        VARCHAR(50),
    unit_price      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cost_price      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    quantity_in_stock INTEGER    NOT NULL DEFAULT 0,
    reorder_level   INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Sales: one row per sale transaction (the "header").
CREATE TABLE IF NOT EXISTS sales (
    id          BIGSERIAL PRIMARY KEY,
    customer_id BIGINT,                    -- links to customers (FK added later)
    employee_id BIGINT,                    -- who processed the sale (FK later)
    sale_date   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
    status      VARCHAR(20)  NOT NULL DEFAULT 'completed'
);

-- Sales Items: individual product lines inside a sale (the "detail").
CREATE TABLE IF NOT EXISTS sales_items (
    id          BIGSERIAL PRIMARY KEY,
    sale_id     BIGINT NOT NULL,           -- links to sales (FK added later)
    product_id  BIGINT NOT NULL,           -- links to products (FK later)
    quantity    INTEGER      NOT NULL DEFAULT 1,
    unit_price  NUMERIC(10, 2) NOT NULL DEFAULT 0,
    subtotal    NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- Expenses: money spent on running the business (rent, utilities, etc.).
CREATE TABLE IF NOT EXISTS expenses (
    id          BIGSERIAL PRIMARY KEY,
    category    VARCHAR(50)  NOT NULL,
    description TEXT,
    amount      NUMERIC(10, 2) NOT NULL DEFAULT 0,
    expense_date DATE,
    paid_by     BIGINT,                    -- links to employees (FK later)
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Audit Logs: record of important actions for accountability.
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT,                    -- links to users (FK added later)
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),               -- e.g. 'product', 'sale'
    entity_id   BIGINT,                    -- id of the affected row
    details     TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);