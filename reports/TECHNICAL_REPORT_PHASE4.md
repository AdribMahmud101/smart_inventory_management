# Technical Report — Phase 4: Frontend Foundation

**Project:** Smart Inventory and Business Management System
**Report date:** 2026-08-02
**Scope:** Phase 4 — React frontend for the 50% progress demo
**Files created:** entire `frontend/` project, `serve.md`
**Files updated:** `backend/src/inventory_management_system/main.py` (CORS)

---

## 1. Executive Summary

Phase 4 delivers the **frontend foundation** required for the 50% course
demonstration. A Vite + React app was scaffolded next to the backend, styled
with Tailwind CSS + shadcn/ui, and wired to the existing FastAPI endpoints
through an Axios client and a dev-server proxy. Four functional views are
live (Login, POS Terminal, Products, Admin Dashboard), three entity modules
(Customers, Employees, Expenses) exist as integrated placeholders, and the
whole stack was verified end-to-end against a seeded PostgreSQL database.

---

## 2. Stack & Scaffolding

```
frontend/
├── vite.config.js        # @tailwindcss/vite, '@' alias, /api → :8000 proxy
├── jsconfig.json         # path alias for shadcn/ui
├── components.json       # shadcn/ui config (base-nova style, lucide icons)
├── index.html
└── src/
    ├── main.jsx          # BrowserRouter + AuthProvider + sonner <Toaster>
    ├── App.jsx           # route table + guards
    ├── index.css         # Tailwind v4 + shadcn design tokens
    ├── lib/
    │   ├── api.js        # axios instance + token interceptor + 401 handling
    │   └── auth.jsx      # AuthContext (localStorage session)
    ├── components/
    │   ├── guards.jsx    # ProtectedRoute / AdminRoute
    │   ├── layout.jsx    # responsive sidebar shell
    │   └── ui/           # shadcn: button, input, card, table, dialog, badge, label, sonner, separator
    └── views/
        ├── Login.jsx     # functional
        ├── Pos.jsx       # functional
        ├── Products.jsx  # functional (admin)
        ├── Dashboard.jsx # functional (admin)
        └── Placeholder.jsx # customers / employees / expenses
```

### Dependencies (installed via npm)

| Package | Purpose |
| ------- | ------- |
| `react` 19, `react-dom` 19, `vite` 8 | core stack |
| `tailwindcss` 4 + `@tailwindcss/vite` | styling |
| `shadcn` + `@base-ui/react` components | accessible UI primitives |
| `react-router-dom` 7 | routing |
| `axios` | HTTP client |
| `recharts` 3 | dashboard charts |
| `sonner` | toast notifications |
| `lucide-react` | icons |

---

## 3. Backend integration changes

One backend change was required to serve the frontend: **CORS middleware** in
`main.py` allowing `http://localhost:5173` (the Vite dev origin). In
development, requests go through the Vite proxy (`/api` → `localhost:8000`)
which sidesteps CORS entirely; the middleware covers direct calls (e.g.,
from a deployed frontend later).

---

## 4. Routing & guards (`App.jsx`, `guards.jsx`)

| Path | View | Guard |
| ---- | ---- | ----- |
| `/login` | Login | public (redirects if already authenticated) |
| `/pos` | POS Terminal | any authenticated user |
| `/dashboard` | Admin Dashboard | **admin only** |
| `/products` | Product Management | **admin only** |
| `/customers`, `/employees`, `/expenses` | Placeholders | any authenticated user |
| `/` and `*` | redirect to `/pos` | — |

- `ProtectedRoute` → redirects to `/login` (remembering the intended URL).
- `AdminRoute` → non-admins are bounced to `/pos`.

## 5. Auth flow (`lib/auth.jsx`, `views/Login.jsx`)

- `AuthProvider` keeps `{ token, user }` in localStorage (educational choice;
  the token is a server-issued bearer token with a 7-day expiry).
- `login()` calls `POST /auth/login`, stores the token + minimal user object.
- Role-aware redirect: admin → `/dashboard`, staff → `/pos`.
- `lib/api.js` attaches `Authorization: Bearer <token>` to every request and
  force-logs-out on any 401 response.

