"""Audit trail endpoints.

The audit_logs table is populated automatically by the Phase 1 trigger
(update_stock_after_sale), so this router is a thin read-only bridge.
"""

from fastapi import APIRouter, Depends
from psycopg.rows import dict_row

from ..database import get_connection
from ..schemas import AuditLogOut
from ..security import get_current_user

router = APIRouter(
    prefix="/audit",
    tags=["audit"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs():
    """The latest audit entries (100 max), newest first."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT a.id, u.username, a.action, a.entity_type,
                   a.entity_id, a.details, a.created_at
            FROM audit_logs AS a
            LEFT JOIN users AS u ON u.id = a.user_id
            ORDER BY a.id DESC
            LIMIT 100
            """
        )
        return cur.fetchall()