"""Genymotion read-only discovery. Credentials never leave the server."""
import json
import os
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from uuid import UUID

DEVICE = "AgenticMobile0001"

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def status():
    result = {"connected": False, "device_id": DEVICE, "financially_verified": False}
    token = os.environ.get("GENYMOTION_API_TOKEN")
    if not token:
        return dict(result, state="TOKEN_NOT_CONFIGURED")
    try:
        req = Request("https://api.geny.io/cloud/v1/instances",
                      headers={"x-api-token": token, "Accept": "application/json"})
        with build_opener(NoRedirect()).open(req, timeout=8) as response:
            payload = json.loads(response.read(1048576))
        records = payload if isinstance(payload, list) else payload["instances"]
        matches = [r for r in records if r.get("name") == DEVICE]
        if len(matches) != 1:
            return dict(result, state="NO_DEVICE" if not matches else "AMBIGUOUS_DEVICE")
        device = matches[0]
        uid = str(UUID(device["uuid"]))
        online = device.get("state") == "ONLINE"
        return dict(result, state="ONLINE" if online else "DEVICE_NOT_ONLINE",
                    connected=online, display_url="https://cloud.geny.io/instance/" + uid if online else None)
    except HTTPError as exc:
        return dict(result, state="AUTH_FAILED" if exc.code in (401, 403) else "PROVIDER_ERROR")
    except (URLError, TimeoutError, ValueError, KeyError, TypeError, AttributeError, OSError):
        return dict(result, state="PROVIDER_UNAVAILABLE")
