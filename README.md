# Dictionary

A Next.js dictionary and practice app backed by PostgreSQL.

## Local development

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Start the app with `pnpm dev`.

To test against an isolated clone of the VPS data, run `pnpm dev:vps` instead.
It opens an SSH-only PostgreSQL tunnel using the `hetzner-helsinki` SSH host,
targets the non-production `dictionary_local_dev` database, and closes the
tunnel when Next stops.

The command prepares `codex-dev@dictionary.invalid` in that clone and prints a
new password for the current run. It assigns the cloned owner's collections to
the development account when needed, removes copied production credentials and
sessions, and never changes the production database. Set
`DICTIONARY_DEV_EMAIL`, `DICTIONARY_DEV_NAME`, or `DICTIONARY_DEV_PASSWORD`
before running the command if you want explicit development credentials.

The application uses a standard `DATABASE_URL`; it is not tied to Vercel or a
specific PostgreSQL provider. Merriam-Webster credentials are server-only and
must not use the `NEXT_PUBLIC_` prefix.

## Database

`pnpm seed` creates the enum types and empty tables for a new database. Do not
run it before restoring an existing full database dump, because the dump should
restore both schema and data.

Versioned SQL migrations live under `migrations/`. Run them with
`pnpm db:migrate`; applied filenames are recorded in `schema_migrations`.

## Authentication and ownership

Authentication uses Better Auth with email/password credentials and database
sessions in the same PostgreSQL database. Public signup is enabled; each new
account starts with an empty, private collection list. The one-time
`pnpm owner:bootstrap` command is only used during the initial migration to
assign the existing data to its owner.

Every collection has an owner. All collection, word, and practice queries are
scoped by the authenticated user on the server. Knowing another collection ID
does not grant access to it.

## Production

The Hetzner deployment runs as a dedicated `dictionary` systemd service on
`127.0.0.1:3002`. Caddy is the public TLS endpoint. Tracked reference files and
installation instructions are under `deploy/`.

Production secrets belong in `/etc/dictionary.env` on the server with mode
`0600`; they must never be committed. See `.env.example` for required names.

Routine releases are rehearsed against the isolated VPS development clone and
then deployed with a verified backup and rollback directory:

```sh
pnpm deploy:vps -- --rehearse-only
pnpm deploy:vps -- --deploy
```

See `deploy/README.md` for the full sequence, safety checks, overrides, and
rollback behavior.

The local backup timer retains fourteen daily custom-format PostgreSQL dumps.
Those dumps protect against application mistakes, but an off-server copy is
still required to protect against loss of the VPS.
