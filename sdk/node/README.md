# @devreplay/node (Day 1)

Initial Express SDK for capturing HTTP requests/responses and forwarding them to DevReplay's existing `POST /ingest` endpoint.

## Install & build (local package)

```bash
cd sdk/node
npm install
npm run build
```

## Usage

```ts
import express from "express";
import { DevReplay } from "@devreplay/node";

const app = express();

// Body parsers must run first so req.body/query are available to the SDK.
app.use(express.json());

const devreplay = new DevReplay({
  apiKey: process.env.DEVREPLAY_API_KEY!,
  endpoint: "http://localhost:5000", // DevReplay backend base URL
  // excludePaths: ["/ingest", "/health"], // optional
  // maxBodySize: 64 * 1024,               // optional
  // uploadTimeoutMs: 2000,                // optional
});

// DevReplay middleware must come after body parsers and before application routes.
app.use(devreplay.middleware());

app.get("/users", (_req, res) => res.json({ ok: true }));
```

## Day 1 behavior

- Captures `GET|POST|PUT|PATCH|DELETE` requests on response completion (`finish`)
- Records method, path, query, headers, request body, status, response body (JSON/plain text when safely available), and duration
- Uploads asynchronously after response completion (non-blocking), with timeout and failure isolation
- Authenticates uploads with `x-devreplay-api-key`; backend derives project from the verified API key
- Redacts sensitive headers and sensitive body fields (nested objects/arrays supported)
- Excludes `/ingest` by default and supports configurable excluded paths
- Omits multipart/binary request bodies in this initial implementation and truncates oversized payloads with explicit markers

## Scripts

- `npm run build` — TypeScript build
- `npm test` — build + Node test runner tests
- `npm run example` — run demo Express app with mock ingest server
