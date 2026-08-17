<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dictionary project instructions

## Product invariants

- Preserve user data and the established dictionary/practice UX unless the task explicitly changes them.
- Public signup is enabled. Every user sees only collections they own; there is no shared or public collection view.
- The original dictionary belongs only to its production owner account.
- The production target is the self-hosted Hetzner VPS at `dictionary.vmork.com`, not Vercel or Neon. Keep the app portable through a standard PostgreSQL `DATABASE_URL`.
- Do not trade away authentication or owner isolation to simplify UI or data work.

## Stack and code map

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS.
- PostgreSQL access uses `postgres` in `src/app/lib/db.ts` and repository functions in `src/app/lib/dictionaryRepository.ts`.
- Better Auth uses the same PostgreSQL database. Server configuration is in `src/app/lib/auth.ts`; session helpers are in `src/app/lib/session.ts`.
- Authenticated pages are Server Components that call `requirePageSession`. Interactive UI belongs in focused Client Components.
- Route handlers authenticate with `getRequestSession` before validating or querying data.
- SQL migrations live in `migrations/` and are applied by `src/app/scripts/migrate.ts`.
- Tracked Caddy, systemd, backup, and VPS helper files live under `deploy/`.

## Before changing code

1. Read the relevant guide in `node_modules/next/dist/docs/` before using or changing any Next.js API. The generated block at the top of this file must remain intact.
2. Inspect `git status` and the relevant diff. The working tree may already contain user changes; preserve unrelated edits.
3. Read the nearest implementation, types, and callers before changing a shared interface.
4. Use `pnpm`. Do not introduce npm or Yarn lockfiles.

## Local development

Normal local setup:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The preferred workflow for realistic data is:

```sh
pnpm dev:vps
```

That command tunnels to the isolated `dictionary_local_dev` database, prepares `codex-dev@dictionary.invalid`, prints a freshly rotated password, and starts Next locally. It deliberately removes copied production sessions and password credentials from the clone. It never targets the production `dictionary` database.

Use the printed development account for browser testing. Do not ask for, recover, reset, or reuse the real owner's password for development. To provision the clone without leaving Next running, use:

```sh
pnpm dev:vps -- --prepare-only
```

The account preparer must retain all of its guards: explicit enablement, a localhost connection, a database name containing `dev` or `test`, and refusal under `NODE_ENV=production`.

## Authentication and tenant isolation

- Treat the authenticated server session as the only source of the user ID. Never accept an owner ID from a client request.
- Scope every collection, word, and practice query by both the resource identifier and `session.user.id`.
- Return `401` when there is no session. For another user's resource, return `404` rather than revealing that it exists.
- New signups must start with no collections.
- Keep authorization in server pages, route handlers, and repository queries. Client-side hiding is not authorization.
- Keep auth secrets and Merriam-Webster keys server-only. Never add `NEXT_PUBLIC_` to them.
- Never commit `.env` files, database URLs, passwords, auth secrets, dumps, session cookies, or API keys. `.env.example` contains placeholders only.

## Database rules

- Put reusable SQL in `src/app/lib/dictionaryRepository.ts`, not in React components. Route handlers should validate, authenticate, call repository functions, and translate known errors into HTTP responses.
- Use parameterized `postgres` tagged templates. Do not build SQL with string concatenation.
- Write JavaScript objects to `jsonb` with `sql.json(...)`; do not `JSON.stringify` them first. Normalize legacy JSON shapes at the repository boundary when necessary.
- Serialize PostgreSQL `Date` values to ISO strings before passing them into client data.
- Add forward-only, lexically ordered migrations. Never rewrite a migration that may already have run; add a new migration instead.
- `pnpm seed` is only for a new empty database. Never run it before restoring or against a populated database.
- `pnpm db:migrate` changes the configured database. Confirm the target and take a backup before applying migrations in production.

## Next.js and React conventions

- Prefer Server Components. Add `"use client"` only when a component needs browser state, effects, events, or client-only libraries.
- In this Next.js version, request APIs and App Router props such as `headers()` and `searchParams` may be asynchronous. Follow the installed documentation, not remembered APIs.
- Keep authenticated routes dynamic unless the installed Next.js documentation and a security review show caching is safe.
- Reuse the `@/*` path alias for cross-tree imports.
- Preserve the current responsive split-pane and word-list interaction unless a task explicitly changes it.
- Prefer explicit types and narrow `unknown` values. Avoid adding `any`; when handling third-party/database errors, narrow the needed fields.
- Keep user-visible error states actionable, and do not leak stack traces or database details to the browser.

## Verification

Run checks proportional to the change. For ordinary code changes, the baseline is:

```sh
pnpm exec next typegen
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

- Do not claim a check passed unless it ran successfully.
- Existing lint warnings may be reported, but do not add new warnings or suppress rules merely to make output quiet.
- For auth, ownership, collection lifecycle, or JSON persistence changes, also run `pnpm test:auth-isolation` against an isolated/disposable database. It creates accounts and mutates data; never point it at production.
- For UI fixes, reproduce the original flow and verify it in the browser at relevant viewport sizes. Check console errors and failed network requests.
- For database fixes, verify both row counts and data shapes before and after migration. A migration succeeding is not enough evidence that data was preserved.

## Production and deployment

- Production runs as `dictionary.service` on `127.0.0.1:3002`; Caddy terminates HTTPS. Runtime secrets live in `/etc/dictionary.env` with mode `0600`.
- Repository files under `deploy/` are reference copies. Install copies into `/etc/caddy`, `/etc/systemd/system`, or `/srv/dictionary/bin`; do not symlink system configuration into the checkout.
- Do not deploy, restart services, change DNS, or mutate the production database unless the user requested production action.
- Before any production migration or risky data change:
  1. take a fresh PostgreSQL custom-format backup;
  2. rehearse the build, migration, and functional checks against a disposable clone;
  3. preserve the previous application release for rollback;
  4. record pre/post row counts or other relevant invariants.
- After deployment, verify the systemd service, Caddy/HTTPS, recent logs, authenticated access, and the exact user flow that changed.
- Daily VPS backups are not a substitute for an off-server backup.

## Finishing work

- Keep changes scoped to the request and preserve unrelated working-tree changes.
- Update documentation and `.env.example` when commands or required configuration change.
- Report what changed, what was verified, any remaining warnings or risks, and whether changes are uncommitted, committed, deployed, or migrated.
- Never include live credentials in the final response.
