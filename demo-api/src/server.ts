import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const users = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
  },
];

app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: "development",
  });
});

app.get("/api/users", (_req, res) => {
  res.json({
    success: true,
    data: users,
  });
});

app.get("/api/users/:id", (req, res) => {
  const user = users.find((user) => user.id === req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  return res.json({
    success: true,
    data: user,
  });
});

app.post("/api/users", (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: "name and email are required",
    });
  }

  const user = {
    id: String(users.length + 1),
    name,
    email,
  };

  users.push(user);

  return res.status(201).json({
    success: true,
    data: user,
  });
});

app.listen(3000, () => {
  console.log("Demo API running at http://localhost:3000");
});
