import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { createSession, getSession } from "../sessionStore.js";
import { runOrchestratorTurn } from "../agent/orchestrator.js";
import { runMockOrchestratorTurn } from "../agent/mockOrchestrator.js";

const MOCK_MODE = process.env.MOCK_MODE === "true";
const runTurn = MOCK_MODE ? runMockOrchestratorTurn : runOrchestratorTurn;

const router = Router();

// POST /api/session — create new session
router.post("/", (_req: Request, res: Response) => {
  const id = uuidv4();
  createSession(id);
  res.json({ sessionId: id });
});

// POST /api/session/:id/message — send message to intake chat
router.post("/:id/message", async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { message } = req.body as { message: string };
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const reply = await runTurn(req.params.id, message);
    res.json({ reply, phase: session.phase });
  } catch (err) {
    console.error("Orchestrator error:", err);
    res.status(500).json({ error: "Agent error", details: String(err) });
  }
});

// GET /api/session/:id/results — get ranked therapist shortlist
router.get("/:id/results", (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ profiles: session.profiles ?? [], phase: session.phase });
});

// POST /api/session/:id/select — user selects therapist, starts booking
router.post("/:id/select", async (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const { therapistId } = req.body as { therapistId: string };
  const therapist = session.profiles?.find((p) => p.id === therapistId);
  if (!therapist) {
    res.status(404).json({ error: "Therapist not found" });
    return;
  }

  try {
    const reply = await runTurn(
      req.params.id,
      `I'd like to book with ${therapist.name}. Their ID is ${therapistId}.`
    );
    res.json({ reply, phase: session.phase });
  } catch (err) {
    res.status(500).json({ error: "Booking error", details: String(err) });
  }
});

// GET /api/session/:id/booking — get current booking session state
router.get("/:id/booking", (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ bookingSession: session.bookingSession ?? null, phase: session.phase });
});

// POST /api/session/:id/handoff — acknowledge trust boundary hand-off
router.post("/:id/handoff", (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ acknowledged: true, bookingUrl: session.bookingSession?.currentUrl });
});

// GET /api/session/:id/fallback — get pre-filled outreach message
router.get("/:id/fallback", (req: Request, res: Response) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ message: session.outreachMessage ?? "" });
});

export default router;
