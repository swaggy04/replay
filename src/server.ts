import app from "./app.js";

const PORT = Number(process.env.PORT) || 5000;
console.log("PROJECT ID:", process.env.DEVREPLAY_PROJECT_ID);
app.listen(PORT, () => {
  console.log(` DevReplay running at http://localhost:${PORT}`);
});