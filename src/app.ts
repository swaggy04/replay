import express from "express";
import { requestLogger } from "./middleware/requestLogger.js";

const app = express();
app.use(express.json());
app.use(requestLogger);
app.get("/", (req, res) => {
  res.send("DevReplay is alive");
});
app.post("/users", (req, res) => {
  console.log("BODY:", req.body);

  res.status(201).json({
    message: "User created",
    user: req.body,
  });
});

export default app;