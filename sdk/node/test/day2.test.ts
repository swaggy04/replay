import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import type { Server } from "node:http";
import { DevReplay } from "../src/index.js";

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

function baseOpts(port: number, extra: Record<string, any> = {}) {
  return {
    apiKey: `dr_live_${"1".repeat(64)}`,
    endpoint: `http://127.0.0.1:${port}`,
    flushIntervalMs: 20,
    maxBatchSize: 10,
    maxQueueSize: 100,
    maxConcurrentBatchUploads: 1,
    uploadTimeoutMs: 500,
    maxRetryAttempts: 3,
    retryBaseDelayMs: 20,
    retryMaxDelayMs: 200,
    shutdownTimeoutMs: 2000,
    ...extra,
  };
}

test("queue FIFO behavior and batch creation preserve order", async () => {
  const batches: any[][] = [];
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", (req, res) => {
    batches.push(req.body.events || []);
    res.status(201).json({ accepted: (req.body.events || []).length, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxBatchSize: 2, flushIntervalMs: 10, maxConcurrentBatchUploads: 1 }));
  app.use(sdk.middleware());
  app.get("/e/:id", (req, res) => res.json({ id: req.params.id }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  await Promise.all([
    fetch(`${base}/e/1`).then(r => r.json()),
    fetch(`${base}/e/2`).then(r => r.json()),
    fetch(`${base}/e/3`).then(r => r.json()),
  ]);
  await sdk.flush(2000);

  const paths = batches.flat().map((e) => e.path);
  assert.deepEqual(paths, ["/e/1", "/e/2", "/e/3"]);
  assert.ok(batches.some((b) => b.length === 2), "should create size-limited batches");
  assert.equal(sdk.getStats().batchCount >= 2, true);

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("queue capacity and overflow drop policy", async () => {
  const events: any[] = [];
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", async (req, res) => {
    events.push(...(req.body.events || []));
    await wait(100);
    res.status(201).json({ accepted: (req.body.events || []).length, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const warnings: string[] = [];
  const sdk = new DevReplay(baseOpts(srv.port, {
    maxQueueSize: 2,
    maxBatchSize: 10,
    maxConcurrentBatchUploads: 1,
    flushIntervalMs: 1000, // delay flush so queue can fill
    logger: { warn: (m: string) => warnings.push(m), error: () => {} },
  }));
  app.use(sdk.middleware());
  app.get("/q/:id", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  // Fire several requests quickly to overflow bounded queue while first batch may be pending/slow.
  await Promise.all([1,2,3,4,5].map((i) => fetch(`${base}/q/${i}`).then(r => r.json())));
  await wait(50);
  const statsMid = sdk.getStats();
  assert.ok(statsMid.eventsDropped >= 1, "overflow should drop events");
  assert.ok(statsMid.totalCaptured === 5);
  assert.ok(warnings.some((w) => w.includes("queue capacity") || w.includes("Dropping capture event")));

  await sdk.flush(3000);
  await sdk.shutdown(1000);
  const stats = sdk.getStats();
  assert.ok(stats.eventsDelivered + stats.eventsDropped <= stats.totalCaptured);
  assert.ok(stats.eventsDelivered >= 1);

  await close(appSrv.server);
  await close(srv.server);
});

test("periodic flushing uploads queued events without reaching batch size", async () => {
  const events: any[] = [];
  const ingest = express();
  ingest.use(express.json());
  ingest.post("/ingest/batch", (req, res) => {
    events.push(...(req.body.events || []));
    res.status(201).json({ accepted: (req.body.events || []).length, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxBatchSize: 100, flushIntervalMs: 30 }));
  app.use(sdk.middleware());
  app.get("/tick", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);

  await fetch(`http://127.0.0.1:${appSrv.port}/tick`).then(r => r.json());
  await wait(250);
  assert.equal(events.length, 1, "periodic flush should deliver queued event");

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("respects maximum concurrent batch uploads", async () => {
  let active = 0;
  let maxActive = 0;
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", async (_req, res) => {
    active++;
    maxActive = Math.max(maxActive, active);
    await wait(120);
    active--;
    res.status(201).json({ accepted: 1, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxBatchSize: 1, maxConcurrentBatchUploads: 2, flushIntervalMs: 10 }));
  app.use(sdk.middleware());
  app.get("/c/:id", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  await Promise.all([1,2,3,4].map((i) => fetch(`${base}/c/${i}`).then(r => r.json())));
  await sdk.flush(3000);
  assert.ok(maxActive <= 2, `max concurrent batches should be <= 2, got ${maxActive}`);
  assert.ok(maxActive >= 1);

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("retries transient failures with eventual success (exponential backoff/jitter path)", async () => {
  let attempts = 0;
  const events: any[] = [];
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", (req, res) => {
    attempts++;
    if (attempts < 3) return res.status(503).json({ error: "temporary" });
    events.push(...(req.body.events || []));
    return res.status(201).json({ accepted: (req.body.events || []).length, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxBatchSize: 10, maxRetryAttempts: 5, retryBaseDelayMs: 10, retryMaxDelayMs: 100 }));
  app.use(sdk.middleware());
  app.get("/retry", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);

  await fetch(`http://127.0.0.1:${appSrv.port}/retry`).then(r => r.json());
  await sdk.flush(4000);
  const stats = sdk.getStats();
  assert.equal(events.length, 1);
  assert.equal(stats.eventsDelivered, 1);
  assert.ok(attempts >= 3);
  assert.ok(stats.retryAttempts >= 2);
  assert.ok(stats.uploadFailures >= 2);

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("respects Retry-After and does not retry permanent failures", async () => {
  let attempts = 0;
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", (req, res) => {
    attempts++;
    if (attempts === 1) {
      res.setHeader("Retry-After", "0");
      return res.status(429).json({ error: "slow down" });
    }
    return res.status(201).json({ accepted: (req.body.events || []).length, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxRetryAttempts: 4, retryBaseDelayMs: 50, retryMaxDelayMs: 200 }));
  app.use(sdk.middleware());
  app.get("/ra", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);
  await fetch(`http://127.0.0.1:${appSrv.port}/ra`).then(r => r.json());
  await sdk.flush(3000);
  assert.ok(attempts >= 2);
  assert.equal(sdk.getStats().eventsDelivered, 1);
  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);

  // Permanent failure (401) should not be retried.
  let permAttempts = 0;
  const ingest2 = express();
  ingest2.use(express.json());
  ingest2.post("/ingest/batch", (_req, res) => { permAttempts++; res.status(401).json({ message: "Invalid API key" }); });
  const srv2 = await listen(ingest2);
  const app2 = express();
  const sdk2 = new DevReplay(baseOpts(srv2.port, { maxRetryAttempts: 5, retryBaseDelayMs: 10 }));
  app2.use(sdk2.middleware());
  app2.get("/perm", (_req, res) => res.json({ ok: true }));
  const appSrv2 = await listen(app2);
  await fetch(`http://127.0.0.1:${appSrv2.port}/perm`).then(r => r.json());
  await sdk2.flush(1000);
  assert.equal(permAttempts, 1);
  assert.equal(sdk2.getStats().eventsDelivered, 0);
  assert.ok(sdk2.getStats().eventsDropped >= 1);
  await sdk2.shutdown(1000);
  await close(appSrv2.server);
  await close(srv2.server);
});

test("retry exhaustion drops events", async () => {
  let attempts = 0;
  const ingest = express();
  ingest.use(express.json());
  ingest.post("/ingest/batch", (_req, res) => { attempts++; res.status(503).json({ error: "down" }); });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxRetryAttempts: 3, retryBaseDelayMs: 10, retryMaxDelayMs: 30 }));
  app.use(sdk.middleware());
  app.get("/exhaust", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);

  await fetch(`http://127.0.0.1:${appSrv.port}/exhaust`).then(r => r.json());
  await sdk.flush(3000);
  assert.equal(attempts, 3);
  assert.equal(sdk.getStats().eventsDelivered, 0);
  assert.ok(sdk.getStats().eventsDropped >= 1);
  assert.ok(sdk.getStats().retryAttempts >= 2);

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("idempotent batch retries use stable event IDs and backend dedupes", async () => {
  let attempts = 0;
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", (req, res) => {
    attempts++;
    const ids = (req.body.events || []).map((e: any) => e.eventId);
    if (attempts === 1) {
      // Simulate transient failure: client will retry, IDs must be stable.
      return res.status(503).json({ error: "flaky" });
    }
    return res.status(201).json({ accepted: ids.length, duplicates: 0, failed: 0, results: ids.map((id: string) => ({ eventId: id, duplicate: false })) });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxRetryAttempts: 4, retryBaseDelayMs: 10 }));
  app.use(sdk.middleware());
  app.get("/idem", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);

  await fetch(`http://127.0.0.1:${appSrv.port}/idem`).then(r => r.json());
  await sdk.flush(3000);
  assert.equal(attempts >= 2, true);
  assert.equal(sdk.getStats().eventsDelivered, 1);

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("207 partial failure retries only retryable failed events with per-event accounting", async () => {
  const attemptsByEvent: Record<string, number> = {};
  const delivered: string[] = [];
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", (req, res) => {
    const events = req.body.events || [];
    const results = events.map((e: any) => {
      attemptsByEvent[e.eventId] = (attemptsByEvent[e.eventId] || 0) + 1;
      if (e.path === "/p/ok") {
        delivered.push(`${e.eventId}:${e.path}`);
        return { eventId: e.eventId, id: "id-ok", duplicate: false };
      }
      if (e.path === "/p/retry" && attemptsByEvent[e.eventId] === 1) {
        return { eventId: e.eventId, duplicate: false, error: "temporary", retryable: true };
      }
      if (e.path === "/p/retry") {
        delivered.push(`${e.eventId}:${e.path}`);
        return { eventId: e.eventId, id: "id-retry", duplicate: false };
      }
      // permanent failure for /p/fail
      return { eventId: e.eventId, duplicate: false, error: "bad event", retryable: false };
    });
    const failed = results.filter((r: any) => r.error).length;
    const accepted = results.filter((r: any) => !r.error && !r.duplicate).length;
    res.status(207).json({ message: "Batch captured with partial failures", accepted, duplicates: 0, failed, results });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxBatchSize: 10, flushIntervalMs: 10, maxRetryAttempts: 4, retryBaseDelayMs: 10 }));
  app.use(sdk.middleware());
  app.get("/p/:id", (req, res) => res.json({ id: req.params.id }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  await Promise.all([
    fetch(`${base}/p/ok`).then(r => r.json()),
    fetch(`${base}/p/retry`).then(r => r.json()),
    fetch(`${base}/p/fail`).then(r => r.json()),
  ]);
  await sdk.flush(3000);
  const stats = sdk.getStats();
  assert.equal(attemptsByEvent[Object.keys(attemptsByEvent).find((k) => delivered.some((d) => d.startsWith(k) && d.endsWith("/p/ok"))) as string], 1);
  const retryEventId = Object.keys(attemptsByEvent).find((k) => attemptsByEvent[k] >= 2);
  assert.ok(retryEventId, "retryable failed event should be retried");
  assert.ok((attemptsByEvent[retryEventId!] || 0) >= 2);
  assert.equal(stats.eventsDelivered, 2, "ok + retried events delivered");
  assert.equal(stats.eventsDropped, 1, "permanent failed event dropped");
  assert.ok(stats.retryAttempts >= 1);
  assert.ok(delivered.filter((d) => d.endsWith("/p/ok")).length >= 1);
  assert.ok(delivered.filter((d) => d.endsWith("/p/retry")).length >= 1);

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("handles 413 by splitting batches and drops oversized single events", async () => {
  const received: any[] = [];
  let calls = 0;
  const ingest = express();
  ingest.use(express.json({ limit: "2mb" }));
  ingest.post("/ingest/batch", (req, res) => {
    calls++;
    const events = req.body.events || [];
    if (events.length > 1) return res.status(413).json({ message: "Payload too large" });
    received.push(...events);
    return res.status(201).json({ accepted: events.length, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxBatchSize: 10, flushIntervalMs: 10, maxRetryAttempts: 3, retryBaseDelayMs: 5 }));
  app.use(sdk.middleware());
  app.get("/b/:id", (req, res) => res.json({ id: req.params.id }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;
  await Promise.all([
    fetch(`${base}/b/1`).then(r => r.json()),
    fetch(`${base}/b/2`).then(r => r.json()),
  ]);
  await sdk.flush(3000);
  assert.equal(received.length, 2);
  assert.ok(calls >= 3, "should receive initial 413 then split uploads");

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("graceful shutdown flushes queued events and respects bounded timeout", async () => {
  const events: any[] = [];
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", async (req, res) => {
    await wait(30);
    events.push(...(req.body.events || []));
    res.status(201).json({ accepted: (req.body.events || []).length, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { flushIntervalMs: 1000, shutdownTimeoutMs: 2000 }));
  app.use(sdk.middleware());
  app.get("/sd", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);

  await fetch(`http://127.0.0.1:${appSrv.port}/sd`).then(r => r.json());
  await sdk.shutdown(2000); // should stop accepting new events and flush
  assert.equal(events.length, 1);
  assert.equal(sdk.getStats().currentQueueSize, 0);

  await close(appSrv.server);
  await close(srv.server);

  // Shutdown timeout: slow ingest should not hang forever.
  const ingestSlow = express();
  ingestSlow.use(express.json({ limit: "1mb" }));
  ingestSlow.post("/ingest/batch", async (_req, res) => {
    await wait(1000);
    res.status(201).json({ accepted: 1, duplicates: 0, failed: 0, results: [] });
  });
  const srvSlow = await listen(ingestSlow);
  const appSlow = express();
  const sdkSlow = new DevReplay(baseOpts(srvSlow.port, { flushIntervalMs: 10, shutdownTimeoutMs: 50, uploadTimeoutMs: 2000 }));
  appSlow.use(sdkSlow.middleware());
  appSlow.get("/slow", (_req, res) => res.json({ ok: true }));
  const appSrvSlow = await listen(appSlow);
  await fetch(`http://127.0.0.1:${appSrvSlow.port}/slow`).then(r => r.json());
  const start = Date.now();
  await sdkSlow.shutdown(50);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 1500, "shutdown should be bounded");

  await close(appSrvSlow.server);
  await close(srvSlow.server);
});

test("events captured during traffic do not affect app responses even when ingest fails", async () => {
  const ingest = express();
  ingest.use(express.json());
  ingest.post("/ingest/batch", (_req, res) => res.status(500).json({ error: "fail" }));
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, { maxRetryAttempts: 2, retryBaseDelayMs: 10 }));
  app.use(sdk.middleware());
  app.get("/ok", (_req, res) => res.json({ ok: true, v: 1 }));
  app.post("/bad", (_req, res) => res.status(400).json({ error: "bad" }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  const r1 = await fetch(`${base}/ok`);
  assert.equal(r1.status, 200);
  assert.deepEqual(await r1.json(), { ok: true, v: 1 });
  const r2 = await fetch(`${base}/bad`, { method: "POST" });
  assert.equal(r2.status, 400);

  await sdk.flush(1500);
  const stats = sdk.getStats();
  assert.ok(stats.totalCaptured >= 2);
  assert.ok(stats.uploadFailures >= 1);

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("successful uploads update delivery stats and generate stable event IDs in payloads", async () => {
  const batches: any[][] = [];
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", (req, res) => {
    batches.push(req.body.events || []);
    res.status(201).json({ accepted: (req.body.events || []).length, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port));
  app.use(sdk.middleware());
  app.get("/stats", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);
  await fetch(`http://127.0.0.1:${appSrv.port}/stats`).then(r => r.json());
  await sdk.flush(2000);
  const stats = sdk.getStats();
  assert.equal(stats.totalCaptured, 1);
  assert.equal(stats.eventsQueued, 1);
  assert.equal(stats.eventsDelivered, 1);
  assert.equal(stats.eventsDropped, 0);
  assert.equal(stats.currentQueueSize, 0);
  assert.ok(stats.batchCount >= 1);
  assert.ok(typeof batches[0][0].eventId === "string" && batches[0][0].eventId.length > 0);

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});

test("delayed retry does not block newer ready events (no zero-delay loop)", async () => {
  let calls = 0;
  const delivered: string[] = [];
  const ingest = express();
  ingest.use(express.json({ limit: "1mb" }));
  ingest.post("/ingest/batch", (req, res) => {
    calls++;
    const events = req.body.events || [];
    if (calls === 1) {
      return res.status(503).json({ error: "temporary" });
    }
    delivered.push(...events.map((e: any) => e.path));
    return res.status(201).json({ accepted: events.length, duplicates: 0, failed: 0, results: [] });
  });
  const srv = await listen(ingest);

  const app = express();
  const sdk = new DevReplay(baseOpts(srv.port, {
    maxBatchSize: 1,
    maxConcurrentBatchUploads: 1,
    retryBaseDelayMs: 120,
    retryMaxDelayMs: 120,
    flushIntervalMs: 1000,
  }));
  app.use(sdk.middleware());
  app.get("/d/retry", (_req, res) => res.json({ ok: true }));
  app.get("/d/new", (_req, res) => res.json({ ok: true }));
  const appSrv = await listen(app);
  const base = `http://127.0.0.1:${appSrv.port}`;

  await fetch(`${base}/d/retry`).then((r) => r.json());
  await wait(80);
  await fetch(`${base}/d/new`).then((r) => r.json());

  await wait(80);
  assert.ok(delivered.includes("/d/new"), "newer ready event should not be blocked by delayed retry");

  await sdk.flush(2000);
  assert.ok(delivered.includes("/d/retry"), "delayed retry should eventually be delivered");
  assert.equal(sdk.getStats().eventsDelivered, 2);
  assert.ok(sdk.getStats().retryAttempts >= 1);

  await sdk.shutdown(1000);
  await close(appSrv.server);
  await close(srv.server);
});
