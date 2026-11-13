import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { Server } from "node:http";
import { DevReplay, resolveOptions } from "../src/index.js";

async function listen(app: express.Express): Promise<{ server: Server; port: number }> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("Failed to bind test server");
  return { server, port: addr.port };
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("captures request/response data and redacts sensitive values", async () => {
  const events: any[] = [];
  const ingest = express();
  ingest.use(express.json());
  ingest.post("/ingest", (req, res) => {
    events.push(req.body);
    res.status(201).json({ id: "ok" });
  });
  const ingestSrv = await listen(ingest);

  const app = express();
  app.use(express.json());
  const sdk = new DevReplay({
    apiKey: `dr_live_${"a".repeat(64)}`,
    endpoint: `http://127.0.0.1:${ingestSrv.port}`,
  });
  app.use(sdk.middleware());
  app.get("/ok", (_req, res) => res.json({ hello: "world" }));
  app.post("/users", (req, res) => res.status(201).json({ received: req.body, access_token: "resp-secret" }));
  app.get("/bad", (_req, res) => res.status(400).json({ error: "bad" }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  let res = await fetch(`${base}/ok`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { hello: "world" });

  res = await fetch(`${base}/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer should-not-leak",
    },
    body: JSON.stringify({ name: "Alice", password: "pw", nested: { token: "t", client_secret: "cs" } }),
  });
  assert.equal(res.status, 201);
  await res.json();

  res = await fetch(`${base}/bad`);
  assert.equal(res.status, 400);
  await res.json();

  await wait(350);

  const byPath = new Map(events.map((e) => [e.path, e]));
  assert.ok(byPath.has("/ok"));
  assert.ok(byPath.has("/users"));
  assert.ok(byPath.has("/bad"));

  const users = byPath.get("/users");
  assert.equal(users.method, "POST");
  assert.equal(users.statusCode, 201);
  assert.equal(users.headers.authorization, "[REDACTED]");
  assert.equal(users.body.password, "[REDACTED]");
  assert.equal(users.body.nested.token, "[REDACTED]");
  assert.equal(users.body.nested.client_secret, "[REDACTED]");
  assert.equal(users.responseBody.access_token, "[REDACTED]");
  assert.equal(typeof users.durationMs, "number");

  await close(appSrv.server);
  await close(ingestSrv.server);
});

test("does not block app response when ingest fails and excludes configured paths", async () => {
  let hits = 0;
  const ingest = express();
  ingest.use(express.json());
  ingest.post("/ingest", (_req, res) => {
    hits++;
    res.status(500).json({ error: "boom" });
  });
  const ingestSrv = await listen(ingest);

  const app = express();
  app.use(express.json());
  const sdk = new DevReplay({
    apiKey: `dr_live_${"b".repeat(64)}`,
    endpoint: `http://127.0.0.1:${ingestSrv.port}`,
    excludePaths: ["/ingest", "/health"],
  });
  app.use(sdk.middleware());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/ok", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  let res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  res = await fetch(`${base}/ok`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });

  await wait(350);
  assert.equal(hits, 1, "only /ok should be captured and uploaded");

  await close(appSrv.server);
  await close(ingestSrv.server);
});

test("passes through when API key is missing/invalid (no upload attempted)", async () => {
  const app = express();
  app.use(express.json());
  const sdk = new DevReplay({ apiKey: "", endpoint: "http://127.0.0.1:9" });
  app.use(sdk.middleware());
  app.get("/ok", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);

  const res = await fetch(`http://127.0.0.1:${appSrv.port}/ok`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });

  await close(appSrv.server);
});

test("bounds concurrent uploads and queues events without blocking responses", async () => {
  const received: any[] = [];
  let ingestHits = 0;
  let active = 0;
  let maxActive = 0;
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest", async (req, res) => {
    ingestHits++;
    active++;
    maxActive = Math.max(maxActive, active);
    received.push(req.body);
    await wait(80);
    active--;
    res.status(201).json({ id: String(ingestHits) });
  });
  ingest.post("/ingest/batch", async (req, res) => {
    ingestHits++;
    active++;
    maxActive = Math.max(maxActive, active);
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    received.push(...events);
    await wait(80);
    active--;
    res.status(201).json({ accepted: events.length, duplicates: 0, failed: 0, results: [] });
  });
  const ingestSrv = await listen(ingest);

  const warnings: string[] = [];
  const logger = {
    warn: (msg: string) => warnings.push(msg),
    error: (_msg: string) => {},
  };

  const app = express();
  const sdk = new DevReplay({
    apiKey: `dr_live_${"c".repeat(64)}`,
    endpoint: `http://127.0.0.1:${ingestSrv.port}`,
    maxConcurrentUploads: 1, // Day 2: interpreted as bounded batch upload concurrency
    maxBatchSize: 1,
    flushIntervalMs: 10,
    logger,
  });
  app.use(sdk.middleware());
  app.get("/n/:id", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  const responses = await Promise.all([
    fetch(`${base}/n/1`),
    fetch(`${base}/n/2`),
    fetch(`${base}/n/3`),
  ]);
  for (const r of responses) {
    assert.equal(r.status, 200);
    await r.json();
  }

  await sdk.flush(3000);
  assert.equal(received.length, 3, "all captured events should be queued and delivered");
  assert.equal(maxActive, 1, "batch upload concurrency should be bounded");
  assert.ok(!warnings.some((w) => w.includes("Dropping capture event")), "events should not be dropped when queue has capacity");

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(ingestSrv.server);
});

