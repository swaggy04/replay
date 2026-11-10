import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";

import { requireUser } from "./middleware/requireUser.js";

import { replayController } from "./controllers/replayController.js";
import { captureController } from "./controllers/captureController.js";
import {
  compareReplayController,
  replayHistoryController,
  requestController,
  requestIdController,
} from "./controllers/requestController.js";

import { getProjectsController, projectController } from "./controllers/projectController.js";

const app = express();

// Clerk must run before the route handlers.
app.use(clerkMiddleware());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json());

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

// Project routes now require a valid Clerk session.
app.post("/projects", requireUser, projectController);
app.get("/projects", requireUser, getProjectsController);

// Existing routes — not yet migrated to ownership checks.
app.post("/replay/:id", replayController);
app.get("/requests", requestController);
app.get("/requests/:id", requestIdController);
app.get("/requests/:id/replays", replayHistoryController);
app.get("/requests/:id/compare/:replayId", compareReplayController);
app.get("/replay/:id/history", replayHistoryController);
app.post("/ingest", captureController);

export default app;
