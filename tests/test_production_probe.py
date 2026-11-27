"""Read-only probe regression tests with mocked HTTP responses."""
import io
import json
from unittest.mock import patch

from ops import production_probe as probe


class Response(io.BytesIO):
    status = 200
    headers = {"content-type": "application/json"}

    def __init__(self, path, body, redirect=None):
        super().__init__(body)
        self.url = redirect or f"https://{probe.EXPECTED}{path}"


def check(path, body, redirect=None):
    with patch.object(probe, "urlopen", return_value=Response(path, body, redirect)):
        return probe.check(path)


def test_current_checkout_html_markers():
    assert check("/", b'<form id="form"><button id="create"></button><button id="payNow"></button></form>')["ok"]
    assert not check("/", b'<form id="form"><button id="launch"></button></form>')["ok"]


def test_checkout_health_must_identify_checkout():
    assert check("/healthz", json.dumps({"ok": True, "synthetic_enabled": False}).encode())["ok"]
    assert not check("/healthz", b'{"ok":true,"verification":"PENDING"}')["ok"]


def test_cross_service_redirect_is_rejected():
    result = check("/", b'<form id="form"><button id="create"></button><button id="payNow"></button></form>',
                   "https://agenticpay.thenitishkr.in/merchant")
    assert not result["ok"]
    assert result["redirected_to"].endswith("/merchant")


def test_appearance_requires_expected_fields():
    assert check("/api/appearance", b'{"brand_name":"PDEP","theme":"light"}')["ok"]
    assert not check("/api/appearance", b'{"ok":true}')["ok"]
