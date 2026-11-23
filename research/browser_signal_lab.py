"""PDEP executable browser capability measurements.

Real Playwright Chromium, not synthetic JS mocks. Device presets modify UA /
viewport only and must never be represented as physical UPI apps.
"""
import json
from playwright.sync_api import sync_playwright

JS = """() => ({
  secureContext: isSecureContext,
  visibilityState: document.visibilityState,
  paymentRequest: typeof PaymentRequest === 'function',
  clipboardRead: typeof navigator.clipboard?.readText === 'function',
  webShare: typeof navigator.share === 'function',
  displayCapture: typeof navigator.mediaDevices?.getDisplayMedia === 'function',
  userAgent: navigator.userAgent,
  userActivation: navigator.userActivation?.isActive ?? null,
})"""

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    scenarios = [
        ("desktop-chromium", {}),
        ("pixel7-emulated-chromium", pw.devices["Pixel 7"]),
        ("iphone13-emulated-chromium-NOT-iOS-WebKit", pw.devices["iPhone 13"]),
    ]
    results = []
    for name, options in scenarios:
        context = browser.new_context(**options)
        page = context.new_page()
        page.goto("http://127.0.0.1:8080/")
        caps = page.evaluate(JS)
        # Crucial: the actual browser execution, not a mocked API flag.
        events = []
        page.expose_function("pdepRecord", lambda event: events.append(event))
        page.evaluate("""() => {
          document.addEventListener('visibilitychange', () => window.pdepRecord('visibilitychange'));
          window.addEventListener('pagehide', () => window.pdepRecord('pagehide'));
          window.addEventListener('pageshow', () => window.pdepRecord('pageshow'));
        }""")
        page.evaluate("window.dispatchEvent(new Event('pagehide'))")
        page.evaluate("window.dispatchEvent(new Event('pageshow'))")
        page.wait_for_timeout(50)
        assert events == ["pagehide", "pageshow"], (name, events)
        assert caps["secureContext"] is True
        # A debit verdict MUST NOT be set from browser events or capability flags.
        results.append({
            "scenario": name, "capabilities": caps,
            "simulatedLifecycleEvents": events,
            "realPaymentMade": False,
            "physicalDevice": False,
            "debitVerified": False
        })
        context.close()
    browser.close()

with open("browser-signal-lab.json", "w", encoding="utf-8") as file:
    json.dump({"kind": "PDEP_BROWSER_CAPABILITIES_ONLY", "results": results}, file, indent=2)
print(json.dumps(results, indent=2))
