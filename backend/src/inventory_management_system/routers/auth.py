"""Authentication endpoints: register, login, logout, me.

All interactions with the users / api_tokens tables are raw SQL.
Password hashing and token logic live in security.py.
"""

from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row

from ..database import get_connection
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut
from ..security import (
    _bearer_scheme,
    create_token,
    get_current_user,
    hash_password,
    revoke_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201, response_model=UserOut)
def register(payload: RegisterRequest):
    """Create a new user account."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        try:
            cur.execute(
                """
                INSERT INTO users (username, email, password_hash, role)
                VALUES (%s, %s, %s, %s)
                RETURNING id, username, email, role, is_active
                """,
                (
                    payload.username,
                    payload.email,
                    hash_password(payload.password),
                    payload.role,
                ),
            )
        except UniqueViolation:
            # username or email already exists (both have UNIQUE constraints).
            raise HTTPException(
                status_code=409, detail="Username or email already in use"
            )
        return cur.fetchone()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    """Authenticate against users and return a bearer token."""
    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, password_hash, is_active, role FROM users WHERE username = %s",
            (payload.username,),
        )
        row = cur.fetchone()

    # Same error for unknown user or wrong password (no user enumeration).
    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not row["is_active"]:
        raise HTTPException(status_code=403, detail="Account is disabled")

    raw_token = create_token(row["id"])
    return TokenResponse(
        access_token=raw_token,
        user_id=row["id"],
        username=payload.username,
        role=row["role"],
    )


@router.post("/logout")
def logout(credentials=Depends(_bearer_scheme)):
    """Invalidate the current bearer token."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    revoke_token(credentials.credentials)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's info."""
    return user