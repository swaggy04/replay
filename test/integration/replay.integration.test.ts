import "dotenv/config";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { once } from "node:events";

// Safety guard (same as ingest integration test)
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  console.error("[integration] TEST_DATABASE_URL is required.");
  process.exit(1);
}
let dbName = "";
let dbHost = "";
try {
  const u = new URL(testDbUrl);
  dbName = decodeURIComponent(u.pathname.replace(/^\//, "").split("?")[0]);
  dbHost = u.hostname;
} catch {
  console.error("[integration] Invalid TEST_DATABASE_URL.");
  process.exit(1);
}
const allowedHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  ...(process.env.TEST_DATABASE_ALLOWED_HOSTS || "").split(",").map((h) => h.trim()).filter(Boolean),
]);
if (!allowedHosts.has(dbHost)) {
  console.error(`[integration] Host not allowlisted: ${dbHost}`);
  process.exit(1);
}
const allowedDbNames = new Set(
  (process.env.TEST_DATABASE_NAMES || "devreplay_test,devreplay_test_db").split(",").map((n) => n.trim()).filter(Boolean),
);
if (!allowedDbNames.has(dbName)) {
  console.error(`[integration] DB name not allowlisted: ${dbName}`);
  process.exit(1);
}
const neonDevHost = "ep-lingering-frost-ay2rimhw-pooler.c-5.us-east-2.aws.neon.tech";
if (dbHost === neonDevHost || testDbUrl.includes(neonDevHost)) {
  console.error("[integration] Refusing to run against Neon dev DB.");
  process.exit(1);
}
process.env.DATABASE_URL = testDbUrl;
process.env.REPLAY_ALLOW_LOOPBACK = "true";

const { default: prisma } = await import("../../src/lib/prisma.js");
const { executeReplay, replayHistoryService } = await import("../../src/services/replayService.js");
const { compareReplayService } = await import("../../src/services/requestsService.js");

type ServerHandle = { server: http.Server; port: number };

async function listen(handler: http.RequestListener): Promise<ServerHandle> {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("bind failed");
  return { server, port: addr.port };
}
async function close(s: http.Server) {
  await new Promise<void>((resolve, reject) => s.close((e) => (e ? reject(e) : resolve())));
}

let user: any;
let project: any;
let requestLog: any;
const cleanup = { userIds: [] as string[], projectIds: [] as string[], requestLogIds: [] as string[] };

before(async () => {
  user = await prisma.user.create({ data: { clerkUserId: `clerk_replay_${crypto.randomUUID()}` } });
  cleanup.userIds.push(user.id);
  project = await prisma.project.create({ data: { name: `replay-test-${crypto.randomUUID()}`, ownerId: user.id, replayBaseUrl: null } });
  cleanup.projectIds.push(project.id);

  // Configure replay target to a placeholder; tests will override per-case by updating project.
});

after(async () => {
  try {
    await prisma.replayExecution.deleteMany({ where: { requestLog: { projectId: { in: cleanup.projectIds } } } });
    await prisma.requestLog.deleteMany({ where: { projectId: { in: cleanup.projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanup.projectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanup.userIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

async function makeRequestLog(statusCode = 200, body: any = { hello: "world" }) {
  const rl = await prisma.requestLog.create({
    data: {
      projectId: project.id,
      method: "POST",
      path: "/api/test",
      body: { foo: "bar" },
      query: { q: "1" },
      headers: { "content-type": "application/json", authorization: "Bearer secret" },
      statusCode,
      responseBody: body,
      durationMs: 42,
    },
  });
  cleanup.requestLogIds.push(rl.id);
  return rl;
}

async function setTarget(url: string) {
  await prisma.project.update({ where: { id: project.id }, data: { replayBaseUrl: url } });
}

test("replay persists execution for HTTP 200 target", async () => {
  const rl = await makeRequestLog(200, { hello: "world" });
  const srv = await listen((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      res.statusCode = 200;
      res.end(JSON.stringify({ replayed: true, received: data ? JSON.parse(data) : null }));
    });
  });
  await setTarget(`http://127.0.0.1:${srv.port}`);

  const result = await executeReplay(rl.id, user.id);
  assert.ok(result, "executeReplay should return result");
  assert.equal(result!.status, 200);
  assert.equal(result!.targetError, false);
  assert.equal(result!.infraError, null);
  assert.ok(result!.replay, "replay execution persisted");

  const persisted = await prisma.replayExecution.findUnique({ where: { id: result!.replay.id } });
  assert.ok(persisted, "replay execution in DB");
  assert.equal(persisted!.requestLogId, rl.id);
  assert.equal(persisted!.statusCode, 200);
  assert.ok(typeof persisted!.durationMs === "number");

  await close(srv.server);
});

test("replay records target HTTP 404 as completed execution", async () => {
  const rl = await makeRequestLog(200, { hello: "world" });
  const srv = await listen((req, res) => {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "not found" }));
  });
  await setTarget(`http://127.0.0.1:${srv.port}`);

  const result = await executeReplay(rl.id, user.id);
  assert.ok(result);
  assert.equal(result!.status, 404);
  assert.equal(result!.targetError, true);
  assert.equal(result!.infraError, null);
  const persisted = await prisma.replayExecution.findUnique({ where: { id: result!.replay.id } });
  assert.equal(persisted!.statusCode, 404);

  await close(srv.server);
});

test("replay records target HTTP 500 as completed execution", async () => {
  const rl = await makeRequestLog(200, { hello: "world" });
  const srv = await listen((req, res) => {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "boom" }));
  });
  await setTarget(`http://127.0.0.1:${srv.port}`);

  const result = await executeReplay(rl.id, user.id);
  assert.ok(result);
  assert.equal(result!.status, 500);
  assert.equal(result!.targetError, true);
  assert.equal(result!.infraError, null);

  await close(srv.server);
});

