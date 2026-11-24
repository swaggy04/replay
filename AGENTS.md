# AGENTS.md — DevReplay

API request capture / inspect / replay / compare tool. Monorepo layout:

- **Root** — Express + TypeScript backend (`src/`), Prisma + PostgreSQL (`prisma/`), root `package.json`.
- **`frontend/`** — Next.js 16 dashboard (React 19).
- **`sdk/node/`** — separate Node SDK package (`@devreplay/node`); root scripts do not cover it.

## Commands

- Backend dev: `npm run dev` (`tsx watch src/server.ts`, port 5000). Entry point: `src/server.ts`.
- Backend prod: `npm run build` (`tsc` → `dist/`) then `npm run start` (`node dist/server.js`).
- Prisma: `npm run prisma:generate`; `npm run prisma:migrate` (dev). Prod: `npx prisma migrate deploy` (direct, non-pooled connection — see DEPLOYMENT.md).
- Frontend: `cd frontend && npm run dev` (Next default port 3000) or `npm run build` / `npm run lint`.
- SDK: `cd sdk/node && npm test` (builds, then runs compiled tests) or `npm run example`.

## Tests

- Unit: `npm run test:unit` — `node --test test/unit/*.test.ts`. Imports the generated Prisma client in `src/generated/prisma`; run `npm run prisma:generate` first if it is missing. Note: the TLS tests in `test/unit/replaySecurity.test.ts` currently fail with `CERT_HAS_EXPIRED` — the certificates in `test/fixtures/` expired Nov 20, 2026. Regenerate those certs (with openssl) if you need green unit runs.
- Integration: root `npm test` runs `test/integration/*.test.ts`. **Requires** `TEST_DATABASE_URL` — a dedicated test DB. Hosts allowlisted to `localhost,127.0.0.1` by default (`TEST_DATABASE_ALLOWED_HOSTS`), names `devreplay_test`, `devreplay_test_db` by default (`TEST_DATABASE_NAMES`). It refuses to run without `TEST_DATABASE_URL` and refuses the shared Neon dev DB.

## Auth

- Dashboard/project/request routes (`src/app.ts`): require Clerk sign-in (`requireUser`).
- `/ingest`, `/ingest/batch`, `/projects/:id/api-keys`: require `x-devreplay-api-key` (`requireApiKey`, format `dr_live_` + 64 hex).
- Smoke endpoints without Clerk creds: `GET /`, `GET /users`.

## Gotchas

- TS is NodeNext (`tsconfig.json`): relative imports in `src/**` must use `.js` extensions (e.g. `./app.js`).
- `express.json({ limit: "256kb" })` — request bodies are capped at 256 KB.
- Replay to loopback: `src/services/replayService.ts` allows replay targets on `localhost`/`127.0.0.1`/`::1` only when the backend runs with `NODE_ENV=development` (the explicit development signal). `REPLAY_ALLOW_LOOPBACK=true` is the operator override and applies in any mode — see the security note in `allowLoopbackForReplayTarget`: it lets a project owner replay against loopback addresses of their configured replay target (recorded status + redacted response body), so enable it only deliberately in production. Production blocks loopback by default (`src/services/replaySecurity.ts`).
- Auto-capture: the middleware in `src/middleware/requestLogger.ts` (captures requests with an `x-devreplay-project-id` header, skipping `/requests`, `/replay/*`, `/_next/*`, `/favicon.ico`, `/ingest`) is **not mounted** in `src/app.ts` — the README's "automatic capture" is stale; ingest via `POST /ingest` / `POST /ingest/batch` or the SDK.
- Env files: root `.env` (`DATABASE_URL`), `frontend/.env.local` (`NEXT_PUBLIC_API_URL`, Clerk keys).
- Seed data: `npx tsx demo.ts` while the backend is running (creates a Demo Project, captures built-in routes, replays one).
- Docs: `README.md`, `DEPLOYMENT.md`, `DAY2_STATUS.md`; the root README mentions frontend on port 3001 while `next dev` defaults to 3000.

## Engineering workflow (autonomous)

Follow: investigate → reproduce → implement → test → diagnose failures → fix → retest.

- **Routine reversible changes are self-approved:** code changes, added/updated tests, docs, refactors; running builds, tests, and lints.
- **Explicit approval required before acting on:**
  - Destructive database operations (bulk DELETE/TRUNCATE/DROP, resetting or recreating databases).
  - Shared database migrations (`prisma migrate deploy` or schema changes against shared/production databases).
  - Production changes (live config or `.env` values).
  - Deployments.
  - Git commits and pushes (in any repo, including this one).
  - Security-policy weakening: auth, API-key validation, SSRF protections, rate limits, or redaction — anything that widens access or relaxes a check.
- **Secrets:** never read actual `.env` files unless required; do not print or log secrets, tokens, or keys; refer to variables by name only.

## Security invariants to preserve

- Multi-tenant isolation: dashboard routes set `res.locals.userId` via `requireUser`; API-key routes set `res.locals.projectId` via `requireApiKey` — keep all data queries scoped to those.
- Clerk sign-in required on `/projects`, `/requests`, `/replay/*` (`requireUser`); API-key auth (`x-devreplay-api-key`, format `dr_live_` + 64 hex, SHA-256 hash lookup, revoked keys rejected) on `/ingest`, `/ingest/batch`, api-keys routes.
- Redaction: keep `src/utils/redaction.ts` semantics and `redaction.test.ts` green.
- Replay SSRF protection: `secureFetch`/`validateReplayBaseUrl`/`isBlockedIP` in `src/services/replaySecurity.ts` — do not relax; `test/unit/replaySecurity.test.ts` is the regression net.

## External test application

- `L:\devreplay-external-test` — a separate repo (own `.git`; not a worktree/submodule of `L:\replay`): `express-typescript-starter`, an Express + TypeScript CommonJS app that captures via the SDK (`"@devreplay/node": "file:../replay/sdk/node"`, mounted by `src/middleware/devReplay.ts`; default endpoint `http://localhost:5000`). Do not modify it.

## Verification standards

- Evidence-based reports: cite commands run and their results (exit codes, pass/fail lists), observations, and items deliberately not done.
- Regression tests: every bug fix adds or updates a regression test; the relevant suite passes (`npm run test:unit`; `npm test` for integration/DB behavior).
