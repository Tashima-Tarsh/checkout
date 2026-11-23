"""Run against an already started checkout with no real payment."""
import os
from playwright.sync_api import expect, sync_playwright

with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    for mobile in (False, True):
        options = playwright.devices["Pixel 7"] if mobile else {}
        page = browser.new_page(**options)
        page.goto(os.getenv("CHECKOUT_URL", "http://127.0.0.1:8080"))
        page.locator("#mode").select_option("P2M" if mobile else "P2P")
        if mobile:
            page.locator("#mcc").fill("5411")
        page.locator("#vpa").fill("test@upi")
        page.locator("#name").fill("Research recipient")
        page.locator("#amount").fill("1.25")
        page.get_by_role("button", name="Create checkout").click()
        expect(page.locator("#qr")).to_be_visible()
        page.wait_for_function("document.querySelector('#qr').naturalWidth > 0")
        uri = page.locator("#launch").get_attribute("href")
        assert uri.startswith("upi://pay?") and "am=1.25" in uri
        assert ("mc=5411" in uri) == mobile
        page.locator("#claim").click()
        expect(page.locator("#state")).to_contain_text("Debit unverified")
        expect(page.locator("#state")).to_contain_text("PAYER CLAIMED SUCCESS")
        page.close()
    browser.close()
