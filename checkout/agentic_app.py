"""Independent Agentic Pay application entry point."""
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

from cryptography.fernet import Fernet
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from checkout.agentic_api import ORDER_ID, digest, router
from checkout.agentic_storage import initialize, make_engine, merchants

ASSETS = Path(__file__).parent / "agentic_assets"


@asynccontextmanager
async def lifespan(app):
    token = os.environ.get("AGENTIC_OWNER_TOKEN", "")
    if re.fullmatch(r"[A-Za-z0-9_-]{43,128}", token) is None:
        raise RuntimeError("Set AGENTIC_OWNER_TOKEN to a randomly generated secret")
    app.state.owner_token_hash = digest(token)
    app.state.account_cipher = Fernet(os.environ["AGENTIC_ACCOUNT_KEY"].encode())
    engine = make_engine()
    try:
        initialize(engine)
        app.state.engine = engine
        yield
    finally:
        engine.dispose()


app = FastAPI(title="Agentic Pay", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(router)
app.mount("/assets", StaticFiles(directory=ASSETS), name="assets")


@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    return JSONResponse({"detail": "Invalid request input"}, status_code=422)


@app.exception_handler(SQLAlchemyError)
async def database_error(request, error):
    return JSONResponse({"detail": "Storage unavailable"}, status_code=503)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.update({
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    })
    return response


@app.get("/healthz")
def health(request: Request):
    with request.app.state.engine.connect() as conn:
        conn.execute(select(merchants.c.id).limit(1))
    return {"ok": True, "verification": "PENDING"}


@app.get("/")
@app.get("/merchant")
@app.get("/owner")
@app.get("/agents")
def portal():
    return FileResponse(ASSETS / "portal.html")


@app.get("/checkout/{order_id}")
def checkout(order_id: str):
    if not ORDER_ID.fullmatch(order_id):
        raise HTTPException(404, "Order not found")
    return FileResponse(ASSETS / "checkout.html")
