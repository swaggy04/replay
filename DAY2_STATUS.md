# DevReplay Day 2 — Status (Frozen for Next Phase)

Day 2 implementation is complete in the working tree. Database integration verification is explicitly deferred.

## Implemented functionality

- Bounded in-memory FIFO event queue in `sdk/node` with configurable capacity (default 1000) and drop-oldest/newest overflow policy.
- Batch processing with configurable `maxBatchSize` (default 50) and `flushIntervalMs` (default 5000), bounded concurrent batch uploads.
- Retry system: exponential backoff + jitter, max attempts, `Retry-After` handling, timeout, transient vs permanent classification.
- Stable SDK `eventId` per event and backend idempotency via project-scoped unique `(projectId, eventId)`.
- Backward-compatible `POST /ingest/batch` endpoint alongside existing `POST /ingest`.
- Byte-aware batch splitting and `413` handling.
- Graceful `flush()` / `shutdown()` lifecycle API returning drain status; no automatic signal handlers.
- Delivery statistics: `totalCaptured`, `eventsQueued`, `eventsDelivered`, `eventsDropped`, `uploadFailures`, `retryAttempts`, `currentQueueSize`, `batchCount`.
- Preserved Day 1 redaction, payload/query limits, streaming response handling, API-key security, single-event ingestion.

## Tests that passed

- SDK: `cd sdk/node && npm test` — 29/29 passing.
- SDK example: `cd sdk/node && npm run example` — passing.
- SDK build: `cd sdk/node && npm run build` — passing.
- Backend unit: `npm run test:unit` — 5/5 passing.
- Backend build: `npm run build` — passing.
- Prisma: `npx prisma validate` and `npx prisma generate` — passing.

## Integration tests still pending

- `test/integration/ingest.integration.test.ts` not executed: no dedicated PostgreSQL test database available in this environment (no Docker/local Postgres).
- Safety guard refuses to run against the shared Neon development database.
- To run later: set `TEST_DATABASE_URL` to an allowlisted local test DB, apply migration to that DB only, then run `npm test`.

## Migration still pending

- `prisma/migrations/20261113120000_add_requestlog_event_id/migration.sql` adds nullable `eventId` and project-scoped unique index `RequestLog_projectId_eventId_key`.
- `npx prisma migrate status` reports this migration as not applied.
- Migration has not been applied to any database (including Neon).

## Known limitations

- In-memory queue is not durable across process crashes/restarts.
- Delivery guarantee is at-least-once with idempotency support, not exactly-once.
- Backend integration tests and end-to-end migration verification are deferred.
- Byte-aware splitting cannot guarantee delivery for single events exceeding ingest payload limits (dropped with warning).