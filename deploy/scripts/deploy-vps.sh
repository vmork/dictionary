#!/usr/bin/env bash
set -euo pipefail

umask 077

dictionary_ssh_host="${DICTIONARY_VPS_SSH_HOST:-hetzner-helsinki}"
dictionary_public_url="${DICTIONARY_PUBLIC_URL:-https://dictionary.vmork.com}"
dictionary_offsite_backup_dir="${DICTIONARY_OFFSITE_BACKUP_DIR:-${TMPDIR:-/tmp}/dictionary-deploy-backups}"
dictionary_expected_branch="${DICTIONARY_DEPLOY_BRANCH:-main}"
dictionary_deploy=false
dictionary_rehearse_only=false
dictionary_skip_rehearsal=false
dictionary_allow_dirty=false

usage() {
  cat <<'EOF'
Usage:
  pnpm deploy:vps -- --rehearse-only
  pnpm deploy:vps -- --deploy [--allow-dirty] [--skip-rehearsal]

Options:
  --deploy             Rehearse, back up, and deploy to production.
  --rehearse-only      Run local checks and isolated-clone verification only.
  --skip-rehearsal     Deploy without repeating the rehearsal in this run.
  --allow-dirty        Include uncommitted working-tree changes in the release.
  --host HOST          Override the SSH host (default: hetzner-helsinki).
  --backup-dir PATH    Local directory for the verified off-server backup.
EOF
}

while (($# > 0)); do
  case "$1" in
    --)
      ;;
    --deploy)
      dictionary_deploy=true
      ;;
    --rehearse-only)
      dictionary_rehearse_only=true
      ;;
    --skip-rehearsal)
      dictionary_skip_rehearsal=true
      ;;
    --allow-dirty)
      dictionary_allow_dirty=true
      ;;
    --host)
      shift
      dictionary_ssh_host="${1:-}"
      ;;
    --backup-dir)
      shift
      dictionary_offsite_backup_dir="${1:-}"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [[ "$dictionary_deploy" == false && "$dictionary_rehearse_only" == false ]]; then
  usage >&2
  exit 2
fi
if [[ "$dictionary_deploy" == true && "$dictionary_rehearse_only" == true ]]; then
  echo "Choose either --deploy or --rehearse-only" >&2
  exit 2
fi
if [[ -z "$dictionary_ssh_host" || -z "$dictionary_offsite_backup_dir" ]]; then
  echo "The SSH host and backup directory must not be empty" >&2
  exit 2
fi

for dictionary_command in git pnpm ssh rsync scp pg_restore shasum; do
  if ! command -v "$dictionary_command" >/dev/null 2>&1; then
    echo "Required command is missing: $dictionary_command" >&2
    exit 1
  fi
done

dictionary_repo_root="$(git rev-parse --show-toplevel)"
cd "$dictionary_repo_root"

dictionary_branch="$(git branch --show-current)"
if [[ "$dictionary_branch" != "$dictionary_expected_branch" ]]; then
  echo "Refusing to deploy branch '$dictionary_branch'; expected '$dictionary_expected_branch'" >&2
  exit 1
fi

dictionary_commit="$(git rev-parse --short=12 HEAD)"
dictionary_dirty=false
if [[ -n "$(git status --short)" ]]; then
  dictionary_dirty=true
  if [[ "$dictionary_allow_dirty" != true ]]; then
    echo "The working tree is dirty. Commit the release or pass --allow-dirty explicitly." >&2
    git status --short >&2
    exit 1
  fi
fi

run_rehearsal() {
  echo "==> Installing locked dependencies"
  pnpm install --frozen-lockfile
  echo "==> Generating Next.js route types"
  pnpm exec next typegen
  echo "==> Type-checking"
  pnpm exec tsc --noEmit
  echo "==> Linting"
  pnpm lint
  echo "==> Testing etymology parsing"
  pnpm test:etymology-tree
  echo "==> Building the production bundle with webpack"
  pnpm exec next build --webpack
  echo "==> Rehearsing migrations and authenticated flows on dictionary_local_dev"
  pnpm dev:vps -- --migrate --verify-deploy
}

if [[ "$dictionary_skip_rehearsal" != true ]]; then
  run_rehearsal
fi
if [[ "$dictionary_rehearse_only" == true ]]; then
  echo "Rehearsal completed; production was not changed."
  exit 0
fi

dictionary_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dictionary_release_label="${dictionary_timestamp}-${dictionary_commit}"
if [[ "$dictionary_dirty" == true ]]; then
  dictionary_release_label="${dictionary_release_label}-dirty"
fi
dictionary_remote_staging="/srv/dictionary/releases/staging-${dictionary_release_label}"
dictionary_remote_backup="/var/backups/dictionary/dictionary-pre-${dictionary_release_label}.dump"
dictionary_local_backup="${dictionary_offsite_backup_dir}/$(basename "$dictionary_remote_backup")"

