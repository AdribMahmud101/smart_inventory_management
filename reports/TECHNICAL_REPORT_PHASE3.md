# Technical Report — Phase 3: Authentication & Roles

**Project:** Smart Inventory and Business Management System
**Report date:** 2026-08-02
**Scope:** Phase 3 — register/login/logout, token auth, role-based access
**Files created:** `security.py`, `routers/auth.py`
**Files updated:** `schema.sql`, `schemas.py`, `main.py`, `routers/{products,sales,analytics}.py`, `README.md`

---

## 1. Executive Summary

Phases 1–2 built the database layer and the raw-SQL API bridge, but every
endpoint was open. Phase 3 secures the backend by adding **user accounts,
password hashing, bearer-token authentication, and role-based access
control**. It remains strictly raw SQL with psycopg and introduces **no
external dependencies** — password hashing uses the standard library
(PBKDF2-HMAC-SHA256), and tokens are opaque random strings whose hashes
live in a new `api_tokens` table.

The `/analytics` dashboards are now **admin-only**, product/sales endpoints
require a valid login, and `audit_logs.user_id` gains a clear future owner.
Everything was verified live against PostgreSQL 18.4.

---

## 2. Architecture

```
Client                                Server (FastAPI)
────────                              ────────────────
POST /auth/register   ──►  hash_password() (PBKDF2) ──► INSERT INTO users
POST /auth/login      ──►  verify_password()          ──► SELECT user, issue token
POST /auth/logout     ──►  revoke token               ──► DELETE FROM api_tokens
GET  /auth/me         ──►  get_current_user           ──► token → user join
GET  /products...     ──►  Authorization: Bearer <tok>
GET  /analytics/*     ──►  require_admin (role gate)  ──► 403 unless 'admin'
```

### New/changed files

```
src/inventory_management_system/
├── security.py            # NEW: hashing, token lifecycle, auth dependencies
├── routers/auth.py        # NEW: register / login / logout / me
├── schemas.py             # + RegisterRequest, LoginRequest, TokenResponse, UserOut
├── schema.sql             # + api_tokens table and FK (2.7)
└── main.py                # + include auth router
```

---

## 3. Schema: `api_tokens` Table

