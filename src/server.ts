import app from "./app.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(` DevReplay running at http://localhost:${PORT}`);
});