import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// --- Dedicated test database safety check (must run before importing Prisma/app) ---
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  console.error(
    "[integration] TEST_DATABASE_URL is required. Refusing to run against a non-dedicated database.",
  );
  process.exit(1);
}

let parsedUrl: URL;
let dbName = "";
let dbHost = "";
try {
  parsedUrl = new URL(testDbUrl);
  dbName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, "").split("?")[0]);
  dbHost = parsedUrl.hostname;
} catch {
  console.error("[integration] TEST_DATABASE_URL is not a valid URL.");
  process.exit(1);
}

// Explicit host allowlist.
const allowedHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  ...(process.env.TEST_DATABASE_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),
]);
if (!allowedHosts.has(dbHost)) {
  console.error(
    `[integration] Refusing to run: host "${dbHost}" is not in the test DB host allowlist.`,
  );
  process.exit(1);
}

// Explicit database-name allowlist.
const allowedDbNames = new Set(
  (process.env.TEST_DATABASE_NAMES || "devreplay_test,devreplay_test_db")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean),
);
if (!allowedDbNames.has(dbName)) {
  console.error(
    `[integration] Refusing to run: database "${dbName}" is not in the test DB name allowlist (${[
      ...allowedDbNames,
    ].join(", ")}).`,
  );
  process.exit(1);
}

// Prevent accidental reuse of the known Neon development database URL.
const neonDevHost = "ep-lingering-frost-ay2rimhw-pooler.c-5.us-east-2.aws.neon.tech";
if (dbHost === neonDevHost || testDbUrl.includes(neonDevHost)) {
  console.error("[integration] Refusing to run against the Neon development database.");
  process.exit(1);
}

process.env.DATABASE_URL = testDbUrl;

const { default: app } = await import("../../src/app.js");
const { default: prisma } = await import("../../src/lib/prisma.js");
const { captureRequests } = await import("../../src/services/captureService.js");

type StartedServer = { server: import("node:http").Server; port: number };

async function listen(): Promise<StartedServer> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", reject);
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("failed to bind");
  return { server, port: addr.port };
}

async function close(server: import("node:http").Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function makeApiKey() {
  const raw = `dr_live_${crypto.randomBytes(32).toString("hex")}`;
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 12) };
}

async function postJson(port: number, path: string, body: unknown, apiKey: string) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-devreplay-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, text };
}

let srv: StartedServer;
const created = {
  userIds: [] as string[],
  projectIds: [] as string[],
  apiKeyIds: [] as string[],
  requestLogIds: [] as string[],
};

async function createProjectFixture(suffix: string) {
  const user = await prisma.user.create({
    data: { clerkUserId: `clerk_test_${suffix}_${crypto.randomUUID()}` },
  });
  created.userIds.push(user.id);
  const project = await prisma.project.create({
    data: { name: `itest-${suffix}`, ownerId: user.id },
  });
  created.projectIds.push(project.id);
  const key = makeApiKey();
  const apiKey = await prisma.apiKey.create({
    data: { key: key.hash, keyPrefix: key.prefix, projectId: project.id },
  });
  created.apiKeyIds.push(apiKey.id);
  return { user, project, projectId: project.id, apiKey, rawApiKey: key.raw };
}

before(async () => {
  srv = await listen();
});

after(async () => {
  try {
    if (created.projectIds.length) {
      await prisma.requestLog.deleteMany({ where: { projectId: { in: created.projectIds } } });
      await prisma.project.deleteMany({ where: { id: { in: created.projectIds } } });
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    }
  } finally {
    await close(srv.server);
    await prisma.$disconnect();
  }
});