```sql
CREATE TABLE IF NOT EXISTS api_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL,
    token_hash VARCHAR(64)  NOT NULL UNIQUE,   -- SHA-256 hex digest, never raw
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

- Added idempotently: `CREATE TABLE IF NOT EXISTS` + guarded `DO $$` block
  for `fk_api_tokens_user` (users → api_tokens, One-to-Many) — the 8th FK.
- **Only the SHA-256 hash of a token is persisted.** A database leak yields
  unusable 64-char digests instead of live credentials.
- Every token carries an expiry (`expires_at > NOW()` enforced at lookup).

---

## 4. Password Hashing (`security.py`)

- Algorithm: **PBKDF2-HMAC-SHA256**, 340,000 iterations, 16-byte random salt
  per user, from the standard library (`hashlib`, `os`, `secrets`) — no
  external crypto packages.
- Stored format: `"salt_hex$hash_hex"` in `users.password_hash`.
- Verification uses `secrets.compare_digest` to avoid timing side-channels.
- Default user role in the `users` table remains `'staff'`; admin is granted
  explicitly at registration.

---

## 5. API Endpoints (`routers/auth.py`)

| Method & path | Behavior |
| ------------- | -------- |
| `POST /auth/register` | Validates payload, hashes password, `INSERT INTO users ... RETURNING ...`. Returns 201 + user. 409 on duplicate username/email (caught `UniqueViolation`). |
| `POST /auth/login` | `SELECT id, password_hash, is_active, role FROM users WHERE username = %s`; 401 on bad credentials or unknown user (same error, no user enumeration); issues token via `create_token()`. |
| `POST /auth/logout` | Deletes the bearer token's hash (revocation); 401 if no valid token. |
| `GET /auth/me` | Returns the current authenticated user (requires bearer token). |

**Token lifecycle** in `security.py`:
1. `create_token(user_id)` — generates `secrets.token_urlsafe(48)`, stores its
   SHA-256 hash with expiry (+7 days), returns the raw token (shown once).
2. `revoke_token(raw)` — `DELETE FROM api_tokens WHERE token_hash = %s`.
3. `get_current_user` dependency — parses `Authorization: Bearer` via FastAPI
   `HTTPBearer`, hashes, joins `api_tokens` + `users`, checks
   `expires_at > NOW()` and `is_active`; 401/403 otherwise.
4. `require_admin` — wraps `get_current_user`, raises 403 unless `role ==
   'admin'`.

---

## 6. Protecting the Business Routers

Routers now carry router-level dependencies:

```python
products  → APIRouter(..., dependencies=[Depends(get_current_user)])
sales     → APIRouter(..., dependencies=[Depends(get_current_user)])
analytics → APIRouter(..., dependencies=[Depends(require_admin)])
```

- All `products` and `sales` operations require a valid token.
- All three `/analytics/*` views require the **admin** role.
- `/docs` honors the "Authorize" button via the `HTTPBearer` scheme.

---

## 7. Verification (live PostgreSQL 18.4)

Test DB: scratch `inventory_test` (dropped after); schema applied via
`init_db()`. **One bug was found and fixed during testing** — the `login`
query initially omitted the `role` column from its `SELECT`, causing a
`KeyError: 'role'`; the column was added to the projection.

### 7.1 Auth happy paths

| Request | Result |
| ------- | ------ |
| `POST /auth/register` (admin01, role=admin) | 201 `{"id":1,...,"role":"admin"}` |
| `POST /auth/register` (cashier, role=staff) | 201 |
| `POST /auth/login` (valid) | `{"access_token": "<48-char>", "token_type":"bearer", ...}` |
| `GET /auth/me` (with bearer) | `{"id":1,...,"role":"admin","is_active":true}` |

### 7.2 Auth negative paths

| Request | Result |
| ------- | ------ |
| Register duplicate username | 409 "Username or email already in use" |
| Login wrong password | 401 "Invalid credentials" |
| `/auth/me` without token | 401 |
| `/logout` then reuse of that token | 401 "Invalid or expired token" |

### 7.3 Role-based access control

| Request | Role | Result |
| ------- | ---- | ------ |
| `GET /analytics/low-stock-products` | admin | 200 `[]` |
| `GET /analytics/low-stock-products` | staff | 403 "Admin privileges required" |
| `GET /products` | staff | 200 |
| `POST /sales` (checkout) | staff | 200 → sale created, total 60.00 |
| `GET /products` | none | 401 "Not authenticated" |

### 7.4 Storage safety

Confirmed via direct DB query — stored token hashes are 64-character
`VARCHAR` hex digests, with `expires_at > NOW()` valid, and the logged-out
token no longer appears in `api_tokens`.

---

## 8. Deliverables summary

| Requirement | Delivered | Verified |
| ----------- | --------- | -------- |
| Register / login / logout / me endpoints | Yes | Yes |
| Non-plaintext password storage (PBKDF2) | Yes | Yes |
| Opaque bearer tokens (hash-only in DB, expiry) | Yes | Yes |
| Token revocation on logout | Yes | Yes |
| Protect products/sales (any authenticated user) | Yes | 401 / 200 checks |
| Protect analytics (admin only) | Yes | 403 on staff |
| Pydantic auth schemas + docs | Yes | Yes |
| Raw SQL only, no new dependencies | Yes | Yes |

---

## 9. Notes & open items

- **Stock triggers still record `audit_logs.user_id` as NULL** — the database
  trigger cannot see the HTTP-level user. Wiring the authenticated user into
  audit entries (e.g., a `created_by` column on `sales`) is a future phase.
- **Token-based (stateless-ish) sessions** — no refresh tokens or JWT; expiry
  is fixed at 7 days. Fine for this educational stage.
- **Roles are a simple `users.role` enum** — no granular permissions matrix
  yet.
- **Password policy** minimal (`min_length=8`) — no complexity rules yet.
- Changes for this phase are **not yet committed or pushed**.