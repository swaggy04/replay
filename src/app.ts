import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("DevReplay is alive");
});

export default app;