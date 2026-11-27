"""
DISHA 8.2 - Canonical URL Registry
================================================
Centralized environment-aware URL configuration for all subdomains.
All domain and URL configurations are centralized here to prevent
hardcoded URLs throughout the codebase.

Environments: DEVELOPMENT, UAT, PRODUCTION
AWS Region: ap-southeast-2 (Asia Pacific / Sydney)
"""

import os
from typing import Dict, Optional

# ---------------------------------------------------------------------------
# Environment Configuration
# ---------------------------------------------------------------------------

ENVIRONMENT = os.environ.get("DISHA_ENV", "production").lower()
ALLOWED_ENVS = {"development", "uat", "production"}

if ENVIRONMENT not in ALLOWED_ENVS:
    raise RuntimeError(f"DISHA_ENV must be one of {ALLOWED_ENVS}, got {ENVIRONMENT}")

# Base domain for all subdomains
BASE_DOMAIN = os.environ.get("DISHA_BASE_DOMAIN", "disha8-2.thenitishkr.in")

# Environment-specific subdomain prefixes
ENV_PREFIXES = {
    "development": "dev",
    "uat": "uat",
    "production": "",
}


def env_prefix() -> str:
    """Return the subdomain prefix for the current environment."""
    return ENV_PREFIXES.get(ENVIRONMENT, "")


def subdomain(sub: str) -> str:
    """Build a full subdomain for the current environment.

    Examples:
        subdomain("checkout") -> checkout.disha8-2.thenitishkr.in  (production)
        subdomain("checkout") -> checkout.uat.disha8-2.thenitishkr.in  (uat)
        subdomain("checkout") -> checkout.dev.disha8-2.thenitishkr.in  (development)
    """
    prefix = env_prefix()
    if prefix:
        return f"{sub}.{prefix}.{BASE_DOMAIN}"
    return f"{sub}.{BASE_DOMAIN}"


def url(scheme: str, sub: str, path: str = "/") -> str:
    """Build a full URL for a subdomain service.

    Args:
        scheme: "https" or "http"
        sub: subdomain name (e.g., "checkout", "merchant", "superadmin")
        path: URL path starting with "/"

    Returns:
        Full URL string
    """
    return f"{scheme}://{subdomain(sub)}{path}"


def https_url(sub: str, path: str = "/") -> str:
    """Build an HTTPS URL for a subdomain service."""
    return url("https", sub, path)


# ---------------------------------------------------------------------------
# Canonical URL Registry
# ---------------------------------------------------------------------------

# All canonical URLs for the DISHA 8.2 platform
CANONICAL_URLS: Dict[str, str] = {}

# Public Website
CANONICAL_URLS["website_public"] = https_url("disha8-2.thenitishkr.in", "/")
CANONICAL_URLS["website_home"] = https_url("", "/")

# Super Admin Control Center
CANONICAL_URLS["superadmin"] = https_url("superadmin", "/")

# Merchant Portal
CANONICAL_URLS["merchant_portal"] = https_url("merchant", "/")

# Agent Portal / Agentic Pay
CANONICAL_URLS["agent_portal"] = https_url("agenticpay", "/")
CANONICAL_URLS["agentic_pay"] = https_url("agenticpay", "/")

# Support Portal
CANONICAL_URLS["support_portal"] = https_url("support", "/")

# Payment Checkout (Customer-facing)
CANONICAL_URLS["checkout"] = https_url("checkout", "/")

# Transaction Receipt
CANONICAL_URLS["receipt"] = https_url("receipt", "/")

# Public API
CANONICAL_URLS["api_public"] = https_url("api", "/")

# System Status
CANONICAL_URLS["system_status"] = https_url("status", "/")

# SaaS Admin API
CANONICAL_URLS["saas_admin_api"] = https_url("admin", "/api")

# Android Device API
CANONICAL_URLS["android_api"] = https_url("android", "/api")

# Recovery Agent API
CANONICAL_URLS["recovery_api"] = https_url("recovery", "/api")


def get_url(service: str, path: str = "/") -> str:
    """Get a canonical URL for a service.

    Args:
        service: Service name from CANONICAL_URLS keys
        path: URL path to append

    Returns:
        Full HTTPS URL

    Raises:
        KeyError: If service is not registered
    """
    if service not in CANONICAL_URLS:
        raise KeyError(f"Unknown service: {service}. Available: {list(CANONICAL_URLS.keys())}")
    base = CANONICAL_URLS[service]
    if path and not path.startswith("/"):
        path = "/" + path
    return base.rstrip("/") + path


def get_all_urls() -> Dict[str, str]:
    """Return a copy of all canonical URLs."""
    return dict(CANONICAL_URLS)


# ---------------------------------------------------------------------------
# Contact Information
# ---------------------------------------------------------------------------

CONTACT_EMAIL = os.environ.get("DISHA_CONTACT_EMAIL", "nitish@thenitishkr.in")
CONTACT_WHATSAPP = os.environ.get("DISHA_WHATSAPP", "+91-9142197135")
CONTACT_WHATSAPP_LINK = "https://wa.me/919142197135"
COMPANY_NAME = "DishaNitish Technologies"
PRODUCT_NAME = "DISHA 8.2"

# ---------------------------------------------------------------------------
# Environment-specific configuration
# ---------------------------------------------------------------------------

ENV_CONFIG = {
    "development": {
        "debug": True,
        "log_level": "DEBUG",
        "workers": 1,
        "reload": True,
    },
    "uat": {
        "debug": False,
        "log_level": "INFO",
        "workers": 2,
        "reload": False,
    },
    "production": {
        "debug": False,
        "log_level": "WARNING",
        "workers": 4,
        "reload": False,
    },
}


def env_config() -> dict:
    """Return environment-specific configuration."""
    return dict(ENV_CONFIG[ENVIRONMENT])


def is_production() -> bool:
    return ENVIRONMENT == "production"


def is_development() -> bool:
    return ENVIRONMENT == "development"


def is_uat() -> bool:
    return ENVIRONMENT == "uat"
