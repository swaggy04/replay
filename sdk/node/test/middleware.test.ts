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
  app.post("/users", (req, res) => res.status(201).json({ received: req.body, token: "resp-secret" }));
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
    body: JSON.stringify({ name: "Alice", password: "pw", nested: { token: "t" } }),
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
  assert.equal(users.responseBody.token, "[REDACTED]");
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
