"""Real Chromium browser test, served from a local synthetic checkout fixture."""
import functools
import http.server
import json
import pathlib
import re
import threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1] / "checkout" / "agentic_assets"

def main():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0),
        functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(permissions=["clipboard-read","clipboard-write"])
            base = f"http://127.0.0.1:{server.server_port}"
            page.route("**/api/checkout/fixture", lambda r: r.fulfill(json={
                "status":"OPEN","amount_minor":100,"discount_minor":0,"upi_id":"fixture-not-a-payment-address"}))
            page.route("**/api/checkout/fixture/verify", lambda r: r.fulfill(json={"status":"PENDING"}))
            # Map fixture routes to actual static checkout assets without a backend.
            # A Playwright glob '*' does not match a path separator.
            # Match only the two intended document URLs, including query strings.
            checkout_route = re.compile(re.escape(base) + r"/checkout/fixture(?:/diagnostics)?(?:\?[^#]*)?$")
            page.route(checkout_route, lambda r: r.fulfill(
                content_type="text/html",body=(ROOT/"checkout.html").read_text()))
            for suffix in ("", "?vision_lab=1", "/diagnostics?diagnostic_lab=1"):
                assert checkout_route.fullmatch(base + "/checkout/fixture" + suffix)
            assert not checkout_route.fullmatch(base + "/api/checkout/fixture")
            assert not checkout_route.fullmatch(base + "/checkout/fixture/unexpected")
            page.route("**/assets/*", lambda r: r.fulfill(
                content_type="text/javascript",body=(ROOT/r.request.url.split("/assets/")[1].split("?")[0]).read_text()))
            page.goto(base+"/checkout/fixture")
            page.get_by_role("button",name="I Paid").wait_for()
            assert page.get_by_text("Local research diagnostics",exact=True).count()==0
            page.goto(base+"/checkout/fixture?diagnostic_lab=1&diagnostics=1")
            page.get_by_role("button",name="I Paid").wait_for()
            assert page.get_by_role("button",name="Start local trace").count()==0
            assert page.get_by_text("Local research diagnostics",exact=True).count()==0
            navigation = page.goto(base+"/checkout/fixture/diagnostics?diagnostic_lab=1")
            assert navigation is not None and navigation.ok, "Diagnostics document did not load"
            start=page.get_by_role("button",name="Start local trace")
            start.click()
            page.get_by_role("button",name="Copy UPI ID").click()
            page.get_by_text("UPI ID copied.",exact=True).wait_for()
            # Synthetic lifecycle dispatch tests browser integration, not Android app access.
            with page.expect_request(lambda req: req.method == "GET" and req.url.endswith("/api/checkout/fixture")):
                page.evaluate("""() => {
                    // Focus-only return models split-screen interaction.
                    Object.defineProperty(document, 'hidden', {configurable:true, get:()=>false});
                    Object.defineProperty(document, 'hasFocus', {configurable:true, value:()=>true});
                    window.dispatchEvent(new Event('blur'));
                    window.dispatchEvent(new Event('focus'));
                }""")
            page.get_by_text("Return detected. Payment not confirmed.",exact=False).wait_for()
            assert page.get_by_role("button",name="I Paid").is_enabled()
            page.get_by_role("button",name="I Paid").click()
            page.get_by_text("Verification pending.",exact=False).wait_for()
            page.get_by_role("button",name="Stop trace").click()
            result=json.loads(page.get_by_role("textbox",name="Redacted local trace").input_value())
            assert [e["kind"] for e in result["events"] if e["kind"] in
                {"start","copy_ok","paid_click","verify_ok","stop"}]==["start","copy_ok","paid_click","verify_ok","stop"],result
            assert result["financially_verified"] is False
            assert "fixture-not-a-payment-address" not in json.dumps(result)
            assert result["active"] is False
            # Merchant capability is mocked only for this browser UI fixture.
            page.route("**/api/checkout/fixture/vision", lambda r: r.fulfill(json=
                {"enabled":True,"research_only":True} if r.request.method == "GET" else
                {"decision":"VISUAL_SUCCESS","advance_research":True,"financially_verified":False,"checkout_changed":False}))
            page.goto(base+"/checkout/fixture?vision_lab=1&diagnostic_lab=1")
            page.get_by_role("img",name="Receipt analysis").wait_for()
            assert page.get_by_role("button",name="Start local trace").count()==0
            assert page.get_by_text("Agentic Vision · Research",exact=True).count()==0
            page.get_by_label("Payment image",exact=True).set_input_files({"name":"fixture.png","mimeType":"image/png","buffer":b"synthetic UI fixture"})
            page.get_by_role("button",name="Analyze payment image").click()
            page.get_by_text("Visual payment success recognized. Research analysis complete.",exact=True).wait_for()
            assert page.get_by_role("button",name="I Paid").is_enabled()
            browser.close()
    finally:
        server.shutdown();server.server_close();worker.join()

if __name__=="__main__":
    main()
