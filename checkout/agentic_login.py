"""Password login and revocable browser sessions for Agentic Pay UAT."""
import hashlib
import hmac
import os
import re
import secrets
import time
from collections import deque
from threading import Lock

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import BigInteger, Column, String, Table, select

from checkout.agentic_storage import merchants, metadata

EMAIL = "nitish@thenitishkr.in"
ORIGIN = "https://agenticpay.thenitishkr.in"
COOKIE = "__Host-agentic_session"
TTL = 8 * 60 * 60
sessions = Table(
    "ap_login_sessions", metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("credential_version", String(64), nullable=False),
    Column("expires", BigInteger, nullable=False),
)
router = APIRouter(prefix="/api/auth")


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class PasswordLogin:
    def __init__(self, password, owner_secret, merchant_id):
        if not 12 <= len(password) <= 128 or not re.fullmatch("[0-9a-f]{32}", merchant_id):
            raise ValueError("Login requires a 12–128 character password and a merchant ID")
        self.salt = secrets.token_bytes(16)
        self.verifier = self.hash(password)
        self.version = hmac.new(owner_secret.encode(), ("agentic-login:" + password + ":" + merchant_id).encode(), "sha256").hexdigest()
        self.merchant_id = merchant_id
        self.failures = deque()
        self.lock = Lock()

    def hash(self, password):
        return hashlib.scrypt(password.encode(), salt=self.salt, n=32768, r=8, p=1, maxmem=64 * 1024 * 1024)

    def authenticate(self, email, password):
        if not self.lock.acquire(blocking=False):
            raise HTTPException(429, "Retry sign-in shortly")
        try:
            now = time.monotonic()
            while self.failures and self.failures[0] <= now - 300:
                self.failures.popleft()
            if len(self.failures) >= 10:
                raise HTTPException(429, "Too many failed sign-ins. Try again later.")
            valid = hmac.compare_digest(self.hash(password), self.verifier)
            if email.strip().lower() != EMAIL or not valid:
                self.failures.append(now)
                raise HTTPException(401, "Invalid email or password")
            self.failures.clear()
        finally:
            self.lock.release()


def configure(engine, owner_secret):
    password = os.getenv("AGENTIC_LOGIN_PASSWORD")
    merchant_id = os.getenv("AGENTIC_LOGIN_MERCHANT_ID", "")
    if not password or not merchant_id:
        return None
    try:
        login = PasswordLogin(password, owner_secret, merchant_id)
    except ValueError:
        return None
    with engine.connect() as conn:
        return login if conn.scalar(select(merchants.c.id).where(merchants.c.id == merchant_id)) else None


def require_same_origin(request):
    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.headers.get("origin") != ORIGIN:
        raise HTTPException(403, "Invalid request origin")


def require_session(request):
    login = getattr(request.app.state, "password_login", None)
    token = request.cookies.get(COOKIE, "")
    if login is None or not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        raise HTTPException(401, "Sign in required")
    require_same_origin(request)
    with request.app.state.engine.connect() as conn:
        active = conn.scalar(select(sessions.c.token_hash).where(
            sessions.c.token_hash == digest(token),
            sessions.c.credential_version == login.version,
            sessions.c.expires > int(time.time()),
        ))
    if active is None:
        raise HTTPException(401, "Sign in required")
    return login


class LoginInput(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: SecretStr = Field(min_length=1, max_length=128)


@router.post("/login", status_code=204)
def sign_in(request: Request, response: Response, credentials: LoginInput):
    require_same_origin(request)
    login = getattr(request.app.state, "password_login", None)
    if login is None:
        raise HTTPException(503, "Email sign-in is unavailable")
    login.authenticate(credentials.email, credentials.password.get_secret_value())
    token = secrets.token_urlsafe(32)
    previous = request.cookies.get(COOKIE, "")
    now = int(time.time())
    with request.app.state.engine.begin() as conn:
        conn.execute(sessions.delete().where(sessions.c.expires <= now))
        if re.fullmatch(r"[A-Za-z0-9_-]{43}", previous):
            conn.execute(sessions.delete().where(sessions.c.token_hash == digest(previous)))
        conn.execute(sessions.insert().values(token_hash=digest(token), credential_version=login.version, expires=now + TTL))
    response.set_cookie(COOKIE, token, max_age=TTL, secure=True, httponly=True, samesite="strict", path="/")


@router.post("/logout", status_code=204)
def sign_out(request: Request, response: Response):
    require_same_origin(request)
    token = request.cookies.get(COOKIE, "")
    if re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
        with request.app.state.engine.begin() as conn:
            conn.execute(sessions.delete().where(sessions.c.token_hash == digest(token)))
    response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="strict")
