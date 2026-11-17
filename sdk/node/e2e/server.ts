
import express from "express";
import { DevReplay } from "../src/index.js";

const app = express();

app.use(express.json());

const devreplay = new DevReplay({
  apiKey: process.env.DEVREPLAY_API_KEY!,
  endpoint: "http://localhost:5000",
  flushIntervalMs: 1000,
});

app.use(devreplay.middleware());

app.get("/success", (_req, res) => {
  res.status(200).json({ ok: true, message: "DevReplay works" });
});

app.post("/users", (req, res) => {
  res.status(201).json({
    created: true,
    user: req.body,
  });
});

app.get("/failure", (_req, res) => {
  res.status(500).json({ error: "Intentional test failure" });
});

app.post("/redact", (req, res) => {
  res.json({ received: true });
});

const server = app.listen(5056, () => {
  console.log("E2E test server running at http://localhost:5056");
});

async function shutdown() {
  await devreplay.shutdown(3000);
  server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
