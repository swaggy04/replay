import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";

import { requireUser } from "./middleware/requireUser.js";
import { requireApiKey } from "./middleware/requireApiKey.js";

import { replayController } from "./controllers/replayController.js";
import { batchCaptureController, captureController } from "./controllers/captureController.js";
import {
  compareReplayController,
  replayHistoryController,
  requestController,
  requestIdController,
} from "./controllers/requestController.js";
import {
  createApiKeyController,
  getProjectApiKeysController,
  revokeApiKeyController,
} from "./controllers/apiKeyController.js";

import {
  getProjectsController,
  projectController,
  updateProjectReplayBaseUrlController,
} from "./controllers/projectController.js";

const app = express();

// 1. Handle browser preflight requests before authentication.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-devreplay-api-key",
    ], methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// 2. Parse JSON request bodies.
app.use(express.json({ limit: "256kb" }));
// 3. Initialize Clerk authentication.
app.use(clerkMiddleware());

app.get("/", (_req, res) => {
  res.send("DevReplay is alive");
});

app.get("/error", (_req, _res) => {
  throw new Error("Something went wrong");
});

app.get("/users", (req, res) => {
  res.json({
    message: "Users fetched",
    query: req.query,
  });
});

app.post("/users", (req, res) => {
  res.status(201).json({
    message: "User created",
    user: req.body,
    query: req.query,
  });
});

app.get("/plain", (_req, res) => {
  res.status(200).send("Hello from plain text");
});

// Authenticated project routes.
// Authenticated dashboard routes.
app.post("/projects", requireUser, projectController);
app.get("/projects", requireUser, getProjectsController);
app.put("/projects/:projectId/replay-target", requireUser, updateProjectReplayBaseUrlController);

app.get("/requests", requireUser, requestController);
app.get("/requests/:id", requireUser, requestIdController);

app.get(
  "/requests/:id/replays",
  requireUser,
  replayHistoryController
);

app.get(
  "/requests/:id/compare/:replayId",
  requireUser,
  compareReplayController
);

app.post("/replay/:id", requireUser, replayController);

app.get(
  "/replay/:id/history",
  requireUser,
  replayHistoryController
);

// SDK ingestion is separate and needs API-key authentication.
app.post("/ingest", requireApiKey, captureController);
app.post("/ingest/batch", requireApiKey, batchCaptureController);
app.post(
  "/projects/:projectId/api-keys",
  requireUser,
  createApiKeyController
);

app.get(
  "/projects/:projectId/api-keys",
  requireUser,
  getProjectApiKeysController
);

app.delete(
  "/projects/:projectId/api-keys/:keyId",
  requireUser,
  revokeApiKeyController
);

export default app;
