"""Expense management endpoints (CRUD).

Expenses feed the monthly_profit_view used by the admin dashboard, so
recording them here directly affects the profit numbers.
"""

from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row

from ..database import get_connection
from ..schemas import ExpenseCreate, ExpenseOut, ExpenseUpdate
from ..security import get_current_user

router = APIRouter(
    prefix="/expenses",
    tags=["expenses"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[ExpenseOut])
def list_expenses():
    """Return every expense, newest first."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM expenses ORDER BY expense_date DESC NULLS LAST, id DESC")
        return cur.fetchall()


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(payload: ExpenseCreate):
    """Record a new business expense."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO expenses (category, description, amount, expense_date, paid_by)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                payload.category,
                payload.description,
                payload.amount,
                payload.expense_date,
                payload.paid_by,
            ),
        )
        return cur.fetchone()


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, payload: ExpenseUpdate):
    """Full update of an existing expense."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE expenses
            SET category = %s, description = %s, amount = %s,
                expense_date = %s, paid_by = %s
            WHERE id = %s
            RETURNING *
            """,
            (
                payload.category,
                payload.description,
                payload.amount,
                payload.expense_date,
                payload.paid_by,
                expense_id,
            ),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Expense not found")
        return row


@router.delete("/{expense_id}")
def delete_expense(expense_id: int):
    """Remove an expense."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("DELETE FROM expenses WHERE id = %s RETURNING id", (expense_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted", "deleted_id": expense_id}