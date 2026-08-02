"""Sales / POS endpoints.

POST /sales performs the checkout inside ONE transaction:
  1. resolves each product's price (and validates stock),
  2. inserts the sales header,
  3. inserts the sales_items lines.

Inserting into sales_items automatically fires the Phase 1 triggers
(update_stock_after_sale reduces stock + writes audit logs, and the
low_stock_alert keeps product status in sync).

If ANY step fails, the whole transaction is rolled back — the `with`
block on the connection guarantees commit-on-success, rollback-on-error,
and always closes the connection.
"""

from decimal import Decimal

from fastapi import APIRouter, HTTPException
from psycopg.rows import dict_row

from ..database import get_connection
from ..schemas import CheckoutRequest, CheckoutResponse, SaleItemOut

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=CheckoutResponse)
def checkout(payload: CheckoutRequest):
    """Process a POS checkout from a cart payload."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        # ---- 1) Resolve prices & validate stock for every cart line ----
        sold_items: list[SaleItemOut] = []
        total = Decimal("0")

        for item in payload.items:
            cur.execute(
                "SELECT unit_price, quantity_in_stock FROM products WHERE id = %s",
                (item.product_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise HTTPException(
                    status_code=404, detail=f"Product {item.product_id} not found"
                )
            if row["quantity_in_stock"] < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for product {item.product_id}",
                )

            subtotal = row["unit_price"] * item.quantity
            total += subtotal
            sold_items.append(
                SaleItemOut(
                    product_id=item.product_id,
                    quantity=item.quantity,
                    unit_price=row["unit_price"],
                    subtotal=subtotal,
                )
            )

        # ---- 2) Insert the sales header (FKs validate customer/employee) ----
        cur.execute(
            """
            INSERT INTO sales (customer_id, employee_id, total_amount, payment_method)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (payload.customer_id, payload.employee_id, total, payload.payment_method),
        )
        sale_id = cur.fetchone()["id"]

        # ---- 3) Insert the line items (fires the Phase 1 triggers) ----
        for sold in sold_items:
            cur.execute(
                """
                INSERT INTO sales_items (sale_id, product_id, quantity, unit_price, subtotal)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (sale_id, sold.product_id, sold.quantity, sold.unit_price, sold.subtotal),
            )

    # `with` block exited normally -> transaction committed, conn closed.
    return CheckoutResponse(sale_id=sale_id, total_amount=total, items=sold_items)
