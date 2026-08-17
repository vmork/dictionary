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
