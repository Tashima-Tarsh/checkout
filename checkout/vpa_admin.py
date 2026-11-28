"""Authenticated, IP-allowlisted VPA inventory and Excel/CSV import.

No customer payment is ever verified by this module. Imported VPAs are
configuration only and must belong to recipients authorized by the operator.
"""
from __future__ import annotations
import csv
import io
import ipaddress
import os
import re
import secrets

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from sqlalchemy import select
from checkout.storage import vpa_routes

router = APIRouter(prefix="/api/admin", tags=["administration"])
VPA_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{2,256}@[A-Za-z0-9_.-]{2,64}$")
KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
MAX_BYTES = 1024 * 1024
MAX_ROWS = 500


def _networks(name):
    value = os.environ.get(name, "").strip()
    try:
        return [ipaddress.ip_network(x.strip(), strict=False) for x in value.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(503, "IP allowlist misconfigured")


def _client_ip(request: Request):
    try:
        peer = ipaddress.ip_address(request.client.host)
    except (ValueError, AttributeError):
        raise HTTPException(403, "Unknown client IP")
    trusted = _networks("PDEP_TRUSTED_PROXY_CIDRS")
    # Only accept forwarded headers if the immediate network peer is a trusted proxy.
    if any(peer in net for net in trusted):
        raw = request.headers.get("x-forwarded-for", "")
        if raw and len(raw) <= 512:
            try:
                chain = [ipaddress.ip_address(x.strip()) for x in raw.split(",")] + [peer]
            except ValueError:
                raise HTTPException(403, "Malformed proxy chain")
            for address in reversed(chain):
                if not any(address in net for net in trusted):
                    return address
    return peer


def enforce_optional_session_allowlist(request: Request):
    """Restrict session creation to merchant servers only when explicitly enabled.

    Never turn this on for unrestricted public browser checkout: end-user IPs
    are dynamic. Admin allowlisting remains separately enforced.
    """
    allowed = _networks("PDEP_SESSION_CREATE_IP_ALLOWLIST")
    if allowed and not any(_client_ip(request) in net for net in allowed):
        raise HTTPException(403, "Session creation is not allowed from this IP")


def require_admin(request: Request):
    secret = os.environ.get("ADMIN_TOKEN", "")
    allowed = _networks("ADMIN_IP_ALLOWLIST")
    if len(secret) < 32 or not allowed:
        raise HTTPException(503, "Admin access is disabled until explicitly configured")
    address = _client_ip(request)
    if not any(address in network for network in allowed):
        raise HTTPException(403, "IP is not allowlisted")
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(token, secret):
        raise HTTPException(401, "Administrator authentication required")


def validate_row(row):
    key = str(row.get("route_key") or "").strip().lower()
    mode = str(row.get("mode") or "").strip().upper()
    vpa = str(row.get("vpa") or "").strip().lower()
    mcc = str(row.get("mcc") or "").strip()
    priority = row.get("priority")
    enabled = str(row.get("enabled", "true")).strip().lower()
    if not KEY_PATTERN.fullmatch(key): raise ValueError("Invalid route_key")
    if mode not in ("P2P", "P2M"): raise ValueError("Mode must be P2P or P2M")
    if not VPA_PATTERN.fullmatch(vpa): raise ValueError("Invalid VPA")
    if mcc and (mode != "P2M" or not re.fullmatch(r"[0-9]{4}", mcc)):
        raise ValueError("Invalid MCC")
    try:
        rank = int(priority) if priority not in (None, "") else 100
    except (ValueError, TypeError):
        raise ValueError("Invalid priority")
    if rank < 0 or rank > 10000: raise ValueError("Priority must be 0..10000")
    if enabled not in ("true", "false", "1", "0", "yes", "no"):
        raise ValueError("Invalid enabled flag")
    return dict(route_key=key, mode=mode, vpa=vpa,
                mcc=mcc or None, priority=rank,
                enabled=enabled in ("true", "1", "yes"))


def read_rows(name, data):
    if len(data) > MAX_BYTES: raise HTTPException(413, "File too large")
    if name.lower().endswith(".csv"):
        try:
            reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
            records = list(reader)
        except (UnicodeError, csv.Error):
            raise HTTPException(422, "Invalid CSV")
    elif name.lower().endswith(".xlsx"):
        from openpyxl import load_workbook
        try:
            book = load_workbook(io.BytesIO(data), read_only=True, data_only=False)
            sheet = book.active
            iterator = sheet.iter_rows(values_only=True)
            header = [str(v).strip() if v is not None else "" for v in next(iterator)]
            records = []
            for values in iterator:
                if all(v is None for v in values): continue
                # Excel formulas are never evaluated or accepted as routing data.
                if any(isinstance(v, str) and v.startswith("=") for v in values):
                    raise ValueError("Spreadsheet formulas are not allowed")
                records.append(dict(zip(header, values)))
                if len(records) > MAX_ROWS: raise ValueError("Too many rows")
            book.close()
        except (ValueError, StopIteration, OSError, KeyError, IndexError) as exc:
            raise HTTPException(422, "Invalid Excel workbook: " + str(exc))
    else:
        raise HTTPException(415, "Upload only .csv or .xlsx")
    if not records or len(records) > MAX_ROWS:
        raise HTTPException(422, "Expected between 1 and 500 data rows")
    try:
        return [validate_row(record) for record in records]
    except ValueError as exc:
        raise HTTPException(422, "Invalid inventory: " + str(exc))


@router.post("/vpas/import")
async def import_vpas(request: Request, file: UploadFile = File(...)):
    require_admin(request)
    if file.size is not None and file.size > MAX_BYTES:
        raise HTTPException(413, "File too large")
    data = await file.read(MAX_BYTES + 1)
    rows = read_rows(file.filename or "", data)
    # Replace inventory atomically, including disabling removed routes.
    with request.app.state.engine.begin() as connection:
        connection.execute(vpa_routes.delete())
        connection.execute(vpa_routes.insert(), rows)
    return {"imported": len(rows), "note": "Inventory only; no debit verified"}


@router.get("/vpas")
def list_vpas(request: Request):
    require_admin(request)
    with request.app.state.engine.connect() as connection:
        rows = connection.execute(select(vpa_routes).order_by(vpa_routes.c.route_key, vpa_routes.c.priority, vpa_routes.c.id)).mappings()
        return [dict(row) for row in rows]
