"""Employee management endpoints (CRUD).

Raw SQL only, one connection per request, `with` block for safety.
"""

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row

from ..database import get_connection
from ..schemas import EmployeeCreate, EmployeeOut, EmployeeUpdate
from ..security import get_current_user

router = APIRouter(
    prefix="/employees",
    tags=["employees"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[EmployeeOut])
def list_employees():
    """Return every employee, ordered by id."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM employees ORDER BY id")
        return cur.fetchall()


@router.post("", response_model=EmployeeOut, status_code=201)
def create_employee(payload: EmployeeCreate):
    """Add a new employee (user_id is left NULL — linking to a login
    account is out of scope for this educational project)."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            INSERT INTO employees (full_name, position, hire_date, phone, salary)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                payload.full_name,
                payload.position,
                payload.hire_date,
                payload.phone,
                payload.salary,
            ),
        )
        return cur.fetchone()


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: int, payload: EmployeeUpdate):
    """Full update of an existing employee."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            UPDATE employees
            SET full_name = %s, position = %s, hire_date = %s,
                phone = %s, salary = %s
            WHERE id = %s
            RETURNING *
            """,
            (
                payload.full_name,
                payload.position,
                payload.hire_date,
                payload.phone,
                payload.salary,
                employee_id,
            ),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Employee not found")
        return row


@router.delete("/{employee_id}")
def delete_employee(employee_id: int):
    """Remove an employee."""
    try:
        with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("DELETE FROM employees WHERE id = %s RETURNING id", (employee_id,))
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Employee not found")
    except psycopg.errors.ForeignKeyViolation:
        # An employee attached to sales or expenses cannot be deleted.
        raise HTTPException(
            status_code=409,
            detail="Cannot delete: employee is referenced by sales or expenses",
        )
    return {"message": "Employee deleted", "deleted_id": employee_id}