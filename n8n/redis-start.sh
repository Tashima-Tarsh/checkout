#!/bin/sh
set -eu
case "$AGENTIC_REDIS_PASSWORD" in
  *[!A-Za-z0-9_-]*|'') exit 1 ;;
esac
[ "$(printf '%s' "$AGENTIC_REDIS_PASSWORD" | wc -c)" -ge 43 ]
umask 077
{
  printf 'bind * -::*\n'
  printf 'protected-mode yes\n'
  printf 'requirepass %s\n' "$AGENTIC_REDIS_PASSWORD"
  printf 'appendonly yes\n'
  printf 'maxmemory-policy noeviction\n'
  printf 'dir /data\n'
} > /tmp/agentic-redis.conf
chown redis:redis /tmp/agentic-redis.conf
exec docker-entrypoint.sh redis-server /tmp/agentic-redis.conf
