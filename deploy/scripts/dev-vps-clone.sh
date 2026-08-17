#!/usr/bin/env bash
set -euo pipefail

dictionary_ssh_host="${DICTIONARY_VPS_SSH_HOST:-hetzner-helsinki}"
dictionary_tunnel_port="${DICTIONARY_VPS_DB_PORT:-55432}"

if ! [[ "$dictionary_tunnel_port" =~ ^[0-9]+$ ]] || (( dictionary_tunnel_port < 1024 || dictionary_tunnel_port > 65535 )); then
  echo "DICTIONARY_VPS_DB_PORT must be a number between 1024 and 65535" >&2
  exit 1
fi

dictionary_remote_url="$(
  ssh "$dictionary_ssh_host" \
    "node --env-file=/etc/dictionary.env -e 'process.stdout.write(process.env.DATABASE_URL)'"
)"

export DATABASE_URL="$(
  DATABASE_URL="$dictionary_remote_url" DICTIONARY_VPS_DB_PORT="$dictionary_tunnel_port" node -e '
    const url = new URL(process.env.DATABASE_URL)
    url.hostname = "127.0.0.1"
    url.port = process.env.DICTIONARY_VPS_DB_PORT
    url.pathname = "/dictionary_local_dev"
    process.stdout.write(url.toString())
  '
)"
unset dictionary_remote_url

export DATABASE_POOL_SIZE=5
export AUTH_DATABASE_POOL_SIZE=5
export BETTER_AUTH_URL=http://localhost:3000
export BETTER_AUTH_SECRET="${BETTER_AUTH_LOCAL_SECRET:-$(openssl rand -base64 32)}"
export BETTER_AUTH_SECURE_COOKIES=false

ssh -N \
  -o ExitOnForwardFailure=yes \
  -L "127.0.0.1:${dictionary_tunnel_port}:127.0.0.1:5432" \
  "$dictionary_ssh_host" &
dictionary_tunnel_pid=$!

cleanup_dictionary_tunnel() {
  kill "$dictionary_tunnel_pid" 2>/dev/null || true
  wait "$dictionary_tunnel_pid" 2>/dev/null || true
}
trap cleanup_dictionary_tunnel EXIT INT TERM

for dictionary_attempt in {1..20}; do
  if nc -z 127.0.0.1 "$dictionary_tunnel_port" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$dictionary_tunnel_pid" 2>/dev/null; then
    echo "The SSH database tunnel stopped unexpectedly" >&2
    exit 1
  fi
  sleep 0.25
done

if ! nc -z 127.0.0.1 "$dictionary_tunnel_port" 2>/dev/null; then
  echo "Timed out waiting for the SSH database tunnel" >&2
  exit 1
fi

echo "Using the isolated VPS development database through an SSH tunnel."
echo "Changes made in this session do not affect production."
pnpm dev