echo "==> Checking the production host"
ssh "$dictionary_ssh_host" bash -s -- "$dictionary_release_label" <<'REMOTE_PREFLIGHT'
set -euo pipefail
release_label="$1"
[[ "$release_label" =~ ^[A-Za-z0-9._-]+$ ]]

for command in caddy curl node pg_dump pg_restore pnpm psql rsync runuser systemctl; do
  command -v "$command" >/dev/null
done
test -d /srv/dictionary/app
test -f /etc/dictionary.env
test "$(stat -c '%a' /etc/dictionary.env)" = "600"
systemctl is-active --quiet dictionary.service
systemctl is-active --quiet caddy
systemctl is-active --quiet dictionary-backup.timer
caddy validate --config /etc/caddy/Caddyfile >/dev/null

staging="/srv/dictionary/releases/staging-${release_label}"
previous="/srv/dictionary/releases/pre-${release_label}"
failed="/srv/dictionary/releases/failed-${release_label}"
test ! -e "$staging"
test ! -e "$previous"
test ! -e "$failed"
install -d -m 0755 -o dictionary -g dictionary "$staging"
REMOTE_PREFLIGHT

echo "==> Uploading source to the isolated staging release"
rsync --archive --compress --delete \
  --exclude '.git/' \
  --exclude '.next/' \
  --exclude 'node_modules/' \
  --exclude '.pnpm-store/' \
  --exclude '.codex/' \
  --exclude '.agents/' \
  --include '.env.example' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'tsconfig.tsbuildinfo' \
  --exclude '*.dump' \
  "$dictionary_repo_root/" "$dictionary_ssh_host:$dictionary_remote_staging/"

echo "==> Installing dependencies and building on the VPS"
ssh "$dictionary_ssh_host" bash -s -- "$dictionary_release_label" <<'REMOTE_BUILD'
set -euo pipefail
release_label="$1"
[[ "$release_label" =~ ^[A-Za-z0-9._-]+$ ]]
staging="/srv/dictionary/releases/staging-${release_label}"

chown -R dictionary:dictionary "$staging"
runuser -u dictionary -- env HOME=/srv/dictionary pnpm --dir "$staging" install --frozen-lockfile
runuser -u dictionary -- env HOME=/srv/dictionary pnpm --dir "$staging" build
test -s "$staging/.next/BUILD_ID"
REMOTE_BUILD

echo "==> Taking and validating the production database backup"
ssh "$dictionary_ssh_host" bash -s -- "$dictionary_release_label" <<'REMOTE_BACKUP'
set -euo pipefail
release_label="$1"
[[ "$release_label" =~ ^[A-Za-z0-9._-]+$ ]]
backup="/var/backups/dictionary/dictionary-pre-${release_label}.dump"
metadata="/srv/dictionary/releases/${release_label}.before"

umask 077

test ! -e "$backup"
install -d -m 0700 -o postgres -g postgres /var/backups/dictionary
runuser -u postgres -- pg_dump --format=custom --file="$backup" dictionary
chmod 0600 "$backup"
runuser -u postgres -- pg_restore --list "$backup" >/dev/null

counts="$(runuser -u postgres -- psql -d dictionary --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  SELECT json_build_object(
    'collections', (SELECT count(*) FROM collections),
    'words', (SELECT count(*) FROM words),
    'users', (SELECT count(*) FROM auth_users)
  )::text
" | tr -d '\n')"
invalid_shapes="$(runuser -u postgres -- psql -d dictionary --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  SELECT
    (SELECT count(*) FROM words WHERE jsonb_typeof(dict_entry) IS DISTINCT FROM 'object') +
    (SELECT count(*) FROM words WHERE jsonb_typeof(practice_data) IS DISTINCT FROM 'object')
" | tr -d '[:space:]')"
test "$invalid_shapes" = "0"

{
  printf 'backup=%s\n' "$backup"
  printf 'counts=%s\n' "$counts"
  printf 'migrations=' 
  runuser -u postgres -- psql -d dictionary --no-psqlrc --tuples-only --no-align \
    --command "SELECT name FROM schema_migrations ORDER BY name" | paste -sd, -
} > "$metadata"
chmod 0600 "$metadata"
printf 'Production before deployment: %s\n' "$counts"
REMOTE_BACKUP

echo "==> Downloading an off-server backup copy"
mkdir -p "$dictionary_offsite_backup_dir"
chmod 0700 "$dictionary_offsite_backup_dir"
scp "$dictionary_ssh_host:$dictionary_remote_backup" "$dictionary_local_backup"
chmod 0600 "$dictionary_local_backup"
pg_restore --list "$dictionary_local_backup" >/dev/null
dictionary_backup_checksum="$(shasum -a 256 "$dictionary_local_backup" | awk '{print $1}')"
echo "Verified local backup: $dictionary_local_backup"
echo "Backup SHA-256: $dictionary_backup_checksum"