test("batch ingestion accepts valid events and stores them", async () => {
  const fx = await createProjectFixture("batch");
  const eventId = `evt_batch_${crypto.randomUUID()}`;
  const res = await postJson(srv.port, "/ingest/batch", {
    events: [
      { eventId, method: "GET", path: "/hello", statusCode: 200, durationMs: 12 },
      { method: "POST", path: "/world", body: { a: 1 }, statusCode: 201, durationMs: 7.6 },
    ],
  }, fx.rawApiKey);

  assert.equal(res.status, 201);
  assert.equal(res.json.failed, 0);
  assert.equal(res.json.accepted + res.json.duplicates, 2);

  const rows = await prisma.requestLog.findMany({ where: { projectId: fx.projectId, path: { in: ["/hello", "/world"] } } });
  assert.equal(rows.length >= 2, true);
  for (const r of rows) created.requestLogIds.push(r.id);
  const hello = rows.find((r: any) => r.path === "/hello");
  assert.ok(hello);
  assert.equal((hello as any).eventId, eventId);
  const world = rows.find((r: any) => r.path === "/world");
  assert.ok(world);
  assert.equal((world as any).durationMs, 8, "fractional durationMs should be normalized to integer");
});

test("duplicate batch ingestion is idempotent for same project/eventId", async () => {
  const fx = await createProjectFixture("dup");
  const eventId = `evt_dup_${crypto.randomUUID()}`;
  const payload = { events: [{ eventId, method: "GET", path: "/dup", statusCode: 200 }] };

  const first = await postJson(srv.port, "/ingest/batch", payload, fx.rawApiKey);
  assert.equal(first.status, 201);
  const second = await postJson(srv.port, "/ingest/batch", payload, fx.rawApiKey);
  assert.ok(second.status === 201 || second.status === 207);
  assert.equal(second.json.failed, 0);
  assert.equal(second.json.duplicates >= 1, true);

  const rows = await prisma.requestLog.findMany({ where: { projectId: fx.projectId, path: "/dup" } });
  assert.equal(rows.length, 1, "same project+eventId should be stored once");
  created.requestLogIds.push(rows[0].id);
});

test("partial failures are reported per event (service-level integration)", async () => {
  const fx = await createProjectFixture("partial");
  const okEventId = `evt_ok_${crypto.randomUUID()}`;
  const badEventId = `evt_bad_${crypto.randomUUID()}`;

  const result = await captureRequests([
    { projectId: fx.projectId, eventId: okEventId, method: "GET", path: "/partial-ok" },
    { projectId: "proj_does_not_exist", eventId: badEventId, method: "GET", path: "/partial-bad" },
  ] as any);

  assert.equal(result.accepted, 1);
  assert.equal(result.failed, 1);
  const ok = result.results.find((r) => r.eventId === okEventId);
  const bad = result.results.find((r) => r.eventId === badEventId);
  assert.ok(ok && !ok.error);
  assert.ok(bad && bad.error);
  assert.equal(bad?.retryable, false, "FK violation should be classified as permanent");

  const rows = await prisma.requestLog.findMany({ where: { projectId: fx.projectId, eventId: okEventId } });
  assert.equal(rows.length, 1);
  created.requestLogIds.push(rows[0].id);
});

test("cross-project isolation allows same eventId in different projects", async () => {
  const a = await createProjectFixture("iso-a");
  const b = await createProjectFixture("iso-b");
  const sharedEventId = `evt_shared_${crypto.randomUUID()}`;

  const ra = await postJson(srv.port, "/ingest/batch", {
    events: [{ eventId: sharedEventId, method: "GET", path: "/iso", statusCode: 200 }],
  }, a.rawApiKey);
  const rb = await postJson(srv.port, "/ingest/batch", {
    events: [{ eventId: sharedEventId, method: "GET", path: "/iso", statusCode: 200 }],
  }, b.rawApiKey);

  assert.equal(ra.status, 201);
  assert.equal(rb.status, 201);
  assert.equal(ra.json.failed, 0);
  assert.equal(rb.json.failed, 0);

  const rowsA = await prisma.requestLog.findMany({ where: { projectId: a.projectId, path: "/iso" } });
  const rowsB = await prisma.requestLog.findMany({ where: { projectId: b.projectId, path: "/iso" } });
  assert.equal(rowsA.length, 1);
  assert.equal(rowsB.length, 1);
  created.requestLogIds.push(rowsA[0].id, rowsB[0].id);
});
