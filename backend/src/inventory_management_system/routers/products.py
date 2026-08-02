"""Product management endpoints (CRUD).

Every endpoint opens a fresh connection via get_connection() and runs
raw SQL with psycopg. The `with` block guarantees the connection is
always closed (and the transaction committed/rolled back) — even if an
exception is raised.
"""

import psycopg
from fastapi import APIRouter, HTTPException
from psycopg.rows import dict_row

from ..database import get_connection
from ..schemas import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products():
    """Return every product in the catalog, ordered by id."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM products ORDER BY id")
        return cur.fetchall()


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int):
    """Return a single product by its id."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        return row


@router.post("", response_model=ProductOut, status_code=201)
def create_product(payload: ProductCreate):
    """Add a new product.

    RETURNING * gives us the full inserted row, including `status` and
    `created_at` (the low_stock_alert trigger sets `status` on INSERT).
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO products
                (name, sku, category, unit_price, cost_price,
                 quantity_in_stock, reorder_level)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                payload.name,
                payload.sku,
                payload.category,
                payload.unit_price,
                payload.cost_price,
                payload.quantity_in_stock,
                payload.reorder_level,
            ),
        )
        return cur.fetchone()


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate):
    """Full update of an existing product (all fields are replaced).

    Note: if quantity_in_stock changes, the low_stock_alert trigger
    keeps `status` in sync automatically.
    """
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE products
            SET name = %s, sku = %s, category = %s,
                unit_price = %s, cost_price = %s,
                quantity_in_stock = %s, reorder_level = %s
            WHERE id = %s
            RETURNING *
            """,
            (
                payload.name,
                payload.sku,
                payload.category,
                payload.unit_price,
                payload.cost_price,
                payload.quantity_in_stock,
                payload.reorder_level,
                product_id,
            ),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        return row


@router.delete("/{product_id}")
def delete_product(product_id: int):
    """Remove a product from the catalog."""
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("DELETE FROM products WHERE id = %s RETURNING id", (product_id,))
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Product not found")
    except psycopg.errors.ForeignKeyViolation:
        # A product that appears in sales_items cannot be deleted —
        # the FK constraint (fk_sales_items_product) protects the data.
        raise HTTPException(
            status_code=409,
            detail="Cannot delete: product is referenced by existing sales items",
        )
    return {"message": "Product deleted", "deleted_id": product_id}
