"""Pydantic schemas — request/response validation only.

These models validate data entering and leaving the API (and power the
interactive /docs documentation). They NEVER touch the database; all
database access remains raw SQL inside the routers.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


# =====================================================================
# Authentication
# =====================================================================

class RegisterRequest(BaseModel):
    """Payload for POST /auth/register."""

    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, description="Minimum 8 characters")
    role: Literal["staff", "admin"] = "staff"


class LoginRequest(BaseModel):
    """Payload for POST /auth/login."""

    username: str
    password: str


class TokenResponse(BaseModel):
    """Response for a successful login."""

    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: str


class UserOut(BaseModel):
    """Authenticated user info returned by GET /auth/me."""

    id: int
    username: str
    email: str
    role: str
    is_active: bool


# =====================================================================
# Products
# =====================================================================

class ProductBase(BaseModel):
    """Fields shared by create and update requests."""

    name: str = Field(min_length=1, description="Product display name")
    sku: str | None = Field(default=None, description="Stock keeping unit (unique)")
    category: str | None = None
    unit_price: Decimal = Field(ge=0, default=Decimal("0"))
    cost_price: Decimal = Field(ge=0, default=Decimal("0"))
    quantity_in_stock: int = Field(ge=0, default=0)
    reorder_level: int = Field(ge=0, default=0)


class ProductCreate(ProductBase):
    """Payload for POST /products."""


class ProductUpdate(ProductBase):
    """Payload for PUT /products/{id} — full update of all fields."""


class ProductOut(ProductBase):
    """Response shape for a product row."""

    id: int
    status: str                       # maintained by the low_stock_alert trigger
    created_at: datetime


# =====================================================================
# Sales / POS
# =====================================================================

class CartItem(BaseModel):
    """One line of the cart: a product and how many units to sell."""

    product_id: int
    quantity: int = Field(ge=1, description="Must be at least 1")


class CheckoutRequest(BaseModel):
    """Payload for POST /sales — the full cart being checked out."""

    customer_id: int | None = None
    employee_id: int | None = None
    payment_method: str = Field(default="cash", description="e.g. cash, card")
    items: list[CartItem] = Field(min_length=1, description="Cart lines")


class SaleItemOut(BaseModel):
    """One sold line item, echoed back in the response."""

    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class CheckoutResponse(BaseModel):
    """Response for a completed checkout."""

    sale_id: int
    total_amount: Decimal
    items: list[SaleItemOut]


# =====================================================================
# Analytics (views from schema.sql)
# =====================================================================

class TopSellingProduct(BaseModel):
    """Row from top_selling_products_view."""

    product_name: str
    total_sold: int


class MonthlyProfit(BaseModel):
    """Row from monthly_profit_view."""

    month: date
    total_sales: Decimal
    total_expenses: Decimal
    profit: Decimal


class LowStockProduct(BaseModel):
    """Row from low_stock_products_view."""

    product_name: str
    current_stock: int
    stock_status: str


# =====================================================================
# Customers
# =====================================================================

class CustomerBase(BaseModel):
    """Fields shared by customer create and update requests."""

    full_name: str = Field(min_length=1, description="Customer display name")
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    loyalty_points: int = Field(ge=0, default=0)


class CustomerCreate(CustomerBase):
    """Payload for POST /customers."""


class CustomerUpdate(CustomerBase):
    """Payload for PUT /customers/{id} — full update of all fields."""


class CustomerOut(CustomerBase):
    """Response shape for a customer row."""

    id: int
    created_at: datetime


# =====================================================================
# Employees
# =====================================================================

class EmployeeBase(BaseModel):
    """Fields shared by employee create and update requests."""

    full_name: str = Field(min_length=1, description="Employee display name")
    position: str | None = None
    hire_date: date | None = None
    phone: str | None = None
    salary: Decimal = Field(ge=0, default=Decimal("0"))


class EmployeeCreate(EmployeeBase):
    """Payload for POST /employees."""


class EmployeeUpdate(EmployeeBase):
    """Payload for PUT /employees/{id} — full update of all fields."""


class EmployeeOut(EmployeeBase):
    """Response shape for an employee row."""

    id: int
    created_at: datetime


# =====================================================================
# Expenses
# =====================================================================

class ExpenseBase(BaseModel):
    """Fields shared by expense create and update requests."""

    category: str = Field(min_length=1, description="e.g. rent, utilities")
    description: str | None = None
    amount: Decimal = Field(ge=0, default=Decimal("0"))
    expense_date: date | None = None
    paid_by: int | None = None                  # FK -> employees.id


class ExpenseCreate(ExpenseBase):
    """Payload for POST /expenses."""


class ExpenseUpdate(ExpenseBase):
    """Payload for PUT /expenses/{id} — full update of all fields."""


class ExpenseOut(ExpenseBase):
    """Response shape for an expense row."""

    id: int
    created_at: datetime


# =====================================================================
# Sales history
# =====================================================================

class SaleListItem(BaseModel):
    """One row of the sales history list (with names joined in)."""

    id: int
    sale_date: datetime
    total_amount: Decimal
    payment_method: str
    status: str
    customer_name: str | None = None
    employee_name: str | None = None


# =====================================================================
# Audit log
# =====================================================================

class AuditLogOut(BaseModel):
    """One audit trail entry (username joined in from users)."""

    id: int
    username: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: int | None = None
    details: str | None = None
    created_at: datetime
