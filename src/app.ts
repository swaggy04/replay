import express, { Router } from "express";
import { requestLogger } from "./middleware/requestLogger.js";
import { replayController } from "./controllers/replayController.js";
import { compareReplayController, replayHistoryController, requestController, requestIdController } from "./controllers/requestController.js";

const app = express();
app.use(express.json());
app.use(requestLogger);
app.get("/", (req, res) => {
  res.send("DevReplay is alive");
});
// app.post("/users", (req, res) => {
//   console.log("BODY:", req.body);

//   res.status(201).json({
//     message: "User created",
//     user: req.body,
//   });
// });
app.get("/error", (_req, _res) => {
  throw new Error("Something went wrong");
});
app.get("/users", (req, res) => {
  res.json({
    message: "Users fetched",
    query: req.query,
  });
});
app.post("/replay/:id", replayController);
app.post("/users", (req, res) => {
  console.log("BODY:", req.body);
  console.log("QUERY:", req.query);
  console.log("HEADERS:", req.headers);

  res.status(201).json({
    message: "User created",
    user: req.body,
    query: req.query,
  });
});

app.get("/plain", (_req, res) => {
  res.status(200).send("Hello from plain text");
});
app.get("/requests", requestController);
app.get("/requests/:id", requestIdController);
app.get("/requests/:id/replays", replayHistoryController);
app.get("/requests/:id/compare/:replayId", compareReplayController);
export default app;
