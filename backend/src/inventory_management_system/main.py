"""Application entry point for the Smart Inventory & Business Management System.

This module bootstraps the FastAPI application and exposes a minimal
health-check endpoint so we can confirm the server is running.
"""

from fastapi import FastAPI

# Create the FastAPI application instance.
app = FastAPI(
    title="Smart Inventory and Business Management System",
    version="0.1.0",
    description="Backend for a simple inventory management system (educational project).",
)


@app.get("/", tags=["system"])
async def health_check():
    """Root endpoint.

    Returns a tiny JSON payload used as a health check to verify that the
    server is up and responding.
    """
    return {"status": "System Online"}