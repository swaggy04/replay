# DevReplay

> Inspect, understand, and replay API requests while learning how backend systems actually work.

DevReplay is an API debugging and replay tool built around a simple idea:

**See what actually happens to an API request, understand it, and replay it.**

The project is currently being developed around **DevReplay's own backend**. The long-term goal is to make DevReplay backend-agnostic, allowing developers to connect and work with **other backends and APIs** as well.

---

## 🚧 Current Status

DevReplay is actively under development.

### Current phase

DevReplay currently works with its **own backend**.

The current backend acts as the first environment for building and validating the core request-capture, inspection, storage, and replay architecture.

```text
Frontend
   ↓
DevReplay Backend
   ↓
Request Processing
   ↓
Storage / Replay
```

This is intentional.

Instead of immediately trying to support every possible backend, the project is first establishing a solid internal architecture using its own backend as the controlled environment.

### Future direction

The architecture is being designed to eventually support:

```text
                 ┌──────────────────┐
                 │    DevReplay     │
                 └────────┬─────────┘
                          │
             ┌────────────┼────────────┐
             ↓            ↓            ↓
       DevReplay API   Backend A    Backend B
                                     
                         ↓
                    Other APIs
```

The goal is for DevReplay to become a tool that can sit alongside an existing backend rather than requiring developers to use DevReplay's backend.

---

# Why DevReplay?

When debugging an API, developers often end up jumping between:

* frontend requests
* browser DevTools
* API clients
* backend logs
* database records
* terminal output
* authentication configuration

It can become difficult to answer simple questions:

> What exactly was sent?

> What did the backend receive?

> What did it return?

> How long did it take?

> Can I reproduce the exact request?

> What changed between two requests?

DevReplay is being built around these problems.

---

# Core Idea

A request should not just disappear after the response is returned.

DevReplay aims to turn the request into something developers can **inspect, understand, persist, and replay**.

Conceptually:

```text
Request
   │
   ├── Method
   ├── URL
   ├── Headers
   ├── Query Parameters
   ├── Body
   │
   ↓
Processing
   │
   ├── Status
   ├── Response
   ├── Timing
   └── Errors
   │
   ↓
Stored Request
   │
   └── Replay
```

---

# What DevReplay Is Being Built To Do

### Request Inspection

Inspect the important parts of an API request:

* HTTP method
* URL
* headers
* query parameters
* request body
* response status
* response body
* response timing
* errors

### Request History

Keep requests available so developers can understand what happened previously instead of reproducing everything manually.

### Request Replay

Take a previous request and send it again.

This makes it possible to reproduce API behavior without manually reconstructing the request every time.

### Debugging

Use captured request/response information to understand where things went wrong.

### Backend Visibility

The long-term vision is to make DevReplay useful across backend architectures rather than tying it permanently to one implementation.

---

# Architecture Direction

The project is intentionally evolving in stages.

## Phase 1 — DevReplay's Own Backend

Current stage.

The frontend communicates with DevReplay's backend, allowing us to build the core system in a controlled environment.

```text
┌─────────────┐
│  DevReplay  │
│   Frontend  │
└──────┬──────┘
       │
       │ HTTP
       ↓
┌─────────────┐
│  DevReplay  │
│   Backend   │
└──────┬──────┘
       │
       ↓
 Request Data
       │
       ↓
   Persistence
```

This stage is primarily about getting the fundamentals right.

---

## Phase 2 — Backend Integration

The next major step is separating DevReplay's core functionality from its own backend.

The objective is to allow DevReplay to work with another backend:

```text
┌──────────────┐
│   DevReplay  │
└───────┬──────┘
        │
        │ Integration
        ↓
┌──────────────────┐
│ Existing Backend │
└──────────────────┘
```

This introduces problems that are much more interesting than simply sending HTTP requests.

For example:

* How should DevReplay integrate with an existing API?
* Where should requests be intercepted?
* How should authentication be handled?
* How should request metadata be normalized?
* How do we preserve the original request?
* How should different backend architectures be supported?
* How do we avoid tightly coupling DevReplay to one framework?
* What should the integration boundary look like?

These are part of the architecture being explored.

---

# Engineering Focus

DevReplay is also a learning project focused on understanding backend engineering through implementation.

Some of the concepts being explored include:

* REST APIs
* HTTP
* request/response lifecycle
* middleware
* controllers
* services
* database persistence
* API contracts
* authentication
* request interception
* error handling
* asynchronous operations
* backend architecture
* frontend/backend communication
* system boundaries
* abstractions
* extensibility

The objective isn't only to make the application work.

It's to understand **why the architecture works**.

---

# Tech Stack

The stack is evolving as the project develops.

Current technologies include:

* **Next.js / React** — frontend
* **TypeScript** — application language
* **Node.js** — backend/runtime
* **HTTP APIs** — communication layer
* **Tailwind CSS** — UI styling

More components may be introduced as the architecture evolves.

---

# Project Structure

The repository is organized around separating the frontend and backend responsibilities.

```text
DevReplay/
│
├── frontend/
│   ├── app/
│   ├── components/
│   └── ...
│
├── backend/
│   ├── ...
│   └── ...
│
└── README.md
```

The structure will continue to evolve as DevReplay moves toward supporting external backends.

---

# Development Philosophy

DevReplay is being developed incrementally.

Rather than building a large abstraction layer upfront, the project follows a simpler approach:

```text
Build
  ↓
Understand
  ↓
Identify the boundary
  ↓
Refactor
  ↓
Generalize
  ↓
Support more backends
```

The current implementation is therefore **not the final architecture**.

Some parts of the codebase will change as the requirements become clearer.

That's part of the project.

---

# Roadmap

## ✅ Current

* [x] DevReplay frontend
* [x] DevReplay backend
* [x] Frontend ↔ backend communication
* [x] API request handling
* [x] Request data representation
* [x] Initial request/replay architecture

## 🔨 In Progress

* [ ] Improve request persistence
* [ ] Improve replay behavior
* [ ] Better request/response inspection
* [ ] Error handling
* [ ] Cleaner backend architecture
* [ ] Better separation of responsibilities

## 🔮 Planned

* [ ] External backend integration
* [ ] Backend-agnostic request interception
* [ ] Integration layer / adapters
* [ ] Support for multiple backend architectures
* [ ] Authentication handling
* [ ] Better debugging workflows
* [ ] More powerful request comparison
* [ ] Production-ready architecture

---

# The Bigger Goal

The end goal is not simply:

> "A tool that sends API requests."

There are already plenty of tools that do that.

The goal is to build something that helps developers **understand the lifecycle of an API request**.

From:

```text
Client
  ↓
Request
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Database
  ↓
Response
  ↓
Client
```

DevReplay should eventually provide visibility into that journey while making the request reproducible.

---

# Current Limitation

At this stage, DevReplay should be considered a **development/experimental project**.

It currently operates around its own backend and **does not yet provide a generic drop-in solution for arbitrary existing backends**.

External backend support is part of the planned architecture and development roadmap.

---

# Contributing

DevReplay is currently evolving rapidly.

If you want to explore the project, understand the architecture, or experiment with the implementation, feel free to fork the repository and build on it.

Issues, discussions, and ideas around backend integration and architecture are especially welcome.

---

# License

License information will be added as the project moves toward its public release.

---

## Built While Learning

DevReplay is being built as much to **understand backend engineering** as to create a useful developer tool.

Every architectural decision is an opportunity to understand the underlying system better.

**Build the tool. Understand the system. Then generalize it.**