test("does not record incomplete response bodies for chunked/streamed responses", async () => {
  const events: any[] = [];
  const ingest = express();
  ingest.use(express.json());
  ingest.post("/ingest", (req, res) => {
    events.push(req.body);
    res.status(201).json({ id: "ok" });
  });
  const ingestSrv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay({
    apiKey: `dr_live_${"d".repeat(64)}`,
    endpoint: `http://127.0.0.1:${ingestSrv.port}`,
  });
  app.use(sdk.middleware());
  app.get("/chunked", (_req, res) => {
    res.setHeader("content-type", "text/plain");
    res.write("part1");
    res.write("part2");
    res.end("part3");
  });
  const appSrv = await listen(app);

  const res = await fetch(`http://127.0.0.1:${appSrv.port}/chunked`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "part1part2part3");

  await wait(350);
  assert.equal(events.length, 1);
  assert.equal(events[0].path, "/chunked");
  assert.equal(events[0].responseBody, "[STREAMED_RESPONSE_BODY_NOT_CAPTURED]");

  await close(appSrv.server);
  await close(ingestSrv.server);
});

test("preserves response method overloads and Express behavior", async () => {
  const events: any[] = [];
  const ingest = express();
  ingest.use(express.json());
  ingest.post("/ingest", (req, res) => {
    events.push(req.body);
    res.status(201).json({ id: "ok" });
  });
  const ingestSrv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay({
    apiKey: `dr_live_${"e".repeat(64)}`,
    endpoint: `http://127.0.0.1:${ingestSrv.port}`,
  });
  app.use(sdk.middleware());
  app.get("/status-only", (_req, res) => {
    res.status(204).end();
  });
  app.get("/send-buffer", (_req, res) => {
    res.type("text/plain").send(Buffer.from("hello"));
  });
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  let res = await fetch(`${base}/status-only`);
  assert.equal(res.status, 204);
  assert.equal(await res.text(), "");

  res = await fetch(`${base}/send-buffer`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "hello");

  await wait(350);
  const byPath = new Map(events.map((e) => [e.path, e]));
  assert.equal(byPath.get("/status-only")?.statusCode, 204);
  assert.ok(byPath.has("/send-buffer"));

  await close(appSrv.server);
  await close(ingestSrv.server);
});

test("middleware error handling does not call next twice and validates endpoint URLs", async () => {
  // Invalid endpoint is normalized to empty and uploads disabled with warning (no crash).
  const warnings: string[] = [];
  const opts = resolveOptions({
    apiKey: `dr_live_${"f".repeat(64)}`,
    endpoint: "not-a-url",
    logger: { warn: (m: string) => warnings.push(m), error: (_m: string) => {} },
  } as any);
  assert.equal(opts.endpoint, "");
  assert.ok(warnings.some((w) => w.includes("Invalid endpoint URL")));

  // next() must only be called once even if it throws synchronously.
  let nextCalls = 0;
  const app = express();
  const sdk = new DevReplay({ apiKey: `dr_live_${"f".repeat(64)}`, endpoint: "http://127.0.0.1:9" });
  app.use(sdk.middleware());
  app.use((_req, _res, next) => {
    nextCalls++;
    next(new Error("boom"));
  });
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: err.message });
  });
  const appSrv = await listen(app);
  const res = await fetch(`http://127.0.0.1:${appSrv.port}/anything`);
  assert.equal(res.status, 500);
  assert.equal(nextCalls, 1);

  await close(appSrv.server);
});

test("applies payload size limits to query parameters during capture", async () => {
  const events: any[] = [];
  const ingest = express();
  ingest.use(express.json());
  ingest.post("/ingest", (req, res) => {
    events.push(req.body);
    res.status(201).json({ id: "ok" });
  });
  const ingestSrv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay({
    apiKey: `dr_live_${"1".repeat(64)}`,
    endpoint: `http://127.0.0.1:${ingestSrv.port}`,
    maxBodySize: 80,
  });
  app.use(sdk.middleware());
  app.get("/search", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);

  const long = "x".repeat(300);
  const res = await fetch(`http://127.0.0.1:${appSrv.port}/search?q=${long}`);
  assert.equal(res.status, 200);
  await res.json();

  await wait(350);
  assert.equal(events.length, 1);
  assert.equal(events[0].query.__devreplay_truncated, true);

  await close(appSrv.server);
  await close(ingestSrv.server);
});
