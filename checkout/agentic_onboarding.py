"""Production signup, pricing and merchant entitlement."""
import json
import os
import secrets
import time
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request as AWSRequest, urlopen

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from checkout.agentic_storage import merchants, subscriptions

router = APIRouter()
TIERS = (
    ("starter", 1_000_000, 3_000),
    ("growth", 5_000_000, 7_500),
    ("business", 10_000_000, 15_000),
    ("scale", 500_000_000, 35_000),
    ("enterprise", 1_000_000_000, 60_000),
    ("corporate", 5_000_000_000, 150_000),
    ("platinum", 10_000_000_000, 300_000),
)


class Quote(BaseModel):
    monthly_volume: int = Field(ge=0, le=10_000_000_000)
    setup_fee: int = Field(default=0, ge=0, le=100_000_000)
    annual_maintenance: int = Field(default=0, ge=0, le=100_000_000)
    billing: Literal["monthly", "annual"] = "monthly"


class Signup(Quote):
    business_name: str = Field(min_length=3, max_length=150, strip_whitespace=True)
    gst: str = Field(pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$")
    bank_account: str = Field(pattern=r"^[0-9]{6,34}$")
    slug: str = Field(pattern=r"^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$")


def require_signup_host(request):
    domain = os.environ.get("DISHA_DOMAIN")
    if not domain or request.url.hostname != f"signup.{domain}" or os.environ.get("DISHA_ENV") != "prod":
        raise HTTPException(404)


def quote_values(item):
    tier, _, monthly_fee = next(row for row in TIERS if item.monthly_volume <= row[1])
    annual_volume = item.monthly_volume * 12
    gross_mdr = annual_volume * 300
    platform_share = gross_mdr // 2
    aggregator = gross_mdr + (item.setup_fee + item.annual_maintenance) * 100
    disha = platform_share + monthly_fee * 1200
    return {
        "tier": tier, "subscription_due_paise": monthly_fee * (1200 if item.billing == "annual" else 100),
        "annual_aggregator_paise": aggregator, "annual_disha_paise": disha,
        "annual_savings_paise": aggregator - disha,
        "annual_merchant_mdr_share_paise": gross_mdr - platform_share,
        "annual_platform_mdr_share_paise": platform_share,
    }


def cognito_identity(request):
    """Use the configured Cognito app and pool; reject tokens from other pools."""
    from checkout.agentic_api import bearer
    token = bearer(request.headers.get("Authorization"))
    region = os.environ["AWS_REGION"]
    pool = os.environ["DISHA_COGNITO_POOL"]
    client = os.environ["DISHA_COGNITO_CLIENT"]
    import base64
    try:
        payload = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if (
            claims["iss"] != f"https://cognito-idp.{region}.amazonaws.com/{pool}"
            or claims["client_id"] != client or claims["token_use"] != "access"
        ):
            raise ValueError
        # GetUser verifies the same signed access token before claims are used.
        endpoint = AWSRequest(
            f"https://cognito-idp.{region}.amazonaws.com/",
            json.dumps({"AccessToken": token}).encode(),
            headers={"Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.GetUser"},
        )
        with urlopen(endpoint, timeout=5) as response:
            attrs = {item["Name"]: item["Value"] for item in json.load(response)["UserAttributes"]}
        if attrs.get("email_verified") != "true" or attrs["sub"] != claims["sub"]:
            raise ValueError
        return attrs["sub"], attrs["email"]
    except (ValueError, IndexError, KeyError, TypeError, HTTPError):
        raise HTTPException(401, "Verified Cognito account required") from None
    except (URLError, TimeoutError):
        raise HTTPException(503, "Identity service unavailable") from None


@router.get("/signup")
def signup_page(request: Request):
    require_signup_host(request)
    return FileResponse(os.path.join(os.path.dirname(__file__), "agentic_assets", "signup.html"))


@router.post("/signup/quote")
def quote(request: Request, item: Quote):
    require_signup_host(request)
    return quote_values(item)


@router.post("/signup", status_code=201)
def signup(request: Request, item: Signup):
    from checkout.agentic_api import digest, event

    require_signup_host(request)
    if item.slug in {"admin", "api", "dashboard", "health", "signup", "www", "auth"} or item.slug.endswith(("-dev", "-uat")):
        raise HTTPException(422, "Reserved hostname")
    subject, email = cognito_identity(request)
    identity = secrets.token_hex(16)
    token = secrets.token_urlsafe(32)
    trial_until = int(time.time()) + 86400
    try:
        with request.app.state.engine.begin() as conn:
            conn.execute(merchants.insert().values(id=identity, name=item.business_name.strip(), token_hash=digest(token), email=email))
            conn.execute(subscriptions.insert().values(
                merchant_id=identity, subject=subject, slug=item.slug, gst=item.gst,
                bank_cipher=request.app.state.account_cipher.encrypt(item.bank_account.encode()).decode(),
                monthly_volume=item.monthly_volume, period=item.billing, trial_until=trial_until,
            ))
            event(conn, identity, "MERCHANT_TRIAL_STARTED")
    except IntegrityError:
        raise HTTPException(409, "Merchant signup or hostname already exists") from None
    return {"merchant_id": identity, "trial_until": trial_until, "api_token": token, **quote_values(item)}


def enforce_entitlement(conn, merchant, timestamp):
    row = conn.execute(select(subscriptions.c.trial_until, subscriptions.c.paid_until).where(
        subscriptions.c.merchant_id == merchant
    )).first()
    if row and max(row.trial_until, row.paid_until or 0) <= timestamp:
        raise HTTPException(403, "Subscription required. Merchant access is read-only.")
