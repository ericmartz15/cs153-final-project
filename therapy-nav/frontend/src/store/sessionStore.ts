import { create } from "zustand";
import {
  SessionPhase,
  RankedProfile,
  BookingSession,
  TrustBoundaryEvent,
  ChatMessage,
  AgentEvent,
} from "../types";

interface StatusEntry {
  id: string;
  message: string;
  type: "status" | "search_progress" | "extraction_progress" | "booking_action" | "error";
  timestamp: number;
  extra?: Record<string, unknown>;
}

interface SessionState {
  sessionId: string | null;
  phase: SessionPhase;
  messages: ChatMessage[];
  statusFeed: StatusEntry[];
  profiles: RankedProfile[];
  bookingSession: BookingSession | null;
  trustBoundaryEvent: TrustBoundaryEvent | null;
  outreachMessage: string | null;
  isLoading: boolean;
  socket: WebSocket | null;

  // Actions
  initSession: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  selectTherapist: (therapistId: string) => Promise<void>;
  acknowledgeHandoff: () => Promise<void>;
  connectSocket: () => void;
  disconnectSocket: () => void;
  handleAgentEvent: (event: AgentEvent) => void;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  addStatus: (entry: Omit<StatusEntry, "id" | "timestamp">) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  phase: "intake",
  messages: [],
  statusFeed: [],
  profiles: [],
  bookingSession: null,
  trustBoundaryEvent: null,
  outreachMessage: null,
  isLoading: false,
  socket: null,

  addMessage: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    })),

  addStatus: (entry) =>
    set((s) => ({
      statusFeed: [
        ...s.statusFeed,
        { ...entry, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    })),

  handleAgentEvent: (event) => {
    const { addStatus } = get();
    switch (event.type) {
      case "status":
        addStatus({ type: "status", message: event.message });
        break;
      case "search_progress":
        addStatus({
          type: "search_progress",
          message: `Searched ${event.source.replace(/_/g, " ")} — found ${event.found} results`,
          extra: { source: event.source, found: event.found },
        });
        break;
      case "extraction_progress":
        addStatus({
          type: "status",
          message: `Extracting profiles… ${event.done}/${event.total}`,
        });
        break;
      case "results_ready":
        set({ phase: "results" });
        addStatus({ type: "status", message: `Found ${event.count} therapists for you!` });
        break;
      case "booking_action":
        addStatus({ type: "booking_action", message: event.description });
        break;
      case "trust_boundary":
        set({ trustBoundaryEvent: event.event, phase: "booking" });
        break;
      case "booking_complete":
        set({ phase: "complete" });
        break;
      case "fallback_ready":
        fetch(`/api/session/${get().sessionId}/fallback`)
          .then((r) => r.json())
          .then((d: { message: string }) => set({ outreachMessage: d.message }));
        break;
      case "error":
        addStatus({ type: "error", message: event.message });
        break;
    }
  },

  connectSocket: () => {
    const { sessionId, handleAgentEvent } = get();
    if (!sessionId) return;

    const wsUrl = `ws://localhost:3001?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data) as AgentEvent;
        handleAgentEvent(event);
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      get().addStatus({ type: "error", message: "Lost connection to server. Reconnecting..." });
    };

    set({ socket: ws });
  },

  disconnectSocket: () => {
    get().socket?.close();
    set({ socket: null });
  },

  initSession: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/session", { method: "POST" });
      const data = (await res.json()) as { sessionId: string };
      set({ sessionId: data.sessionId, phase: "intake", isLoading: false });
      get().connectSocket();
      // Send initial greeting trigger
      get().addMessage({ role: "assistant", content: "Hi there. I'm TherapyNav. I'm here to help you find a therapist who's a great fit for you — and to handle the booking process on your behalf.\n\nTo get started, could you share a little about what's been on your mind lately, or what kind of support you're looking for?" });
    } catch (err) {
      set({ isLoading: false });
      console.error("Failed to init session:", err);
    }
  },

  sendMessage: async (text) => {
    const { sessionId, addMessage } = get();
    if (!sessionId) return;

    addMessage({ role: "user", content: text });
    set({ isLoading: true });

    try {
      const res = await fetch(`/api/session/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json()) as { reply: string; phase: SessionPhase };
      addMessage({ role: "assistant", content: data.reply });
      set({ phase: data.phase, isLoading: false });
    } catch (err) {
      addMessage({ role: "assistant", content: "I'm having trouble connecting right now. Please try again in a moment." });
      set({ isLoading: false });
      console.error(err);
    }
  },

  selectTherapist: async (therapistId) => {
    const { sessionId, addMessage } = get();
    if (!sessionId) return;

    set({ isLoading: true, phase: "booking" });

    try {
      const res = await fetch(`/api/session/${sessionId}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ therapistId }),
      });
      const data = (await res.json()) as { reply: string; phase: SessionPhase };
      addMessage({ role: "assistant", content: data.reply });
      set({ phase: data.phase, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      console.error(err);
    }
  },

  acknowledgeHandoff: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    await fetch(`/api/session/${sessionId}/handoff`, { method: "POST" });
  },
}));
