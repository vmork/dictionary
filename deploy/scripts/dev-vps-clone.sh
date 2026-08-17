#!/usr/bin/env bash
set -euo pipefail

dictionary_ssh_host="${DICTIONARY_VPS_SSH_HOST:-hetzner-helsinki}"
dictionary_tunnel_port="${DICTIONARY_VPS_DB_PORT:-55432}"
dictionary_prepare_only=false
dictionary_migrate=false
dictionary_verify_deploy=false
dictionary_test_port="${DICTIONARY_DEPLOY_TEST_PORT:-3003}"
dictionary_app_pid=""
dictionary_app_log=""

for dictionary_argument in "$@"; do
  case "$dictionary_argument" in
    --) ;;
    --prepare-only) dictionary_prepare_only=true ;;
    --migrate) dictionary_migrate=true ;;
    --verify-deploy) dictionary_verify_deploy=true ;;
    *)
      echo "Unknown option: $dictionary_argument" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$dictionary_tunnel_port" =~ ^[0-9]+$ ]] || (( dictionary_tunnel_port < 1024 || dictionary_tunnel_port > 65535 )); then
  echo "DICTIONARY_VPS_DB_PORT must be a number between 1024 and 65535" >&2
  exit 1
fi

if ! [[ "$dictionary_test_port" =~ ^[0-9]+$ ]] || (( dictionary_test_port < 1024 || dictionary_test_port > 65535 )); then
  echo "DICTIONARY_DEPLOY_TEST_PORT must be a number between 1024 and 65535" >&2
  exit 1
fi

if [[ "$dictionary_prepare_only" == true && "$dictionary_verify_deploy" == true ]]; then
  echo "--prepare-only and --verify-deploy cannot be used together" >&2
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
export DICTIONARY_ENABLE_DEV_ACCOUNT=1
export DICTIONARY_DEV_EMAIL="${DICTIONARY_DEV_EMAIL:-codex-dev@dictionary.invalid}"
export DICTIONARY_DEV_NAME="${DICTIONARY_DEV_NAME:-Codex development}"
export DICTIONARY_DEV_PASSWORD="${DICTIONARY_DEV_PASSWORD:-$(openssl rand -hex 18)}"

if nc -z 127.0.0.1 "$dictionary_tunnel_port" 2>/dev/null; then
  echo "Local port $dictionary_tunnel_port is already in use; refusing to attach to an unowned tunnel" >&2
  exit 1
fi

ssh -N \
  -o ExitOnForwardFailure=yes \
  -L "127.0.0.1:${dictionary_tunnel_port}:127.0.0.1:5432" \
  "$dictionary_ssh_host" &
dictionary_tunnel_pid=$!

cleanup_dictionary_tunnel() {
  if [[ -n "$dictionary_app_pid" ]]; then
    kill "$dictionary_app_pid" 2>/dev/null || true
    wait "$dictionary_app_pid" 2>/dev/null || true
  fi
  kill "$dictionary_tunnel_pid" 2>/dev/null || true
  wait "$dictionary_tunnel_pid" 2>/dev/null || true
  if [[ -n "$dictionary_app_log" ]]; then
    rm -f "$dictionary_app_log"
  fi
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

dictionary_database_snapshot() {
  psql "$DATABASE_URL" --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
    SELECT json_build_object(
      'collections', (SELECT count(*) FROM collections),
      'words', (SELECT count(*) FROM words),
      'users', (SELECT count(*) FROM auth_users),
      'dict_entries_not_objects', (
        SELECT count(*) FROM words WHERE jsonb_typeof(dict_entry) IS DISTINCT FROM 'object'
      ),
      'practice_data_not_objects', (
        SELECT count(*) FROM words WHERE jsonb_typeof(practice_data) IS DISTINCT FROM 'object'
      )
    )::text
  " | tr -d '\n'
}

if [[ "$dictionary_migrate" == true ]]; then
  dictionary_before_migration="$(dictionary_database_snapshot)"
  echo "Clone before migration: $dictionary_before_migration"
  pnpm db:migrate
  dictionary_after_migration="$(dictionary_database_snapshot)"
  echo "Clone after migration:  $dictionary_after_migration"
  if [[ "$dictionary_before_migration" != "$dictionary_after_migration" ]]; then
    echo "Database row or JSON-shape invariants changed during the clone migration" >&2
    exit 1
  fi
fi

pnpm exec tsx src/app/scripts/prepareDevelopmentAccount.ts
echo "Development sign-in:"
echo "  Email: $DICTIONARY_DEV_EMAIL"
echo "  Password: $DICTIONARY_DEV_PASSWORD"

if [[ "$dictionary_prepare_only" == true ]]; then
  exit 0
fi

if [[ "$dictionary_verify_deploy" == true ]]; then
  dictionary_owner_counts="$({
    psql "$DATABASE_URL" --no-psqlrc --tuples-only --no-align --field-separator='|' \
      --set ON_ERROR_STOP=1 --set "dev_email=$DICTIONARY_DEV_EMAIL" <<'SQL'
        SELECT count(DISTINCT c.id), count(w.id)
        FROM auth_users u
        LEFT JOIN collections c ON c.owner_id = u.id
        LEFT JOIN words w ON w.collection_id = c.id
        WHERE lower(u.email) = lower(:'dev_email')
SQL
  } | tr -d '[:space:]')"
  IFS='|' read -r dictionary_expected_collections dictionary_expected_words <<< "$dictionary_owner_counts"
  if [[ -z "$dictionary_expected_collections" || -z "$dictionary_expected_words" ]]; then
    echo "Could not determine development-owner row counts" >&2
    exit 1
  fi

  export BETTER_AUTH_URL="http://127.0.0.1:${dictionary_test_port}"
  dictionary_app_log="$(mktemp -t dictionary-deploy-rehearsal.XXXXXX)"
  pnpm start --hostname 127.0.0.1 --port "$dictionary_test_port" >"$dictionary_app_log" 2>&1 &
  dictionary_app_pid=$!

  dictionary_app_ready=false
  for dictionary_attempt in {1..30}; do
    if curl --silent --fail --output /dev/null "$BETTER_AUTH_URL/sign-in"; then
      dictionary_app_ready=true
      break
    fi
    if ! kill -0 "$dictionary_app_pid" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  if [[ "$dictionary_app_ready" != true ]]; then
    echo "The rehearsal application did not become ready" >&2
    cat "$dictionary_app_log" >&2
    exit 1
  fi

  AUTH_TEST_BASE_URL="$BETTER_AUTH_URL" \
    AUTH_TEST_OWNER_EMAIL="$DICTIONARY_DEV_EMAIL" \
    AUTH_TEST_OWNER_PASSWORD="$DICTIONARY_DEV_PASSWORD" \
    AUTH_TEST_EXPECT_OWNER_COLLECTIONS="$dictionary_expected_collections" \
    AUTH_TEST_EXPECT_OWNER_WORDS="$dictionary_expected_words" \
    pnpm test:auth-isolation
  echo "Deployment rehearsal passed against dictionary_local_dev."
  exit 0
fi

pnpm dev
