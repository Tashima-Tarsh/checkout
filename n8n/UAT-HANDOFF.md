# n8n single-account UAT handoff
The canonical token is AGENTIC_N8N_TOKEN, as used by bootstrap.mjs. N8N_TOKEN is not read by that bootstrap. Do not rotate the encryption key or print/export credential contents.

## Live preflight
On the private n8n container, inspect EXECUTIONS_MODE and the presence of the canonical environment variable without printing secrets. Run `node /opt/agentic-pay/preflight.mjs` after deploying this optional diagnostic, or run the reviewed script from the repository in the existing container. It probes only the current two-node PENDING dispatch workflow with synthetic identifiers; confirm this workflow has no financial side effects before running. A 200 correlated PENDING and unauthorized 401/403 establish dispatch, not settlement.

If canonical authentication fails, compare the two service environment values securely, then use the existing n8n administrator credential editor to synchronize the bound Header Auth credential and Agentic Pay caller token in a coordinated maintenance window. Do not reimport or republish blindly. Verify from the actual Agentic Pay service too. The preflight cannot prove caller-side configuration.

## Admin access
Prefer Railway private SSH forwarding if available. If unavailable, use an approved HTTPS identity-gated reverse proxy to the private n8n service. Configure the gate before creating public ingress; no direct public origin or first-run setup exposure. Restrict access to the designated administrator, support editor WebSockets, deny public webhook and webhook-test paths, and test unauthenticated denial before owner registration. Keep internal dispatch unchanged. User enters owner credentials directly. Do not expose secrets or reset the existing database.

## MyUPI
Manual login in a separate browser does not authenticate n8n. No approved evidence connector is supplied by this repository change. Do not automate access without required authorization or transfer browser cookies. Keep AUTH_REQUIRED/PENDING until supported by genuine evidence and existing backend contracts.
