import "dotenv/config";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getProjects, createproject } from "../../src/services/projectService.js";
import { createApiKey, revokeApiKey, getProjectApiKeys } from "../../src/services/apiKeyService.js";
import { requestIdService } from "../../src/services/requestsService.js";
import { replayHistoryService } from "../../src/services/replayService.js";
import { updateProjectReplayBaseUrl } from "../../src/services/projectService.js";

// Safety guard (same as other integration tests)
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) { console.error("[integration] TEST_DATABASE_URL required."); process.exit(1); }
let dbName = "", dbHost = "";
try { const u = new URL(testDbUrl); dbName = decodeURIComponent(u.pathname.replace(/^\//, "").split("?")[0]); dbHost = u.hostname; } catch { console.error("[integration] invalid URL"); process.exit(1); }
const allowedHosts = new Set(["localhost","127.0.0.1","::1", ...(process.env.TEST_DATABASE_ALLOWED_HOSTS||"").split(",").map(h=>h.trim()).filter(Boolean)]);
if (!allowedHosts.has(dbHost)) { console.error("[integration] host not allowlisted"); process.exit(1); }
const allowedNames = new Set((process.env.TEST_DATABASE_NAMES || "devreplay_test,devreplay_test_db").split(",").map(n=>n.trim()).filter(Boolean));
if (!allowedNames.has(dbName)) { console.error("[integration] db not allowlisted"); process.exit(1); }
const neonDevHost = "ep-lingering-frost-ay2rimhw-pooler.c-5.us-east-2.aws.neon.tech";
if (dbHost === neonDevHost || testDbUrl.includes(neonDevHost)) { console.error("[integration] refusing dev DB"); process.exit(1); }
process.env.DATABASE_URL = testDbUrl;

const { default: app } = await import("../../src/app.js");
const { default: prisma } = await import("../../src/lib/prisma.js");

type S = { server: import("node:http").Server; port: number };
async function listen(): Promise<S> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server.once("listening", () => resolve()); server.once("error", reject); });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("bind failed");
  return { server, port: addr.port };
}
async function close(s: import("node:http").Server) { await new Promise<void>((resolve, reject) => s.close((e) => (e ? reject(e) : resolve()))); }

let srv: S;
const created = { userIds: [] as string[], projectIds: [] as string[], apiKeyIds: [] as string[] };

async function makeUser(suffix: string) {
  const u = await prisma.user.create({ data: { clerkUserId: `clerk_iso_${suffix}_${crypto.randomUUID()}` } });
  created.userIds.push(u.id);
  return u;
}
async function makeProject(ownerId: string, suffix: string) {
  const p = await prisma.project.create({ data: { name: `iso-${suffix}`, ownerId } });
  created.projectIds.push(p.id);
  return p;
}

before(async () => { srv = await listen(); });
after(async () => {
  try {
    await prisma.requestLog.deleteMany({ where: { projectId: { in: created.projectIds } } });
    await prisma.replayExecution.deleteMany({ where: { requestLog: { projectId: { in: created.projectIds } } } });
    await prisma.project.deleteMany({ where: { id: { in: created.projectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  } finally {
    await close(srv.server);
    await prisma.$disconnect();
  }
});

test("user cannot list another user's projects", async () => {
  const uA = await makeUser("A");
  const uB = await makeUser("B");
  await makeProject(uA.id, "A");
  await makeProject(uB.id, "B");
  const projectsA = await getProjects(uA.id);
  const projectsB = await getProjects(uB.id);
  assert.equal(projectsA.length, 1);
  assert.equal(projectsB.length, 1);
  assert.notEqual(projectsA[0].id, projectsB[0].id);
});

test("user cannot access another user's project API keys", async () => {
  const uA = await makeUser("A");
  const uB = await makeUser("B");
  const pA = await makeProject(uA.id, "A");
  // B tries to access A's project keys -> null
  const keys = await getProjectApiKeys(pA.id, uB.id);
  assert.equal(keys, null);
});

test("user cannot update another user's replay target", async () => {
  const uA = await makeUser("A");
  const uB = await makeUser("B");
  const pA = await makeProject(uA.id, "A");
  const updated = await updateProjectReplayBaseUrl(pA.id, uB.id, "http://example.com");
  assert.equal(updated, null);
});

test("user cannot revoke another user's API key", async () => {
  const uA = await makeUser("A");
  const uB = await makeUser("B");
  const pA = await makeProject(uA.id, "A");
  const key = await createApiKey(pA.id, uA.id);
  assert.ok(key);
  const revoked = await revokeApiKey(pA.id, key!.id, uB.id);
  assert.equal(revoked, false);
});

test("user cannot inspect another user's request", async () => {
  const uA = await makeUser("A");
  const uB = await makeUser("B");
  const pA = await makeProject(uA.id, "A");
  const rl = await prisma.requestLog.create({ data: { projectId: pA.id, method: "GET", path: "/x", statusCode: 200 } });
  const found = await requestIdService(rl.id, uB.id);
  assert.equal(found, null);
});

test("user cannot access another user's replay history", async () => {
  const uA = await makeUser("A");
  const uB = await makeUser("B");
  const pA = await makeProject(uA.id, "A");
  const rl = await prisma.requestLog.create({ data: { projectId: pA.id, method: "GET", path: "/x", statusCode: 200 } });
  const history = await replayHistoryService(rl.id, uB.id);
  assert.equal(history, null);
});

test("invalid API key is rejected (HTTP 401)", async () => {
  const res = await fetch(`http://127.0.0.1:${srv.port}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-devreplay-api-key": "dr_live_" + "0".repeat(64) },
    body: JSON.stringify({ method: "GET", path: "/x" }),
  });
  assert.equal(res.status, 401);
});

test("revoked API key is rejected (HTTP 401)", async () => {
  const u = await makeUser("R");
  const p = await makeProject(u.id, "R");
  const key = await createApiKey(p.id, u.id);
  assert.ok(key);
  // revoke
  await revokeApiKey(p.id, key!.id, u.id);
  // verify revoked in DB
  const dbKey = await prisma.apiKey.findUnique({ where: { id: key!.id } });
  assert.ok(dbKey!.revokedAt);
  // hit ingest with raw key (need raw key; createApiKey returned rawKey)
  const res = await fetch(`http://127.0.0.1:${srv.port}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-devreplay-api-key": key!.rawKey },
    body: JSON.stringify({ method: "GET", path: "/x" }),
  });
  assert.equal(res.status, 401);
});

test("API key derives project server-side (client projectId ignored)", async () => {
  const u = await makeUser("P");
  const p = await makeProject(u.id, "P");
  const key = await createApiKey(p.id, u.id);
  assert.ok(key);
  const res = await fetch(`http://127.0.0.1:${srv.port}/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-devreplay-api-key": key!.rawKey },
    body: JSON.stringify({ projectId: "fake-project-id", method: "GET", path: "/derived", statusCode: 200 }),
  });
  assert.equal(res.status, 201);
  const json = await res.json();
  const rl = await prisma.requestLog.findUnique({ where: { id: json.id } });
  assert.equal(rl!.projectId, p.id, "project derived from API key, not client");
  created.projectIds.push(p.id);
});