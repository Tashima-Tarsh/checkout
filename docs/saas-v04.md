# PDEP SaaS dashboard v0.4

This is an **operator-owned configuration dashboard** for the existing deployment.
It is not a multi-tenant billing or settlement platform.

## Dashboard

At `/admin`, authenticate with a configured administrator token.
Access also requires your IP to be allowlisted by `PDEP_ADMIN_IP_ALLOWLIST`.
The token is never persisted in browser storage. Do not share it with customers.

- Operational KPIs: total/active checkout sessions, observed events, configured VPA routes.
- Appearance: choose a vetted dynamic accent, light/midnight/aurora palette, payee-facing brand and heading.
- Bulk import: authenticated CSV/XLSX recipient routing; imports atomically replace routing inventory.

The public checkout reads sanitized appearance from `GET /api/appearance`.
Do not use these appearance settings as proof of merchant identity or payment authenticity.

## Payer mobile return

A same-browser handoff attempt can be followed by a lifecycle observation
(`visibilitychange` / `pagehide` and return). This is **not** a UPI
application-signed callback: the payer can manipulate their browser.
The API records deduplicated observations and always reports
`financially_verified: false`. Returning to the checkout never triggers
merchant fulfillment. QR-based, cross-device payments do not automatically
report a result to the originating browser.

## Data model and rollout

Alembic `0003_appearance` adds one new table. Existing checkout sessions,
receipts, events and VPA routes are unchanged. Test migration in CI before
deploying. Keep your existing Railway database and domain. Do not deploy
without verifying the configured PostgreSQL DATABASE_URL and admin access.

## Boundaries

No payment result can be inferred from screenshots, payer-entered UTRs,
browser callbacks or payer-generated cryptographic signatures. An authenticated
device-local event is still a device observation, not proof of money movement.
