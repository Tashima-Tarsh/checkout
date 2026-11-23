#!/bin/sh
set -eu
cd "$(dirname "$0")"
python -m pip install -r requirements.txt
PDEP_DEMO_MODE=1 python -m uvicorn checkout.server:app --host 127.0.0.1 --port 8000