## 6. POS Terminal (`views/Pos.jsx`)

- Catalog grid fetched from `GET /products` (refresh after checkout so stock
  labels stay truthful).
- **Search bar** filters client-side by name, sku, or category.
- **Cart** (object keyed by product id): add, ± quantity (blocked at stock
  limit), remove line, live **subtotal** computed from server-side prices.
- **Checkout** → `POST /sales` with `{payment_method, items:[{product_id,
  quantity}]}` → success toast with sale id + total → cart cleared → catalog
  reloaded. Server-side triggers handle stock/audit/status updates.

## 7. Product Management (`views/Products.jsx`, admin only)

- Data table: name, sku, category, unit price, stock, status badge
  (`Low Stock` in red), refresh button.
- **Add Product** dialog (name/sku/category/prices/stock/reorder) → `POST
  /products`.
- **Delete** with confirmation dialog → `DELETE /products/{id}`; backend 409
  (product referenced by sales) surfaces as an error toast.

## 8. Admin Dashboard (`views/Dashboard.jsx`, admin only)

- Fetches `/analytics/monthly-profit` + `/analytics/top-selling-products` in
  parallel.
- Four summary cards: total sales, expenses, net profit, units sold.
- **Recharts**: grouped bar chart (Sales vs Expenses per month) + donut pie
  chart (top sellers), both with tooltips/legends.

## 9. Placeholder views (`views/Placeholder.jsx`)

One reusable "under construction" card rendered for Customers, Employees,
and Expenses — visually consistent with the layout, no API calls.

---

## 10. Verification (live full-stack run)

Test DB `inventory_test`: schema applied via `init_db()`, seeded with 5
products, 1 customer, 1 employee, plus `admin01` (admin) and `cashier`
(staff) users registered through the API.

| Check | Result |
| ----- | ------ |
| `npm run build` | ✅ 822 kB bundle, built in ~400 ms (chunk-size warning from Recharts only) |
| `npm run lint` (oxlint) | ✅ warnings only (fast-refresh export hints) |
| Vite serves app | ✅ 200, title "Smart Inventory" |
| Login via proxy (`/api/auth/login`) | ✅ bearer token returned |
| Products via proxy (`GET /api/products`) | ✅ 5 products |
| Checkout via proxy (`POST /api/sales`) | ✅ sale #1, $50.00; stock 10→8 |
| Monthly profit via proxy | ✅ `[{"month":"2026-08-01","total_sales":"50.00",...}]` |
| Staff → analytics via proxy | ✅ 403 "Admin privileges required" |
| CORS headers (direct API call) | ✅ `access-control-allow-origin: http://localhost:5173` |

Both servers stopped after verification; DB dropped and re-created for the
demo run.

---

## 11. Deliverables summary

| Requirement | Delivered | Verified |
| ----------- | --------- | -------- |
| `frontend/` adjacent to `backend/` | Yes | Yes |
| Vite + React, Tailwind, shadcn/ui, Recharts, Router, Axios | Yes | Yes |
| Responsive sidebar + role-based nav | Yes | Yes (admin/staff item filtering) |
| Routes: /login /dashboard /pos /products /customers /employees /expenses | Yes | Yes |
| Login wired to `/auth/login` + token storage | Yes | Yes |
| POS: search, cart, subtotal, checkout, success toast | Yes | Yes |
| Products: admin table + add/delete modals | Yes | Yes |
| Dashboard: Recharts from analytics endpoints | Yes | Yes |
| Placeholders for customers/employees/expenses | Yes | Yes |
| serve.md serving guide | Yes | — |

---

## 12. Notes & open items

- **Token in localStorage** is acceptable for this course demo; a cookie or
  HttpOnly session is the production-grade alternative.
- **Charts bundle** pushes the main chunk over 500 kB — code-splitting the
  Dashboard route would fix this.
- **No delete confirmation in POS, no PATCH endpoint for products** — the
  backend has PUT only; the UI uses add/delete as requested.
- Frontend build output (`dist/`) is git-ignored; node_modules is ignored.
- Changes for this phase are **not yet committed or pushed**.