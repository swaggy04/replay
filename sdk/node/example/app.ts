import express from "express";
import { DevReplay } from "../src/index.js";

async function main() {
  const ingestEvents: any[] = [];
  let failIngest = false;

  const ingestApp = express();
  ingestApp.use(express.json({ limit: "256kb" }));
  ingestApp.post("/ingest", (req, res) => {
    if (failIngest) {
      return res.status(500).json({ message: "Simulated ingest failure" });
    }
    ingestEvents.push(req.body);
    return res.status(201).json({ id: `evt_${ingestEvents.length}`, message: "Request captured successfully" });
  });
  const ingestServer = ingestApp.listen(5055);

  const app = express();
  app.use(express.json()); // body parser before DevReplay middleware

  const devreplay = new DevReplay({
    apiKey: process.env.DEVREPLAY_API_KEY || `dr_live_${"0".repeat(64)}`,
    endpoint: process.env.DEVREPLAY_ENDPOINT || "http://127.0.0.1:5055",
    excludePaths: ["/ingest"],
  });

  // Middleware must come after body parsers and before application routes.
  app.use(devreplay.middleware());

  app.get("/demo/ok", (_req, res) => {
    res.json({ ok: true, message: "hello" });
  });

  app.post("/demo/echo", (req, res) => {
    res.status(201).json({ received: req.body });
  });

  app.get("/demo/bad", (_req, res) => {
    res.status(400).json({ error: "bad request" });
  });

  app.post("/demo/redact", (req, res) => {
    res.json({ ok: true, token: "response-token" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err instanceof Error ? err.message : "internal error" });
  });

  const appServer = app.listen(5056);
  const base = "http://127.0.0.1:5056";

  console.log("1) Successful GET request");
  let r = await fetch(`${base}/demo/ok`);
  console.log("GET /demo/ok ->", r.status, await r.json());

  console.log("2) Successful POST request");
  r = await fetch(`${base}/demo/echo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Alice", nested: { ok: true } }),
  });
  console.log("POST /demo/echo ->", r.status, await r.json());

  console.log("3) 400 response");
  r = await fetch(`${base}/demo/bad`);
  console.log("GET /demo/bad ->", r.status, await r.json());

  console.log("4) Redaction of password and authorization header");
  r = await fetch(`${base}/demo/redact`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer super-secret",
    },
    body: JSON.stringify({
      password: "plain-password",
      nested: { token: "abc", accessToken: "def", refreshToken: "ghi", secret: "s", apiKey: "k" },
      items: [{ password: "p2" }],
    }),
  });
  console.log("POST /demo/redact ->", r.status, await r.json());

  await wait(250); // allow async uploads before failing ingest

  console.log("5) Ingestion failure that does not break the application response");
  failIngest = true;
  r = await fetch(`${base}/demo/ok`);
  console.log("GET /demo/ok (ingest failing) ->", r.status, await r.json());

  await wait(400);

  console.log(`\nMock ingest captured ${ingestEvents.length} event(s) before failure mode`);
  const redactEvent = ingestEvents.find((e) => e.path === "/demo/redact");
  if (redactEvent) {
    console.log("Captured auth header:", redactEvent.headers?.authorization);
    console.log("Captured request body:", JSON.stringify(redactEvent.body));
    console.log("Captured response token:", redactEvent.responseBody?.token);
  } else {
    console.log("Redaction event not found in captured events (unexpected for demo).");
  }

  await closeServer(appServer);
  await closeServer(ingestServer);
  console.log("Example finished successfully.");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function closeServer(server: import("node:http").Server) {
  return new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
}

main().catch((err) => {
  console.error("Example failed:", err);
  process.exitCode = 1;
});
