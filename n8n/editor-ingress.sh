#!/bin/sh
set -eu

if [ -n "${AGENTIC_EDITOR_TUNNEL_TOKEN:-}" ]; then
  config_dir="$(mktemp -d)"
  cat > "$config_dir/Caddyfile" <<'CADDY'
{
  admin off
  auto_https off
}

http://:5680 {
  bind 127.0.0.1
  @dispatch path_regexp dispatch (?i)^/(webhook[^/]*|form[^/]*|mcp[^/]*)(/|$)
  respond @dispatch "Not found" 404
  reverse_proxy 127.0.0.1:5678 {
    header_up X-Forwarded-Proto https
  }
}
CADDY
  caddy validate --config "$config_dir/Caddyfile" --adapter caddyfile
  caddy run --config "$config_dir/Caddyfile" --adapter caddyfile &
  TUNNEL_TOKEN="$AGENTIC_EDITOR_TUNNEL_TOKEN" cloudflared tunnel --no-autoupdate run &
  unset AGENTIC_EDITOR_TUNNEL_TOKEN
fi

exec /docker-entrypoint.sh "$@"
