"""PDEP: Real Chromium cross-tab visibility negative-control experiment.

Runs actual browser engine event handling, never launches a payment app.
Its purpose is to quantify what a legitimate app-switch-like trace reveals.
No fake physical-device or actual debit claims.
"""
import json
from playwright.sync_api import sync_playwright

EVENT_HOOK = """() => {
  window.pdepEvents = [];
  document.addEventListener('visibilitychange', () => {
    window.pdepEvents.push({kind:'visibilitychange', visible:!document.hidden});
  });
  window.addEventListener('pagehide', () => {
    window.pdepEvents.push({kind:'pagehide'});
  });
  window.addEventListener('pageshow', () => {
    window.pdepEvents.push({kind:'pageshow'});
  });
}"""

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True)
    context=browser.new_context()
    main=context.new_page()
    main.goto("http://127.0.0.1:8080/")
    main.evaluate(EVENT_HOOK)

    # The exact same checkout tab survives an app-like interruption.
    # An unrelated second tab is enough to generate misleading lifecycle
    # signals. This case has no UPI app and no debit, by construction.
    alternate=context.new_page()
    alternate.goto("http://127.0.0.1:8080/")
    alternate.bring_to_front()
    main.wait_for_timeout(300)
    alternate.close()
    main.bring_to_front()
    main.wait_for_timeout(300)
    events=main.evaluate("window.pdepEvents")
    visible=main.evaluate("document.visibilityState")

    assert visible == 'visible'
    result={
       'test':'real_chromium_background_foreground_without_payment',
       'engine':'Chromium headless',
       'events':events,
       'finalVisibility':visible,
       'actualUPIAppUsed':False,
       'actualDebitOccurred':False,
       'debitVerified':False,
       'observation':'Browsing behavior alone is not financial evidence'
    }
    with open('browser-visibility-negative-control.json','w',encoding='utf-8') as fp:
        json.dump(result,fp,indent=2)
    print(json.dumps(result,indent=2))
    browser.close()
