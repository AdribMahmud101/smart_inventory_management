"""Customer management endpoints (CRUD).

Same simple pattern as products.py: raw SQL, a fresh connection per
request, and a `with` block that always commits or rolls back.
"""

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row

from ..database import get_connection
from ..schemas import CustomerCreate, CustomerOut, CustomerUpdate
from ..security import get_current_user

router = APIRouter(
    prefix="/customers",
    tags=["customers"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[CustomerOut])
def list_customers():
    """Return every customer, ordered by id."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM customers ORDER BY id")
        return cur.fetchall()


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate):
    """Add a new customer."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO customers (full_name, email, phone, address, loyalty_points)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                payload.full_name,
                payload.email,
                payload.phone,
                payload.address,
                payload.loyalty_points,
            ),
        )
        return cur.fetchone()


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, payload: CustomerUpdate):
    """Full update of an existing customer."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE customers
            SET full_name = %s, email = %s, phone = %s,
                address = %s, loyalty_points = %s
            WHERE id = %s
            RETURNING *
            """,
            (
                payload.full_name,
                payload.email,
                payload.phone,
                payload.address,
                payload.loyalty_points,
                customer_id,
            ),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Customer not found")
        return row


@router.delete("/{customer_id}")
def delete_customer(customer_id: int):
    """Remove a customer."""
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("DELETE FROM customers WHERE id = %s RETURNING id", (customer_id,))
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Customer not found")
    except psycopg.errors.ForeignKeyViolation:
        # A customer with past sales cannot be deleted (FK protects the data).
        raise HTTPException(
            status_code=409,
            detail="Cannot delete: customer is referenced by existing sales",
        )
    return {"message": "Customer deleted", "deleted_id": customer_id}