test("replay records network failure as infra error", async () => {
  const rl = await makeRequestLog(200, { hello: "world" });
  // point to a closed port
  await setTarget("http://127.0.0.1:1");

  const result = await executeReplay(rl.id, user.id);
  assert.ok(result);
  assert.equal(result!.status, 0);
  assert.ok(result!.infraError, "infra error should be set");
  const persisted = await prisma.replayExecution.findUnique({ where: { id: result!.replay.id } });
  assert.equal(persisted!.statusCode, null);

  await prisma.project.update({ where: { id: project.id }, data: { replayBaseUrl: null } });
});

test("replay unauthorized for non-owner", async () => {
  const rl = await makeRequestLog(200, { hello: "world" });
  const otherUser = await prisma.user.create({ data: { clerkUserId: `clerk_other_${crypto.randomUUID()}` } });
  const result = await executeReplay(rl.id, otherUser.id);
  assert.equal(result, null, "non-owner should get null");
  await prisma.user.delete({ where: { id: otherUser.id } });
});

test("replay requires configured target", async () => {
  const rl = await makeRequestLog(200, { hello: "world" });
  await prisma.project.update({ where: { id: project.id }, data: { replayBaseUrl: null } });
  await assert.rejects(() => executeReplay(rl.id, user.id), /not configured/i);
});

test("compareReplayService compares original and replay", async () => {
  const rl = await makeRequestLog(200, { hello: "world" });
  const srv = await listen((req, res) => {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ hello: "world" }));
  });
  await setTarget(`http://127.0.0.1:${srv.port}`);
  const result = await executeReplay(rl.id, user.id);
  assert.ok(result);
  const comparison = await compareReplayService(rl.id, result!.replay.id, user.id);
  assert.ok(comparison);
  assert.ok(comparison!.original);
  assert.ok(comparison!.replay);
  assert.equal(comparison!.statusChanged, false);
  assert.equal(comparison!.bodyChanged, false);

  await close(srv.server);
});

test("replay filters sensitive headers", async () => {
  const rl = await prisma.requestLog.create({
    data: {
      projectId: project.id,
      method: "POST",
      path: "/api/secret",
      body: { token: "secret-body" },
      headers: { authorization: "Bearer x", cookie: "y", "x-api-key": "z", "content-type": "application/json" },
      statusCode: 200,
      responseBody: { ok: true },
      durationMs: 10,
    },
  });
  cleanup.requestLogIds.push(rl.id);
  const receivedHeaders: any = {};
  const srv = await listen((req, res) => {
    for (const [k, v] of Object.entries(req.headers)) receivedHeaders[k] = v;
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  await setTarget(`http://127.0.0.1:${srv.port}`);
  const result = await executeReplay(rl.id, user.id);
  assert.ok(result);
  assert.equal(receivedHeaders["authorization"], undefined);
  assert.equal(receivedHeaders["cookie"], undefined);
  assert.equal(receivedHeaders["x-api-key"], undefined);
  assert.equal(receivedHeaders["content-type"], "application/json");

  await close(srv.server);
});