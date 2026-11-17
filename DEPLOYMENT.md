# DevReplay Deployment Guide

## Backend (Express + Prisma)

- Build: `npm run build`
- Start: `npm run start` (runs `node dist/server.js`)
- Default port: 5000 (configurable via PORT if implemented; currently fixed).
- Health check: `GET /` returns "DevReplay is alive".

### Required environment variables
- `DATABASE_URL` — PostgreSQL connection string (pooled OK for runtime).
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- `FRONTEND_URL` — frontend origin for CORS.
- `TEST_DATABASE_URL`, `TEST_DATABASE_ALLOWED_HOSTS`, `TEST_DATABASE_NAMES` — for integration tests only.

### Migrations
- Apply with `npx prisma migrate deploy` against the target database.
- Use a direct (non-pooled) connection for migrations.
- Never use the development database for tests.

## Frontend (Next.js)
- Build: `cd frontend && npm run build`
- Start: `cd frontend && npm run start`
- Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.

## SDK
- Package: `sdk/node`
- Build: `npm run build`
- Test: `npm test`
- Example: `npm run example`
- Configure `DEVREPLAY_API_KEY` and `DEVREPLAY_ENDPOINT`.

## Notes
- No Docker/Redis/Kafka required.
- Live Clerk authentication and dashboard verification require real Clerk credentials and a running database.