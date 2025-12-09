import express from "express";
import dotenv from "dotenv";
import missionsRouter from "./routes/missions.js";
import aiRouter from "./routes/ai.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/missions", missionsRouter);
app.use("/ai", aiRouter);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Basic error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
