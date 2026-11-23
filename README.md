# PDEP browser UPI checkout

P2P personal-to-personal and P2M personal-to-merchant UPI payment initiation, automatic QR rendering, browser return observations, and simulated debit-evidence research.

**Experimental only.** Financially verified is always false. A customer callback, UTR, screenshot, or simulated signature does not attest a real bank debit.

## Start
Python 3.10+:
```sh
python -m pip install -r requirements-dev.txt
python -m pytest -q
PDEP_DEMO_MODE=1 python -m uvicorn checkout.server:app --host 127.0.0.1 --port 8000
```
Then open http://127.0.0.1:8000. On Windows run `start-demo.bat`.

## Layout
- `checkout/`: frontend and FastAPI payment session backend
- `pdep/`: cryptographic research verifier, **synthetic issuer only**
- `tests/`: protocol and API tests
- `research/`: experimental methodology and runnable adversarial tests
- `docs/`: trust model and evidence requirements

Research guidance: Karpathy Autoresearch, andrej-karpathy-skills, Orchestra Research AI-research-SKILLs, android/skills, and loop-engineer. None of these skill runners is bundled or executing automatically.

## Railway staging

Deploy the repository root with the included Dockerfile. Create a dedicated PostgreSQL
service in the staging environment and reference its private service variable as
`DATABASE_URL` on the application, e.g. `${{Postgres.DATABASE_URL}}`. Configure
`/healthz` as the deployment health check. The container runs the Alembic migration
and then binds to `0.0.0.0:$PORT`. Keep one replica during migrations.
Production uses the same image and an independent database after staging acceptance.
Roll back using the previous healthy Railway deployment. Take a database backup
before schema changes and rehearse restoration before promoting production.

Session-scoped bearer credentials are returned at creation, held in browser memory,
and sent in Authorization headers. The QR image is fetched with the same header.
A local SQLite scratch database is still available without deployed environment
flags. The previous prototype's SQLite file is not imported because its bearer
credentials were stored in plaintext. Deployed containers require PostgreSQL
and disable synthetic receipt issuance. Session creation is capped at 60 requests per minute across the application.
Set a deployment-specific access and data retention policy before sharing staging.

Before promotion, confirm the CI workflow, staging health, database persistence,
and browser smoke tests. Actual UPI app compatibility needs physical-device
testing. Do not send money during automated checks.
