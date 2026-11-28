"""Independent, read-only public website and checkout uptime probe.

Runs from GitHub Actions without sending payment requests or credentials.
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

WEBSITE_HOST = "disha8-2.thenitishkr.in"
CHECKOUT_HOST = "checkout.disha8-2.thenitishkr.in"
ENDPOINTS = (
    (WEBSITE_HOST, "/"),
    (CHECKOUT_HOST, "/healthz"),
    (CHECKOUT_HOST, "/"),
)


def check(host: str, path: str) -> dict:
    url = f"https://{host}{path}"
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
            if urlsplit(resp.url).hostname != host:
                result["error"] = "Redirected to a different hostname"
                return result
            if host == WEBSITE_HOST:
                result["ok"] = resp.status == 200 and (
                    b'id="hero-canvas"' in body or b'id="root"' in body
                )
            elif path == "/healthz":
                data = json.loads(body)
                result["ok"] = resp.status == 200 and data.get("ok") is True
                if "verification" in data:
                    result["verification"] = data["verification"]
                if "synthetic_enabled" in data:
                    result["synthetic_enabled"] = data["synthetic_enabled"]
            else:
                result["ok"] = resp.status == 200 and (
                    b"Agentic Pay" in body or b"Command Center" in body or b"portal" in body
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


def resolve(host: str) -> dict:
    try:
        addresses = sorted({item[4][0] for item in socket.getaddrinfo(host, 443)})
        return {"host": host, "addresses": addresses, "ok": bool(addresses)}
    except socket.gaierror as exc:
        return {"host": host, "ok": False, "error": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out", default="production-probe.json")
    args = parser.parse_args()
    dns = [resolve(host) for host in (WEBSITE_HOST, CHECKOUT_HOST)]
    checks = [check(host, path) for host, path in ENDPOINTS]
    report = {"dns": dns, "checks": checks, "ok": all(item["ok"] for item in dns + checks)}
    with open(args.json_out, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

