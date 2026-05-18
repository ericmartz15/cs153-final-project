import { AgentSession } from "./types/index.js";
import WebSocket from "ws";

const sessions = new Map<string, AgentSession>();
const sockets = new Map<string, WebSocket>();

const TTL_MS = parseInt(process.env.SESSION_TTL_MS ?? "7200000", 10);

export function createSession(id: string): AgentSession {
  const session: AgentSession = {
    id,
    phase: "intake",
    createdAt: Date.now(),
    conversationHistory: [],
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): AgentSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  if (Date.now() - session.createdAt > TTL_MS) {
    sessions.delete(id);
    sockets.delete(id);
    return undefined;
  }
  return session;
}

export function updateSession(id: string, updates: Partial<AgentSession>): void {
  const session = sessions.get(id);
  if (session) {
    Object.assign(session, updates);
  }
}

export function registerSocket(id: string, ws: WebSocket): void {
  sockets.set(id, ws);
}

export function unregisterSocket(id: string): void {
  sockets.delete(id);
}

export function emitEvent(sessionId: string, event: object): void {
  const ws = sockets.get(sessionId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

// Clean up expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > TTL_MS) {
      sessions.delete(id);
      sockets.delete(id);
    }
  }
}, 10 * 60 * 1000);
