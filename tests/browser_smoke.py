"""Browser-level checkout smoke tests (emulators, NO UPI app or real payment)."""
import os
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    base = os.getenv("CHECKOUT_URL", "http://127.0.0.1:8080").rstrip("/")
    configurations = [
        ("P2P", {}),
        ("P2P", playwright.devices["Pixel 7"]),
        ("P2M", playwright.devices["Pixel 7"]),
        # Chromium emulating an iPhone viewport is NOT an iOS WebKit test.
        ("P2P", playwright.devices["iPhone 13"]),
    ]
    for mode, options in configurations:
        page = browser.new_page(permissions=['clipboard-read', 'clipboard-write'], **options)
        page.goto(base)
        expect(page.get_by_role("heading", name="Make a payment")).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.locator("#mode").select_option(mode)
        if mode == "P2M":
            page.locator("#mcc").fill("5411")
        page.locator("#vpa").fill("test@upi")
        page.locator("#name").fill("Research recipient")
        page.locator("#amount").fill("1.00")
        with page.expect_response(lambda r: r.request.method == "POST" and r.url.endswith("/api/sessions")) as created:
            page.get_by_role("button", name="Create checkout").click()
        assert created.value.status == 201
        session = created.value.json()
        expect(page.get_by_role("button", name="Copy UPI ID")).to_be_enabled()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        # The copy-first UI deliberately no longer launches UPI or displays QR.
        # Retain coverage of the backend's UPI URI and QR generation.
        assert page.locator("#launch").count() == 0
        assert page.locator("#qr").count() == 0
        qr = page.request.get(base + "/api/sessions/" + session["session_id"] + "/qr.png",
                              headers={"Authorization": "Bearer " + session["token"]})
        assert qr.ok and qr.body().startswith(b"\x89PNG\r\n\x1a\n")
        uri = session["payment_uri"]
        parsed = urlsplit(uri)
        assert (parsed.scheme, parsed.netloc) == ("upi", "pay")
        personal = {"pa": ["test@upi"], "pn": ["Research recipient"],
                    "am": ["1.00"], "cu": ["INR"]}
        params = parse_qs(parsed.query)
        if mode == "P2P":
            assert params == personal
        else:
            assert params.pop("mc") == ["5411"]
            assert params.pop("tn")[0].startswith("PDEP ")
            assert params == personal
        expect(page.locator("#info")).to_contain_text("test@upi")
        # Real clipboard action, synthetic browser return: no real payment.
        with page.expect_response(lambda r: r.request.method == "POST" and r.url.endswith("/copy")) as copied:
            page.get_by_role("button", name="Copy UPI ID").click()
        assert copied.value.ok
        expect(page.locator("#copyUpid")).to_have_text("Copied UPI ID")
        assert page.evaluate("navigator.clipboard.readText()") == "test@upi"
        with page.expect_response(lambda r: r.request.method == "POST" and r.url.endswith("/observe")) as returned:
            page.evaluate("window.dispatchEvent(new Event('pagehide'))")
            page.evaluate("window.dispatchEvent(new Event('pageshow'))")
        assert returned.value.ok
        assert returned.value.json()["financially_verified"] is False
        expect(page.locator("#state")).to_contain_text("BROWSER RETURNED")
        expect(page.locator("#state")).to_contain_text("Debit unverified")
        page.locator("#claim").click()
        expect(page.locator("#state")).to_contain_text("Debit unverified")
        expect(page.locator("#state")).to_contain_text("PAYER CLAIMED SUCCESS")
        page.close()
    # Public opt-in PDEP lab must load its real JS modules from the same origin.
    # This proves the test page is deployable; it does NOT emulate a UPI app.
    lab = browser.new_page()
    lab.goto(base + "/pdep-lab/")
    expect(lab.get_by_role("heading", name="PDEP Mobile Signal Lab")).to_be_visible()
    lab.locator("#vpa").fill("test@upi")
    lab.locator("#payee").fill("Research Recipient")
    lab.locator("#amount").fill("1.00")
    lab.locator("#prepare").click()
    expect(lab.locator("#challenge")).to_contain_text("Challenge note:")
    expect(lab.locator("#handoff")).to_be_enabled()
    # Module-loaded lab can process copied marker without transferring real money.
    marker = lab.locator("#challenge").inner_text().split("PD", 1)[1]
    lab.locator("#evidence").fill("PD" + marker)
    lab.locator("#assess").click()
    expect(lab.locator("#assessment")).to_contain_text("Financial debit NOT verified")
    lab.close()
    browser.close()
