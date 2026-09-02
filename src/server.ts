import app from "./app.js";

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(` DevReplay running at http://localhost:${PORT}`);
});