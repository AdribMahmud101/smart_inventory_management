"""Analytics endpoints (Admin Dashboard).

Each endpoint simply selects from one of the Phase 1 views and returns
the rows as JSON. All aggregation logic lives in the database views —
the router stays a thin SELECT * bridge.
"""

from fastapi import APIRouter, Depends
from psycopg.rows import dict_row

from ..database import get_connection
from ..schemas import LowStockProduct, MonthlyProfit, TopSellingProduct
from ..security import require_admin

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(require_admin)],
)


@router.get("/top-selling-products", response_model=list[TopSellingProduct])
def top_selling_products():
    """Product ranking by total units sold."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM top_selling_products_view")
        return cur.fetchall()


@router.get("/monthly-profit", response_model=list[MonthlyProfit])
def monthly_profit():
    """Per-month sales, expenses, and profit overview."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM monthly_profit_view")
        return cur.fetchall()


@router.get("/low-stock-products", response_model=list[LowStockProduct])
def low_stock_products():
    """Products with a stock count below 5 units."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM low_stock_products_view")
        return cur.fetchall()
