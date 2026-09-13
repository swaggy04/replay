# DevReplay

> Capture, inspect, and replay API requests — built to understand how backend systems actually work.

DevReplay is a developer tool and learning project built around one core idea:

**An API request should not disappear after the response is sent.**

It captures HTTP requests flowing through its own backend, stores them, lets you inspect every detail, and replay them at any time — then compare the replayed result against the original.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Running the App](#running-the-app)
- [How Capture Works](#how-capture-works)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Database Schema](#database-schema)
- [Architecture](#architecture)
- [Roadmap](#roadmap)

---

## What It Does

| Feature | Description |
|---|---|
| **Capture** | Store HTTP requests with method, path, headers, query, body, status, response, and timing |
| **Auto-capture middleware** | Automatically records requests that include the `x-devreplay-project-id` header |
| **Inspect** | Browse captured requests per project with full detail view |
| **Replay** | Re-fire a stored request against the live backend and record the result |
| **Compare** | Diff the original response vs the replayed response — status, body, timing |
| **Projects** | Organise requests into named projects |
| **Pagination** | Paginated request list with per-project filtering |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| **Backend** | Node.js, Express 5, TypeScript |
| **Database** | PostgreSQL (Neon serverless) |
| **ORM** | Prisma 7 |
| **Runtime** | tsx (dev), compiled JS (prod) |

---

## Project Structure

```
replay/
├── src/                        # Backend source
│   ├── server.ts               # Entry point — starts Express on port 5000
│   ├── app.ts                  # Route definitions
│   ├── controllers/
│   │   ├── captureController.ts
│   │   ├── projectController.ts
│   │   ├── requestController.ts
│   │   └── replayController.ts
│   ├── services/
│   │   ├── captureService.ts
│   │   ├── projectService.ts
│   │   ├── replayService.ts
│   │   └── requestsService.ts
│   ├── middleware/
│   │   └── requestLogger.ts    # Auto-captures requests with x-devreplay-project-id header
│   └── lib/
│       └── prisma.ts
│
├── prisma/
│   └── schema.prisma           # DB schema: Project, ApiKey, RequestLog, ReplayExecution
│
├── frontend/                   # Next.js frontend (port 3001)
│   ├── app/
│   │   └── page.tsx
│   ├── components/
│   │   ├── Reqlist.tsx
│   │   ├── requestsApi.ts      # All frontend API calls
│   │   ├── requests/
│   │   │   ├── RequestSidebar.tsx
│   │   │   ├── RequestTable.tsx
│   │   │   └── RequestDetailsPanel.tsx
│   │   └── requestinspector/
│   │       ├── RequestInspector.tsx
│   │       ├── OverviewTab.tsx
│   │       ├── replaytab.tsx
│   │       └── RequestCompariosn.tsx
│   └── types/
│       └── request.ts
│
├── demo.ts                     # Seed script — creates a project and captures 6 requests
├── .env                        # DATABASE_URL
└── frontend/.env.local         # NEXT_PUBLIC_API_URL
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A PostgreSQL database (the project uses [Neon](https://neon.tech))

### Install dependencies

```bash
# Backend
cd replay
npm install

# Frontend
cd frontend
npm install
```

### Environment variables

**Backend** — `.env`:
```env
DATABASE_URL="your-postgres-connection-string"
```

**Frontend** — `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Generate Prisma client and run migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

---

## Running the App

Open two terminals:

**Terminal 1 — Backend (port 5000):**
```bash
npm run dev
# DevReplay running at http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# http://localhost:3001
```

Open **http://localhost:3001** to see the dashboard.

---

## How Capture Works

There are two ways to get requests into DevReplay:

### 1. Manual — POST /ingest

Send a request payload directly:

```json
POST /ingest
{
  "projectId": "your-project-id",
  "method": "POST",
  "path": "/users",
  "headers": { "content-type": "application/json" },
  "query": { "role": "admin" },
  "body": { "name": "Alice" },
  "statusCode": 201,
  "responseBody": { "message": "User created" },
  "durationMs": 18
}
```

### 2. Automatic — Middleware

Any request that includes the `x-devreplay-project-id` header is automatically captured.

```
GET /users
x-devreplay-project-id: your-project-id
```

The middleware skips: `/requests`, `/replay`, `/ingest`, `/_next`, `/favicon.ico`.

---

## API Reference

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/projects` | Create a project — body: `{ "name": "..." }` |
| `GET` | `/projects` | List all projects |

### Requests

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ingest` | Manually capture a request |
| `GET` | `/requests` | List requests — query: `page`, `limit`, `projectId` |
| `GET` | `/requests/:id` | Get a single request with replay history |
| `GET` | `/requests/:id/replays` | Get all replays for a request |
| `GET` | `/requests/:id/compare/:replayId` | Compare original vs replay |

### Replay

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/replay/:id` | Replay a captured request |

### Built-in Test Routes

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check — `"DevReplay is alive"` |
| `GET` | `/users` | Returns `{ message, query }` |
| `POST` | `/users` | Echoes body back as `201` |
| `GET` | `/plain` | Returns plain text |
| `GET` | `/error` | Throws an error (tests error handling) |

---

## Testing

### Demo Script

The fastest way to populate the dashboard with real data:

```bash
# Make sure the backend is running first
npx tsx demo.ts
```

This will:
1. Create a **Demo Project**
2. Hit all built-in routes and capture 6 requests
3. Replay the first one
4. Print a summary with all IDs and a link to the UI

Then open **http://localhost:3001** to see them in the dashboard.

---

### PowerShell

```powershell
# Create a project
Invoke-RestMethod -Method POST -Uri "http://localhost:5000/projects" `
  -ContentType "application/json" `
  -Body '{ "name": "My Project" }'

# Capture a request
Invoke-RestMethod -Method POST -Uri "http://localhost:5000/ingest" `
  -ContentType "application/json" `
  -Body '{
    "projectId": "YOUR_PROJECT_ID",
    "method": "GET",
    "path": "/users",
    "statusCode": 200,
    "durationMs": 10
  }'

# Replay a request
Invoke-RestMethod -Method POST -Uri "http://localhost:5000/replay/YOUR_REQUEST_ID"

# List requests
Invoke-RestMethod -Uri "http://localhost:5000/requests?projectId=YOUR_PROJECT_ID"
```

---

### Postman

1. Create a collection called **DevReplay**
2. Add collection variable: `baseUrl` = `http://localhost:5000`
3. Use the **Tests** tab to auto-save IDs:

```js
// After "Create Project"
pm.environment.set("projectId", pm.response.json().id);

// After "Ingest"
pm.environment.set("requestId", pm.response.json().id);

// After "Replay"
pm.environment.set("replayId", pm.response.json().replay.id);
```

**Suggested request order:**
```
POST  {{baseUrl}}/projects
POST  {{baseUrl}}/ingest
GET   {{baseUrl}}/requests?projectId={{projectId}}
GET   {{baseUrl}}/requests/{{requestId}}
POST  {{baseUrl}}/replay/{{requestId}}
GET   {{baseUrl}}/requests/{{requestId}}/replays
GET   {{baseUrl}}/requests/{{requestId}}/compare/{{replayId}}
```

---

## Database Schema

```
Project
  id, name, createdAt
  → has many RequestLog
  → has many ApiKey

RequestLog
  id, method, path, body, headers, query
  statusCode, responseBody, durationMs
  createdAt, projectId
  → has many ReplayExecution

ReplayExecution
  id, requestLogId
  statusCode, responseBody, durationMs
  createdAt
```

---

## Architecture

```
┌─────────────────────────────┐
│     Next.js Frontend         │  http://localhost:3001
│  RequestList / Inspector /   │
│  Replay / Compare views      │
└──────────────┬──────────────┘
               │ fetch()
               ▼
┌─────────────────────────────┐
│     Express Backend          │  http://localhost:5000
│                              │
│  requestLogger middleware    │  auto-captures flagged requests
│  Controllers                 │  route handlers
│  Services                    │  business logic
│  Prisma ORM                  │  database queries
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  PostgreSQL (Neon)           │
│  Project / RequestLog /      │
│  ReplayExecution             │
└─────────────────────────────┘
```

---

## Roadmap

### Done

- [x] Express backend with full request lifecycle
- [x] Prisma + PostgreSQL persistence
- [x] Manual request capture via `/ingest`
- [x] Auto-capture middleware via `x-devreplay-project-id` header
- [x] Request replay with result storage
- [x] Original vs replay diff (status + body)
- [x] Paginated request list with project filtering
- [x] Next.js frontend — sidebar, table, inspector, replay tab, compare view
- [x] Demo seed script

### In Progress

- [ ] Better error handling across all layers
- [ ] Improved replay behaviour for edge cases
- [ ] Cleaner backend architecture

### Planned

- [ ] External backend integration (connect DevReplay to other APIs)
- [ ] Backend-agnostic request interception
- [ ] Authentication handling in replay
- [ ] API key auth for the DevReplay API itself
- [ ] Production-ready architecture

---

## License

License to be added on public release.
