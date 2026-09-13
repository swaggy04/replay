/**
 * DevReplay — Demo Seed Script
 *
 * Run this while the backend is running on port 5000:
 *   npx tsx demo.ts
 *
 * What it does:
 *   1. Creates a "Demo Project"
 *   2. Hits real backend routes (GET /users, POST /users, GET /plain, GET /)
 *   3. Captures each request into DevReplay via POST /ingest
 *   4. Replays one of the captured requests
 *   5. Prints a full summary
 */

const BASE = "http://localhost:5000";

function log(msg: string) {
  console.log(`\n${"─".repeat(50)}\n${msg}`);
}
function ok(label: string, data: unknown) {
  console.log(`  ✅ ${label}:`, JSON.stringify(data, null, 2));
}
function fail(label: string, error: unknown) {
  console.log(`  ❌ ${label}:`, error);
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function get(path: string) {
  const start = Date.now();
  const res = await fetch(`${BASE}${path}`);
  const durationMs = Date.now() - start;
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);
  return { status: res.status, data, durationMs };
}

async function ingest(projectId: string, method: string, path: string, opts: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  statusCode: number;
  responseBody?: unknown;
  durationMs: number;
}) {
  const res = await post("/ingest", {
    projectId, method, path,
    headers: opts.headers ?? { accept: "application/json" },
    query: opts.query,
    body: opts.body,
    statusCode: opts.statusCode,
    responseBody: opts.responseBody,
    durationMs: opts.durationMs,
  });
  return res.data;
}

async function main() {
  console.log("\n🚀 DevReplay Demo Seed Script\n");

  // Step 1 — Create project
  log("Step 1 — Creating Demo Project");
  const { data: project } = await post("/projects", { name: "Demo Project" });
  if (!project?.id) {
    console.error("❌ Failed. Is the backend running on port 5000?");
    process.exit(1);
  }
  ok("Project created", { id: project.id, name: project.name });
  const projectId: string = project.id;

  // Step 2 — Hit real routes & capture
  log("Step 2 — Hitting real routes & capturing");
  const captured: { label: string; id: string }[] = [];

  const routes: Array<() => Promise<void>> = [
    async () => {
      const r = await get("/users");
      const l = await ingest(projectId, "GET", "/users", { statusCode: r.status, responseBody: r.data, durationMs: r.durationMs });
      ok("GET /users", { id: l.id, status: r.status }); captured.push({ label: "GET /users", id: l.id });
    },
    async () => {
      const r = await get("/users?role=admin");
      const l = await ingest(projectId, "GET", "/users", { query: { role: "admin" }, statusCode: r.status, responseBody: r.data, durationMs: r.durationMs });
      ok("GET /users?role=admin", { id: l.id }); captured.push({ label: "GET /users?role=admin", id: l.id });
    },
    async () => {
      const body = { name: "Alice Demo", email: "alice@devreplay.dev" };
      const r = await post("/users", body);
      const l = await ingest(projectId, "POST", "/users", { headers: { "content-type": "application/json" }, body, statusCode: r.status, responseBody: r.data, durationMs: 12 });
      ok("POST /users", { id: l.id, status: r.status }); captured.push({ label: "POST /users", id: l.id });
    },
    async () => {
      const r = await get("/plain");
      const l = await ingest(projectId, "GET", "/plain", { statusCode: r.status, responseBody: r.data, durationMs: r.durationMs });
      ok("GET /plain", { id: l.id }); captured.push({ label: "GET /plain", id: l.id });
    },
    async () => {
      const r = await get("/");
      const l = await ingest(projectId, "GET", "/", { statusCode: r.status, responseBody: r.data, durationMs: r.durationMs });
      ok("GET /", { id: l.id }); captured.push({ label: "GET /", id: l.id });
    },
    async () => {
      const l = await ingest(projectId, "GET", "/not-found", { statusCode: 404, responseBody: { message: "Not found" }, durationMs: 2 });
      ok("Simulated 404", { id: l.id }); captured.push({ label: "GET /not-found (404)", id: l.id });
    },
  ];

  for (const route of routes) {
    try { await route(); } catch (e) { fail("Route failed", e); }
  }

  // Step 3 — Replay first request
  log("Step 3 — Replaying first captured request");
  if (captured[0]) {
    try {
      const r = await post(`/replay/${captured[0].id}`, {});
      ok(`Replayed "${captured[0].label}"`, { replayId: r.data?.replay?.id, status: r.data?.status });
    } catch (e) { fail("Replay", e); }
  }

  // Summary
  log("Summary");
  console.log(`  📦 Project ID : ${projectId}`);
  console.log(`  📋 Captured   : ${captured.length} requests`);
  captured.forEach(({ label, id }) => console.log(`     • ${label.padEnd(28)} → ${id}`));
  console.log(`\n  🌐 Open http://localhost:3001`);
  console.log(`  🔍 API: http://localhost:5000/requests?projectId=${projectId}\n`);
}

main().catch((err) => { console.error("\n💥 Crashed:", err); process.exit(1); });
