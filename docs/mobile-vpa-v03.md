# PDEP v0.3 — mobile bridge, VPA routing and IP access

## Mobile callback
The browser records a payment launch attempt and, **only after observing a page-hide**, attempts a return observation when it becomes visible. Browser resume is not a UPI app payment-success event. Same-device returns are best effort. On desktop, QR payment happens on a different device and cannot be detected from the desktop browser alone.

## Routes
Only an administrator can upload the routing inventory. A route_key selects the lowest priority enabled VPA of the matching mode (ties sorted by row ID). The chosen VPA is fixed in the payment session before the UPI URI or QR appears. The payee is displayed to the customer. MCC is optional for P2M and prohibited for P2P.

Import CSV or XLSX (columns route_key,mode,vpa,mcc,priority,enabled; max 500 rows and 1 MB). Each import **atomically replaces** inventory. Do not upload untrusted payee lists or accept customer-specified routing destinations as authoritative merchant configuration.

## Administrative IP security
Set PDEP_ADMIN_TOKEN to a secret of 32+ characters and PDEP_ADMIN_IP_ALLOWLIST to operator CIDRs. Admin endpoints are disabled if either is unset. By default the immediate connection IP is used; X-Forwarded-For is ignored, preventing attacker-selected IP spoofing. If the application is behind a known proxy, set PDEP_TRUSTED_PROXY_CIDRS accurately and use only an infrastructure-guaranteed forwarded-header chain. Never configure a broad trusted proxy range or the internet wildcard. An IP whitelist is additional protection, not authentication.

Example:
`PDEP_ADMIN_IP_ALLOWLIST=203.0.113.15/32`
`PDEP_ADMIN_TOKEN=<generated 32+ character secret>`

Upload:
`curl -X POST -H "Authorization: Bearer $PDEP_ADMIN_TOKEN" -F "file=@routes.xlsx" https://YOUR-DOMAIN/api/admin/vpas/import`

**Do not deploy these examples as real values.** When testing locally, allowlist your actual network IP.

## Security boundary
Client browser return, forged UTR, spoofed callbacks, rooted device claims and synthetic Ed25519 issuer fixtures never produce financially_verified=true. No real payer-side authenticated debit proof source has been integrated.
