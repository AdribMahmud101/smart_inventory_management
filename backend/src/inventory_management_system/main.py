"""Application entry point for the Smart Inventory & Business Management System.

This module bootstraps the FastAPI application, registers the modular
routers (products, sales, analytics), and exposes a minimal health-check
endpoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from inventory_management_system.routers import analytics, auth, products, sales

# Create the FastAPI application instance.
app = FastAPI(
    title="Smart Inventory and Business Management System",
    version="0.1.0",
    description="Backend for a simple inventory management system (educational project).",
)

# Allow the Vite frontend dev server to call the API directly.
# In production this should be narrowed to the real frontend origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the API routers (modular, one per business domain).
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(analytics.router)


@app.get("/", tags=["system"])
async def health_check():
    """Root endpoint.

    Returns a tiny JSON payload used as a health check to verify that the
    server is up and responding.
    """
    return {"status": "System Online"}
