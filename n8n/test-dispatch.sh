#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mode=${1:-queue}
compose() {
  if [ "$mode" = regular ]; then
    docker compose -f compose.ci.yml -f compose.regular-ci.yml "$@"
  else
    docker compose -f compose.ci.yml "$@"
  fi
}
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then compose logs --tail=80; fi
  compose down -v
  exit "$status"
}
trap cleanup EXIT
mkdir -p ci-import
token=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')
export TEST_WEBHOOK_TOKEN="$token"
python - <<'PY'
import json
import os
from pathlib import Path

directory = Path('ci-import')
credential = {
    'id': 'AgenticPayDispatchHeader',
    'name': 'Agentic Pay dispatch bearer',
    'type': 'httpHeaderAuth',
    'data': {'name': 'Authorization', 'value': 'Bearer ' + os.environ['TEST_WEBHOOK_TOKEN']},
}
workflow = json.loads(Path('agentic-pay-dispatch.json').read_text())
workflow['nodes'][0]['credentials'] = {
    'httpHeaderAuth': {'id': credential['id'], 'name': credential['name']},
}
(directory / 'credential.json').write_text(json.dumps([credential]))
(directory / 'workflow.json').write_text(json.dumps(workflow))
PY
compose run --rm main import:credentials --input=/imports/credential.json
compose run --rm main import:workflow --input=/imports/workflow.json
compose run --rm main publish:workflow --id=AgenticPayDispatch
if [ "$mode" = regular ]; then
  compose up -d main
else
  compose up -d main worker
fi
root=http://127.0.0.1:5678
curl -fsS --retry 30 --retry-all-errors --retry-delay 2 "$root/healthz"
endpoint="$root/webhook/agentic-pay-dispatch"
body='{"order_id":"fixture-order","account_id":"fixture-account"}'
for attempt in $(seq 1 30); do
  code=$(curl -sS --max-time 4 -o "$RUNNER_TEMP/n8n-unauthorized.json" -w '%{http_code}' \
    -H 'Content-Type: application/json' -d "$body" "$endpoint")
  case "$code" in
    401|403) break ;;
    404) sleep 2 ;;
    *) echo "Unexpected unauthenticated status $code"; exit 1 ;;
  esac
done
case "$code" in
  401|403) echo "Unauthenticated webhook rejected with $code" ;;
  *) cat "$RUNNER_TEMP/n8n-unauthorized.json"; exit 1 ;;
esac
curl -fsS --max-time 30 -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d "$body" "$endpoint" \
  | python -c 'import json,sys; assert json.load(sys.stdin) == {"order_id":"fixture-order","status":"PENDING"}'
echo "Authenticated webhook returned a correlated PENDING acknowledgment"
