"""Independent, read-only public checkout uptime probe.

Runs from GitHub Actions to test public internet access, not just a successful
Railway deployment indicator. Never sends payment requests or credentials.
"""
from __future__ import annotations

import argparse
import json
import socket
import ssl
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ALLOWED_PATHS = ("/healthz", "/api/appearance", "/")
EXPECTED = "disha8-2.thenitishkr.in"


def check(path: str) -> dict:
    url = "https://" + EXPECTED + path
    result = {"url": url, "ok": False}
    try:
        request = Request(url, headers={"Accept": "application/json" if path != "/" else "text/html",
                                        "User-Agent": "PDEP-public-healthcheck/1.0"})
        started = time.monotonic()
        with urlopen(request, timeout=12, context=ssl.create_default_context()) as resp:
            body = resp.read(128 * 1024)
            result["http_status"] = resp.status
            result["latency_ms"] = round((time.monotonic() - started) * 1000)
            content_type = resp.headers.get("content-type", "")
            if resp.url != url:
                result["redirected_to"] = resp.url
            if path == "/healthz":
                data = json.loads(body)
                result["ok"] = resp.status == 200 and data.get("ok") is True
                result["synthetic_enabled"] = data.get("synthetic_enabled")
            elif path == "/api/appearance":
                data = json.loads(body)
                result["ok"] = (
                    resp.status == 200
                    and isinstance(data.get("brand_name"), str)
                    and isinstance(data.get("theme"), str)
                )
            else:
                result["ok"] = resp.status == 200 and (
                    b'id="form"' in body and b'id="launch"' in body
                )
            if not result["ok"]:
                result["error"] = "Unexpected public response shape"
            result["content_type"] = content_type
    except socket.gaierror as exc:
        result["error"] = f"DNS resolution failed: {exc}"
    except HTTPError as exc:
        result["http_status"] = exc.code
        result["error"] = f"HTTP status {exc.code}"
    except (URLError, TimeoutError, ConnectionError, ssl.SSLError) as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
    except (ValueError, KeyError) as exc:
        result["error"] = f"Unparseable response: {exc}"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", default="production-probe.json")
    args = parser.parse_args()
    try:
        addresses = sorted({item[4][0] for item in socket.getaddrinfo(EXPECTED, 443)})
        dns = {"host": EXPECTED, "addresses": addresses, "ok": True}
    except socket.gaierror as exc:
        dns = {"host": EXPECTED, "ok": False, "error": str(exc)}
    checks = [check(path) for path in ALLOWED_PATHS]
    report = {"dns": dns, "checks": checks, "ok": dns["ok"] and all(x["ok"] for x in checks)}
    with open(args.json_out, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
