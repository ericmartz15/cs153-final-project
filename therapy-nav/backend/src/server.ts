import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import WebSocket from "ws";
import sessionRoutes from "./routes/session.js";
import { registerSocket, unregisterSocket } from "./sessionStore.js";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT ?? "3001";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

app.use("/api/session", sessionRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// WebSocket: clients connect with ?sessionId=xxx
wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    ws.close(1008, "sessionId required");
    return;
  }

  registerSocket(sessionId, ws);

  ws.on("close", () => {
    unregisterSocket(sessionId);
  });

  ws.on("error", (err) => {
    console.error(`WebSocket error for session ${sessionId}:`, err);
    unregisterSocket(sessionId);
  });

  ws.send(JSON.stringify({ type: "status", message: "Connected" }));
});

server.listen(PORT, () => {
  console.log(`TherapyNav backend listening on port ${PORT}`);
});
