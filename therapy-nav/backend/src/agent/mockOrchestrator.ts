import { getSession, updateSession, emitEvent } from "../sessionStore.js";
import { MOCK_PROFILES } from "./mockData.js";
import { RankedProfile } from "../types/index.js";

// Scripted intake conversation state machine
const INTAKE_SCRIPT = [
  // Turn 0 — first user message, ask about specialty
  {
    trigger: () => true,
    reply: `Thanks for reaching out — it takes courage to take this step, and I'm glad you're here.

To find the right therapist for you, I have a few quick questions.

First: what kind of support are you looking for? For example, anxiety, depression, relationship issues, trauma, grief, or something else entirely — whatever feels most relevant to you.`,
  },
  // Turn 1 — got specialty, ask insurance
  {
    trigger: () => true,
    reply: `Got it, thank you for sharing that.

Next: do you have insurance you'd like to use, or would you prefer to pay out of pocket? If you have insurance, just let me know the provider name (e.g. "Aetna", "Blue Cross") — no ID numbers needed.`,
  },
  // Turn 2 — got insurance, ask location
  {
    trigger: () => true,
    reply: `Perfect. And where are you located? You can share your city and state, a zip code, or let me know if you'd prefer telehealth only.`,
  },
  // Turn 3 — got location, ask availability
  {
    trigger: () => true,
    reply: `Almost there. What does your availability look like? For example: "weekday evenings", "Saturday mornings", or "anytime" — whatever works for you.`,
  },
  // Turn 4 — got availability, confirm and proceed
  {
    trigger: () => true,
    reply: `Great — here's what I've got so far:

- **Support needed:** Anxiety and stress management
- **Insurance:** Aetna
- **Location:** San Francisco, CA (telehealth welcome too)
- **Availability:** Weekday evenings

Does that look right? Just say "yes" to start searching, or let me know anything you'd like to change.`,
  },
  // Turn 5 — confirmed, kick off search
  {
    trigger: () => true,
    reply: `Perfect — starting the search now. I'll check Psychology Today, Zocdoc, and a few other directories. This usually takes about 20–30 seconds.`,
    action: "search",
  },
];

async function simulateSearch(sessionId: string): Promise<void> {
  const sources = [
    { source: "psychology_today", found: 12, delay: 800 },
    { source: "zocdoc", found: 8, delay: 1600 },
    { source: "therapy_den", found: 4, delay: 2200 },
  ];

  for (const { source, found, delay } of sources) {
    await sleep(delay);
    emitEvent(sessionId, { type: "search_progress", source, found });
  }

  await sleep(400);

  const total = MOCK_PROFILES.length;
  for (let done = 1; done <= total; done++) {
    await sleep(300);
    emitEvent(sessionId, { type: "extraction_progress", total, done });
  }

  await sleep(500);
  emitEvent(sessionId, { type: "status", message: "Ranking therapists by your preferences…" });
  await sleep(600);

  updateSession(sessionId, { profiles: MOCK_PROFILES, phase: "results" });
  emitEvent(sessionId, { type: "results_ready", count: MOCK_PROFILES.length });
}

async function simulateBooking(sessionId: string, therapist: RankedProfile): Promise<void> {
  const steps = [
    { msg: `Navigating to ${therapist.name}'s booking page…`, delay: 800 },
    { msg: "Page loaded. Looking for the appointment form…", delay: 1000 },
    { msg: "Found it. Filling in your name…", delay: 900 },
    { msg: "Selecting preferred appointment time…", delay: 1100 },
    { msg: "Filling in reason for visit…", delay: 900 },
  ];

  for (const { msg, delay } of steps) {
    await sleep(delay);
    emitEvent(sessionId, { type: "booking_action", description: msg });
  }

  await sleep(800);

  if (!therapist.bookingUrl) {
    // Fallback path
    updateSession(sessionId, {
      bookingSession: {
        sessionId: "mock-booking-session",
        therapistId: therapist.id,
        status: "fallback",
        filledFields: [],
        currentUrl: "",
      },
      outreachMessage: buildOutreachMessage(therapist),
    });
    emitEvent(sessionId, { type: "fallback_ready" });
  } else {
    // Trust boundary hit
    emitEvent(sessionId, {
      type: "trust_boundary",
      event: {
        sessionId: "mock-booking-session",
        fieldLabel: "Date of Birth",
        fieldType: "date",
        pageUrl: therapist.bookingUrl,
        preFilledBookingUrl: therapist.bookingUrl,
      },
    });
    updateSession(sessionId, {
      bookingSession: {
        sessionId: "mock-booking-session",
        therapistId: therapist.id,
        status: "paused_trust_boundary",
        filledFields: [
          { field: "First Name", value: "Your Name" },
          { field: "Preferred Time", value: "Weekday evening" },
          { field: "Reason for Visit", value: "Anxiety and stress management" },
        ],
        currentUrl: therapist.bookingUrl,
      },
    });
  }
}

function buildOutreachMessage(therapist: RankedProfile): string {
  return `Subject: New Patient Inquiry

Dear ${therapist.name}${therapist.credentials ? `, ${therapist.credentials}` : ""},

I hope this message finds you well. I'm reaching out because I'm looking for support with anxiety and stress management.

I'm located in San Francisco, CA and would be interested in scheduling an appointment — telehealth works well for me. My availability is generally weekday evenings.

I have Aetna insurance.

Could you let me know if you are currently accepting new patients and if you have any availability that might work?

Thank you so much for your time. I look forward to hearing from you.

Warm regards,
[Your Name]`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runMockOrchestratorTurn(
  sessionId: string,
  userMessage: string
): Promise<string> {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found");

  const turnIndex = session.conversationHistory.filter((m) => m.role === "user").length;

  session.conversationHistory.push({ role: "user", content: userMessage });

  // Handle therapist selection mid-conversation
  if (session.phase === "results" || userMessage.toLowerCase().includes("book with")) {
    const therapistIdMatch = userMessage.match(/mock-00[1-5]/);
    const therapist = therapistIdMatch
      ? MOCK_PROFILES.find((p) => p.id === therapistIdMatch[0])
      : MOCK_PROFILES[0];

    const reply = `Great choice! ${therapist!.name} has strong reviews and availability that lines up with what you mentioned. Let me start the booking process now — I'll narrate every step.`;
    session.conversationHistory.push({ role: "assistant", content: reply });
    updateSession(sessionId, { phase: "booking" });

    // Kick off booking simulation in background
    simulateBooking(sessionId, therapist!);

    return reply;
  }

  const scriptEntry = INTAKE_SCRIPT[Math.min(turnIndex, INTAKE_SCRIPT.length - 1)];
  const reply = scriptEntry.reply;

  session.conversationHistory.push({ role: "assistant", content: reply });

  if (scriptEntry.action === "search") {
    updateSession(sessionId, { phase: "searching" });
    // Run search simulation in background (non-blocking)
    simulateSearch(sessionId);
  }

  return reply;
}
