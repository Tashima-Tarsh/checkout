"""Browser-level checkout smoke tests (emulators, NO UPI app or real payment)."""
import os
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    configurations = [
        ("P2P", {}),
        ("P2P", playwright.devices["Pixel 7"]),
        ("P2M", playwright.devices["Pixel 7"]),
        # Chromium emulating an iPhone viewport is NOT an iOS WebKit test.
        ("P2P", playwright.devices["iPhone 13"]),
    ]
    for mode, options in configurations:
        page = browser.new_page(**options)
        page.goto(os.getenv("CHECKOUT_URL", "http://127.0.0.1:8080"))
        expect(page.get_by_role("heading", name="Make a payment")).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.locator("#mode").select_option(mode)
        if mode == "P2M":
            page.locator("#mcc").fill("5411")
        page.locator("#vpa").fill("test@upi")
        page.locator("#name").fill("Research recipient")
        page.locator("#amount").fill("1.00")
        page.get_by_role("button", name="Create secure checkout").click()
        expect(page.locator("#qr")).to_be_visible()
        expect(page.get_by_role("button", name="Copy UPI ID")).to_be_enabled()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.wait_for_function("document.querySelector('#qr').naturalWidth > 0")
        uri = page.locator("#launch").get_attribute("href")
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
        # A fake launch and browser return must only produce an observation.
        # Prevent external UPI navigation; this intentionally does NOT launch an app.
        page.locator("#launch").evaluate(
            "(el) => {el.addEventListener('click', e => e.preventDefault(), {once:true}); el.click();}"
        )
        page.evaluate("window.dispatchEvent(new Event('pagehide'))")
        page.evaluate("window.dispatchEvent(new Event('pageshow'))")
        expect(page.locator("#state")).to_contain_text("Debit unverified")
        page.locator("#claim").click()
        expect(page.locator("#state")).to_contain_text("Debit unverified")
        expect(page.locator("#state")).to_contain_text("PAYER CLAIMED SUCCESS")
        page.close()
    # Public opt-in PDEP lab must load its real JS modules from the same origin.
    # This proves the test page is deployable; it does NOT emulate a UPI app.
    lab = browser.new_page()
    base = os.getenv("CHECKOUT_URL", "http://127.0.0.1:8080").rstrip("/")
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