echo "==> Swapping the release, applying migrations, and checking health"
ssh "$dictionary_ssh_host" bash -s -- "$dictionary_release_label" "$dictionary_commit" "$dictionary_public_url" <<'REMOTE_DEPLOY'
set -Eeuo pipefail
release_label="$1"
source_commit="$2"
public_url="$3"
[[ "$release_label" =~ ^[A-Za-z0-9._-]+$ ]]
[[ "$source_commit" =~ ^[a-f0-9]+$ ]]
[[ "$public_url" =~ ^https://[A-Za-z0-9._:-]+$ ]]

app=/srv/dictionary/app
staging="/srv/dictionary/releases/staging-${release_label}"
previous="/srv/dictionary/releases/pre-${release_label}"
failed="/srv/dictionary/releases/failed-${release_label}"
before_metadata="/srv/dictionary/releases/${release_label}.before"
manifest="/srv/dictionary/releases/${release_label}.manifest"
current_moved=false
new_installed=false
deployment_started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

rollback_application() {
  status=$?
  trap - ERR
  echo "Deployment failed; restoring the previous application release" >&2
  systemctl stop dictionary.service >/dev/null 2>&1 || true
  if [[ "$new_installed" == true && -d "$app" ]]; then
    mv "$app" "$failed" || true
  fi
  if [[ "$current_moved" == true && -d "$previous" ]]; then
    mv "$previous" "$app" || true
  fi
  systemctl start dictionary.service >/dev/null 2>&1 || true
  echo "The database backup is retained at /var/backups/dictionary/dictionary-pre-${release_label}.dump" >&2
  exit "$status"
}
trap rollback_application ERR

test -d "$staging"
test -s "$staging/.next/BUILD_ID"
test -f "$before_metadata"
before_counts="$(sed -n 's/^counts=//p' "$before_metadata")"
test -n "$before_counts"

systemctl stop dictionary.service
mv "$app" "$previous"
current_moved=true
mv "$staging" "$app"
new_installed=true

cd "$app"
node --env-file=/etc/dictionary.env node_modules/tsx/dist/cli.mjs src/app/scripts/migrate.ts

after_counts="$(runuser -u postgres -- psql -d dictionary --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  SELECT json_build_object(
    'collections', (SELECT count(*) FROM collections),
    'words', (SELECT count(*) FROM words),
    'users', (SELECT count(*) FROM auth_users)
  )::text
" | tr -d '\n')"
if [[ "$before_counts" != "$after_counts" ]]; then
  echo "Production row-count invariants changed: $before_counts -> $after_counts" >&2
  false
fi

invalid_shapes="$(runuser -u postgres -- psql -d dictionary --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command "
  SELECT
    (SELECT count(*) FROM words WHERE jsonb_typeof(dict_entry) IS DISTINCT FROM 'object') +
    (SELECT count(*) FROM words WHERE jsonb_typeof(practice_data) IS DISTINCT FROM 'object')
" | tr -d '[:space:]')"
test "$invalid_shapes" = "0"

systemctl start dictionary.service
app_ready=false
for attempt in {1..30}; do
  if curl --silent --fail --output /dev/null http://127.0.0.1:3002/sign-in; then
    app_ready=true
    break
  fi
  sleep 1
done
test "$app_ready" = true
systemctl is-active --quiet dictionary.service
systemctl is-active --quiet caddy
caddy validate --config /etc/caddy/Caddyfile >/dev/null
curl --silent --fail --output /dev/null "${public_url}/sign-in"

{
  printf 'deployed_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'source_commit=%s\n' "$source_commit"
  printf 'release_label=%s\n' "$release_label"
  printf 'previous_release=%s\n' "$previous"
  cat "$before_metadata"
  printf 'post_counts=%s\n' "$after_counts"
  printf 'build_id=%s\n' "$(cat "$app/.next/BUILD_ID")"
} > "$manifest"
chmod 0600 "$manifest"

trap - ERR
echo "Production after deployment: $after_counts"
echo "Release manifest: $manifest"
echo "Recent application logs:"
journalctl -u dictionary.service --since "$deployment_started" --no-pager -n 60
REMOTE_DEPLOY

curl --silent --fail --output /dev/null "$dictionary_public_url/sign-in"
echo "Deployment completed: $dictionary_release_label"
echo "Rollback application: /srv/dictionary/releases/pre-${dictionary_release_label}"
echo "Off-server database backup: $dictionary_local_backup"
