# PDEP browser UPI checkout

P2P personal-to-personal and P2M personal-to-merchant UPI payment initiation, automatic QR rendering, browser return observations, and simulated debit-evidence research.

**Experimental only.** Financially verified is always false. A customer callback, UTR, screenshot, or simulated signature does not attest a real bank debit.

## Start
Python 3.10+:
```sh
python -m pip install -r requirements.txt
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
