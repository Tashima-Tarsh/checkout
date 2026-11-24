"""Restricted account inventory and fail-closed orchestration."""
import os
import secrets
import time
from cryptography.fernet import Fernet
from fastapi import APIRouter, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, SecretStr, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from checkout.agentic_storage import accounts, agent_sessions
from checkout.vpa_admin import require_admin

router = APIRouter(prefix="/api/admin/agentic", tags=["agentic"])

class AccountInput(BaseModel):
    vpa: str = Field(pattern=r"^[a-zA-Z0-9_.-]{2,256}@[a-zA-Z0-9_.-]{2,64}$")
    bank: str = Field(min_length=1,max_length=100)
    holder: str = Field(min_length=1,max_length=100)
    account_number: SecretStr
    mobile: SecretStr
    @field_validator("account_number", "mobile")
    @classmethod
    def digits(cls, value, info):
        raw = value.get_secret_value()
        if not raw.isascii() or not raw.isdigit() or not (len(raw)==10 if info.field_name=="mobile" else 6<=len(raw)<=34):
            raise ValueError("invalid account details")
        return value

def encrypt_account(item, cipher):
    number = item.account_number.get_secret_value()
    return dict(id=secrets.token_hex(16), vpa=item.vpa.lower(), bank=item.bank, holder=item.holder,
        account_cipher=cipher.encrypt(number.encode()).decode(),
        mobile_cipher=cipher.encrypt(item.mobile.get_secret_value().encode()).decode(), last4=number[-4:])

@router.post("/accounts")
def register(request: Request, items: list[AccountInput]):
    require_admin(request)
    if not 1 <= len(items) <= 1000:
        raise HTTPException(400,"Expected 1 to 1000 accounts")
    try:
        cipher=Fernet(os.environ["AGENTIC_ACCOUNT_KEY"].encode())
    except (KeyError,ValueError):
        raise HTTPException(503,"Account encryption unavailable")
    rows=[encrypt_account(item,cipher) for item in items]
    try:
        with request.app.state.engine.begin() as conn:
            conn.execute(accounts.insert(),rows)
            conn.execute(agent_sessions.insert(),[dict(account_id=r["id"],state="AUTH_REQUIRED",expires=0) for r in rows])
    except IntegrityError:
        raise HTTPException(409,"Duplicate account")
    return {"registered":len(rows)}

@router.get("/accounts")
def inventory(request: Request):
    require_admin(request)
    with request.app.state.engine.connect() as conn:
        rows=conn.execute(select(accounts.c.id,accounts.c.vpa,accounts.c.bank,accounts.c.last4,agent_sessions.c.state,agent_sessions.c.expires).join(agent_sessions)).mappings().all()
    return [dict(r, state="AUTH_REQUIRED" if r["expires"] <= int(time.time()) else r["state"]) for r in rows]
