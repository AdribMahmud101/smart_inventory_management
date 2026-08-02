"""Security helpers: password hashing, token handling, auth dependencies.

Design choices (educational, dependency-free):
  * Passwords are hashed with PBKDF2-HMAC-SHA256 from the standard library
    (no external crypto packages). A random per-user salt is stored with
    the digest as "salt_hex$hash_hex".
  * Login issues an opaque random bearer token. Only its SHA-256 hash is
    stored in the api_tokens table, so a database leak does not expose
    usable tokens; tokens also expire after TOKEN_TTL_DAYS.
  * get_current_user / require_admin are FastAPI dependencies that the
    routers use to protect endpoints.
"""

import hashlib
import os
import secrets
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg.rows import dict_row

from .database import get_connection

PBKDF2_ITERATIONS = 340_000
TOKEN_TTL_DAYS = 7

# Reads the "Authorization: Bearer <token>" header (auto_error=False so we
# can return our own 401 instead of FastAPI's default).
_bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Return a salted PBKDF2 hash string: 'salt_hex$hash_hex'."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Compare a plaintext password against a stored hash string."""
    try:
        salt_hex, expected_hex = stored.split("$", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    # compare_digest avoids timing side-channels when comparing hashes.
    return secrets.compare_digest(digest.hex(), expected_hex)


# ---------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------

def _hash_token(raw_token: str) -> str:
    """SHA-256 hex digest used as the stored form of a token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_token(user_id: int) -> str:
    """Create an opaque token, store its hash in api_tokens, return the
    raw token to the client (it is only shown once — at issue time)."""
    raw_token = secrets.token_urlsafe(48)
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO api_tokens (user_id, token_hash, expires_at)
            VALUES (%s, %s, NOW() + make_interval(days => %s))
            """,
            (user_id, _hash_token(raw_token), TOKEN_TTL_DAYS),
        )
    return raw_token


def revoke_token(raw_token: str) -> None:
    """Remove a token row (logout)."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "DELETE FROM api_tokens WHERE token_hash = %s", (_hash_token(raw_token),)
        )


# ---------------------------------------------------------------------
# FastAPI dependencies (for endpoint protection)
# ---------------------------------------------------------------------

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """Resolve the Authorization header to a valid user row, or raise 401."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    with get_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT u.id, u.username, u.email, u.role, u.is_active
            FROM api_tokens AS t
            JOIN users AS u ON u.id = t.user_id
            WHERE t.token_hash = %s AND t.expires_at > NOW()
            """,
            (_hash_token(credentials.credentials),),
        )
        user = cur.fetchone()

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account is disabled")

    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Role gate: only allow users with the 'admin' role."""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user