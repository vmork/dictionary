# VPS deployment

The files in this directory are the source-controlled copies of the live Caddy,
systemd, and backup configuration. Install copies on the server; do not symlink
system configuration directly into the application checkout.

## Server paths

- Application: `/srv/dictionary/app`
- Runtime environment: `/etc/dictionary.env` (`root:root`, mode `0600`)
- Caddy configuration: append `caddy/dictionary.caddy` to `/etc/caddy/Caddyfile`
- systemd units: `/etc/systemd/system/dictionary*.{service,timer}`
- Backup script: `/srv/dictionary/bin/backup.sh`
- Database backups: `/var/backups/dictionary`
- Local-development database clone: `dictionary_local_dev` (reachable only through SSH)

No secret, database dump, TLS key, or generated runtime file belongs in Git.

## Routine application deployment

Run deployments from the repository root on a trusted workstation with the VPS
SSH host configured. Rehearse without changing production:

```sh
pnpm deploy:vps -- --rehearse-only
```

Deploy the current `main` branch:

```sh
pnpm deploy:vps -- --deploy
```

The command refuses a dirty working tree by default. `--allow-dirty` is an
explicit escape hatch for a reviewed working copy, and the release name is
marked `dirty`. Use `--skip-rehearsal` only when the exact same working tree has
already completed the rehearsal.

The script performs these steps:

1. Installs the locked dependencies, generates route types, type-checks, lints,
   runs the etymology parser tests, and creates a production build locally.
2. Opens the guarded SSH tunnel to `dictionary_local_dev`, rehearses all pending
   migrations, verifies row and JSON shapes, starts the built app, and runs the
   authenticated ownership/isolation checks.
3. Checks the production service, Caddy, backup timer, environment-file mode,
   available commands, and live Caddy configuration.
4. Uploads to a new directory under `/srv/dictionary/releases/`, installs the
   locked dependencies there, and builds it before production is stopped.
5. Creates a fresh custom-format PostgreSQL backup, validates it with
   `pg_restore --list`, and downloads a mode-`0600` off-server copy. The local
   directory defaults to the operating system's temporary directory; set
   `DICTIONARY_OFFSITE_BACKUP_DIR` or pass `--backup-dir` for durable storage.
6. Records collection, word, user, migration, and JSON-shape invariants; stops
   the service; preserves the old application directory; swaps in the built
   release; and runs forward-only migrations.
7. Requires the pre/post invariants to match, then checks the internal app,
   systemd, Caddy validation, and public HTTPS endpoint. A release manifest is
   left in `/srv/dictionary/releases/`.

If migration, startup, or health verification fails after the swap, the script
moves the failed application aside, restores the previous application directory,
and starts it again. It deliberately does not restore a database automatically:
forward migrations may have partially completed across multiple migration files,
so database restoration remains an explicit operator decision using the backup
printed by the script.

After a successful deploy, verify an existing authenticated session and the
specific changed user flow in a browser. Once the release has been stable and a
durable off-server backup exists, old release directories can be pruned manually.

Useful overrides:

```sh
DICTIONARY_VPS_SSH_HOST=host pnpm deploy:vps -- --deploy
pnpm deploy:vps -- --deploy --backup-dir /secure/off-server/path
```

## Authentication migration

Take a fresh backup before applying either migration. The deployment sequence is:

1. Stop the application service.
2. Deploy and build the new application.
3. Run `pnpm db:migrate -- --through 001_auth_and_collection_ownership.sql`.
4. Create the owner and claim the existing collections using a temporary,
   untracked owner environment file:

   ```sh
   node --env-file=/etc/dictionary.env --env-file=/root/dictionary-owner.env \
     node_modules/tsx/dist/cli.mjs src/app/scripts/bootstrapOwner.ts
   ```

5. Run `pnpm db:migrate` to require an owner for every collection.
6. Start the service and run authenticated isolation checks.

Delete the temporary owner environment file immediately after the owner login is
verified. Public email/password signup is enabled. New accounts begin with no
collections and can only access collections they create themselves.

Users can change their password from `/account`. If they lose it before email
recovery is configured, reset it interactively on the VPS:

```sh
pnpm user:set-password -- --email user@example.com
```

## Installing tracked configuration

Copy the systemd files and backup script into their live paths, preserve the
executable bit on `scripts/backup.sh`, append the Caddy snippet to the live
Caddyfile, then run:

```sh
systemctl daemon-reload
systemctl enable --now dictionary.service dictionary-backup.timer
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Only install the Caddy site after the desired hostname has been confirmed. HTTPS
must be active before using production login cookies.
