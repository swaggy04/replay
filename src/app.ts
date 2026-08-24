import express from "express";
import { requestLogger } from "./middleware/requestLogger.js";

const app = express();
app.use(express.json());
app.use(requestLogger);
app.get("/", (req, res) => {
  res.send("DevReplay is alive");
});

export default app;