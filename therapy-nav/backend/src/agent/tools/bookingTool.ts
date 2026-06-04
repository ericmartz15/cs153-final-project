import { chromium, Browser, BrowserContext, Page } from "playwright";
import OpenAI from "openai";
import { BookingSession, RankedProfile, TrustBoundaryEvent, IntakePreferences } from "../../types/index.js";
import { isTrustBoundaryField } from "../../trustBoundary.js";
import { emitEvent } from "../../sessionStore.js";
import { v4 as uuidv4 } from "uuid";

const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const MAX_STEPS = 25;
const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://therapynav.app",
        "X-OpenRouter-Title": "TherapyNav",
      },
    });
  }
  return _client;
}

interface ActiveBooking {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  session: BookingSession;
}

const activeBookings = new Map<string, ActiveBooking>();

// ─── Page snapshot ────────────────────────────────────────────────────────────

async function snapshotPage(page: Page): Promise<string> {
  const title = await page.title().catch(() => "");
  const url = page.url();

  const elements = await page.evaluate((): Array<{
    tag: string;
    inputType?: string;
    label: string;
    placeholder?: string;
    value?: string;
    options?: string[];
    disabled: boolean;
  }> => {
    const results: Array<{
      tag: string;
      inputType?: string;
      label: string;
      placeholder?: string;
      value?: string;
      options?: string[];
      disabled: boolean;
    }> = [];

    const nodes = document.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button, a[href]'
    );

    nodes.forEach((el) => {
      // Skip invisible elements
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (
        (rect.width === 0 && rect.height === 0) ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      ) return;

      const tag = el.tagName.toLowerCase();
      const input = el as HTMLInputElement;

      // Resolve label text
      let label = "";
      if (input.id) {
        const lbl = document.querySelector<HTMLElement>(`label[for="${input.id}"]`);
        if (lbl) label = lbl.innerText.trim();
      }
      if (!label) label = input.getAttribute("aria-label") ?? "";
      if (!label) label = input.getAttribute("aria-labelledby")
        ? document.getElementById(input.getAttribute("aria-labelledby")!)?.innerText?.trim() ?? ""
        : "";
      if (!label) {
        const parentLabel = el.closest("label");
        if (parentLabel) label = parentLabel.innerText.trim();
      }
      if (!label && (tag === "button" || tag === "a")) {
        label = el.innerText?.trim() ?? el.getAttribute("value") ?? "";
      }
      if (!label) label = input.placeholder ?? input.name ?? input.id ?? "";

      const options = tag === "select"
        ? Array.from((el as HTMLSelectElement).options).map((o) => o.text.trim()).slice(0, 10)
        : undefined;

      if (label.slice(0, 60) || tag === "button" || tag === "a") {
        results.push({
          tag,
          inputType: tag === "input" ? input.type : undefined,
          label: label.slice(0, 60),
          placeholder: input.placeholder?.slice(0, 40) || undefined,
          value: input.value?.slice(0, 60) || undefined,
          options,
          disabled: input.disabled ?? false,
        });
      }
    });

    return results.slice(0, 40);
  }).catch(() => []);

  const lines = [
    `PAGE: "${title}"`,
    `URL: ${url}`,
    "",
    "INTERACTIVE ELEMENTS:",
  ];

  elements.forEach((el, i) => {
    const parts = [`[${i + 1}] ${el.tag.toUpperCase()}`];
    if (el.inputType && el.inputType !== "text") parts.push(`type="${el.inputType}"`);
    if (el.label) parts.push(`label="${el.label}"`);
    if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
    if (el.value) parts.push(`value="${el.value}"`);
    if (el.options) parts.push(`options=[${el.options.join(" | ")}]`);
    if (el.disabled) parts.push("(disabled)");
    lines.push(parts.join(" "));
  });

  return lines.join("\n");
}

// ─── Action execution ────────────────────────────────────────────────────────

interface AgentAction {
  action: "click" | "fill" | "select" | "trust_boundary" | "done" | "wait";
  /** Human-readable label / button text of the target element */
  target?: string;
  /** Value to type (for fill) or option to pick (for select) */
  value?: string;
  /** Explanation narrated to the user */
  narration: string;
  /** For trust_boundary: the sensitive field label */
  fieldLabel?: string;
}

async function executeAction(
  page: Page,
  action: AgentAction
): Promise<{ success: boolean; error?: string }> {
  const t = action.target ?? "";

  try {
    switch (action.action) {
      case "fill": {
        const locators = [
          page.getByLabel(t, { exact: false }),
          page.getByPlaceholder(t, { exact: false }),
          page.locator(`[name*="${t}" i]`),
          page.locator(`[id*="${t}" i]`),
        ];
        for (const loc of locators) {
          try {
            const el = loc.first();
            if (await el.isVisible({ timeout: 1500 })) {
              await el.fill(action.value ?? "");
              return { success: true };
            }
          } catch { /* try next */ }
        }
        return { success: false, error: `Could not find input: "${t}"` };
      }

      case "select": {
        const locators = [
          page.getByLabel(t, { exact: false }),
          page.locator(`select[name*="${t}" i]`),
        ];
        for (const loc of locators) {
          try {
            const el = loc.first();
            if (await el.isVisible({ timeout: 1500 })) {
              await el.selectOption(action.value ?? "");
              return { success: true };
            }
          } catch { /* try next */ }
        }
        return { success: false, error: `Could not select in: "${t}"` };
      }

      case "click": {
        const locators = [
          page.getByRole("button", { name: t, exact: false }),
          page.getByRole("link", { name: t, exact: false }),
          page.getByText(t, { exact: false }),
        ];
        for (const loc of locators) {
          try {
            const el = loc.first();
            if (await el.isVisible({ timeout: 1500 })) {
              await el.click();
              await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
              return { success: true };
            }
          } catch { /* try next */ }
        }
        return { success: false, error: `Could not click: "${t}"` };
      }

      case "wait":
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        return { success: true };

      default:
        return { success: true };
    }
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── Trust boundary pre-check ─────────────────────────────────────────────────

async function checkPageForTrustBoundary(
  page: Page,
  bookingSessionId: string
): Promise<TrustBoundaryEvent | null> {
  const labels = await page.evaluate((): string[] => {
    const results: string[] = [];
    document.querySelectorAll<HTMLInputElement>("input, select").forEach((el) => {
      let label = "";
      if (el.id) {
        const lbl = document.querySelector<HTMLElement>(`label[for="${el.id}"]`);
        if (lbl) label = lbl.innerText.trim();
      }
      if (!label) label = el.getAttribute("aria-label") ?? el.placeholder ?? el.name ?? "";
      if (label) results.push(label);
    });
    return results;
  }).catch(() => []);

  for (const label of labels) {
    if (isTrustBoundaryField(label)) {
      return {
        sessionId: bookingSessionId,
        fieldLabel: label,
        fieldType: "input",
        pageUrl: page.url(),
        preFilledBookingUrl: page.url(),
      };
    }
  }
  return null;
}

// ─── Main agentic loop ────────────────────────────────────────────────────────

function buildSystemPrompt(therapist: RankedProfile, prefs: IntakePreferences): string {
  const locationStr =
    prefs.location === "telehealth"
      ? "telehealth"
      : typeof prefs.location === "object"
      ? [prefs.location.city, prefs.location.state].filter(Boolean).join(", ") || prefs.location.zip || ""
      : "";

  const availStr = [
    prefs.availability.days.join(", "),
    prefs.availability.timeOfDay.join(", "),
  ].filter(Boolean).join(" ");

  const reason = prefs.specialty.length > 0
    ? `Support with ${prefs.specialty.join(" and ")}`
    : "General therapy support";

  return `You are an AI booking agent helping a user schedule a therapy appointment with ${therapist.name}${therapist.credentials ? ` (${therapist.credentials})` : ""}.

USER INFO (non-sensitive, safe to fill):
- Preferred availability: ${availStr || "flexible"}
- Location preference: ${locationStr || "flexible"}
- Reason for visit (non-clinical): ${reason}
- Insurance: ${prefs.insurance}

YOUR JOB:
1. Look at the current page snapshot showing all interactive elements.
2. Decide the single best next action to advance the booking.
3. Return a JSON object describing that action.

TRUST BOUNDARY RULES (non-negotiable):
- If you see ANY field for: password, date of birth, DOB, insurance ID, member ID, SSN, social security, credit card, billing, or login — respond with action "trust_boundary" immediately. Do NOT fill these.
- Only fill: name fields (use generic "Your Name" if no name provided), reason for visit, preferred time/date for appointment (not DOB), contact preferences.

RESPONSE FORMAT — return ONLY valid JSON, nothing else:
{
  "action": "fill" | "click" | "select" | "trust_boundary" | "done" | "wait",
  "target": "exact label or button text from the element list",
  "value": "the value to enter (for fill/select only)",
  "narration": "one short sentence describing what you are doing, shown to the user",
  "fieldLabel": "the sensitive field label (trust_boundary only)"
}

Examples:
{"action":"fill","target":"First Name","value":"Your Name","narration":"Filling in your name..."}
{"action":"click","target":"Next","narration":"Clicking Next to continue to the next step..."}
{"action":"select","target":"Appointment Type","value":"Initial Consultation","narration":"Selecting Initial Consultation as the appointment type..."}
{"action":"trust_boundary","target":"Date of Birth","fieldLabel":"Date of Birth","narration":"Stopping — Date of Birth requires your input directly."}
{"action":"done","narration":"The booking form has been submitted successfully!"}`;
}

async function runBookingAgentLoop(
  bookingSessionId: string,
  agentSessionId: string,
  therapist: RankedProfile,
  prefs: IntakePreferences
): Promise<void> {
  const active = activeBookings.get(bookingSessionId);
  if (!active) return;

  const { page, session } = active;
  const conversationHistory: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  const systemPrompt = buildSystemPrompt(therapist, prefs);

  for (let step = 0; step < MAX_STEPS; step++) {
    // Check for trust boundary before each step
    const tbEvent = await checkPageForTrustBoundary(page, bookingSessionId);
    if (tbEvent) {
      session.status = "paused_trust_boundary";
      emitEvent(agentSessionId, {
        type: "booking_action",
        description: `I've stopped — "${tbEvent.fieldLabel}" requires your input directly.`,
      });
      emitEvent(agentSessionId, { type: "trust_boundary", event: tbEvent });
      await active.browser.close();
      activeBookings.delete(bookingSessionId);
      return;
    }

    // Snapshot the current page
    const snapshot = await snapshotPage(page);

    // Ask the LLM what to do next
    conversationHistory.push({ role: "user", content: snapshot });

    let agentActionRaw: string;
    try {
      const response = await getClient().chat.completions.create({
        model: MODEL,
        max_tokens: 256,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
        ],
      });
      agentActionRaw = response.choices[0].message.content ?? "{}";
      conversationHistory.push({ role: "assistant", content: agentActionRaw });
    } catch (err) {
      emitEvent(agentSessionId, {
        type: "error",
        message: `Booking agent error: ${String(err)}`,
      });
      break;
    }

    let agentAction: AgentAction;
    try {
      agentAction = JSON.parse(agentActionRaw) as AgentAction;
    } catch {
      // If JSON parse fails, stop
      break;
    }

    // Narrate to the user
    if (agentAction.narration) {
      emitEvent(agentSessionId, {
        type: "booking_action",
        description: agentAction.narration,
      });
    }

    // Handle terminal actions
    if (agentAction.action === "trust_boundary") {
      const tbEvent: TrustBoundaryEvent = {
        sessionId: bookingSessionId,
        fieldLabel: agentAction.fieldLabel ?? agentAction.target ?? "sensitive field",
        fieldType: "input",
        pageUrl: page.url(),
        preFilledBookingUrl: page.url(),
      };
      session.status = "paused_trust_boundary";
      emitEvent(agentSessionId, { type: "trust_boundary", event: tbEvent });
      await active.browser.close();
      activeBookings.delete(bookingSessionId);
      return;
    }

    if (agentAction.action === "done") {
      session.status = "complete";
      emitEvent(agentSessionId, { type: "booking_complete" });
      await active.browser.close();
      activeBookings.delete(bookingSessionId);
      return;
    }

    // Execute the action
    const result = await executeAction(page, agentAction);
    if (!result.success) {
      // Tell the LLM what went wrong so it can try something else
      conversationHistory.push({
        role: "user",
        content: `ACTION FAILED: ${result.error}. Please try a different approach.`,
      });
    } else if (agentAction.action === "fill" && agentAction.target && agentAction.value) {
      session.filledFields.push({ field: agentAction.target, value: agentAction.value });
    }

    // Small pause between actions so the page can settle
    await new Promise((r) => setTimeout(r, 600));
  }

  // Hit max steps without completing
  emitEvent(agentSessionId, {
    type: "booking_action",
    description: "I've done as much as I can automatically. Please complete the booking at the link below.",
  });

  const tbEvent: TrustBoundaryEvent = {
    sessionId: bookingSessionId,
    fieldLabel: "manual completion required",
    fieldType: "input",
    pageUrl: page.url(),
    preFilledBookingUrl: page.url(),
  };
  session.status = "paused_trust_boundary";
  emitEvent(agentSessionId, { type: "trust_boundary", event: tbEvent });

  await active.browser.close().catch(() => {});
  activeBookings.delete(bookingSessionId);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function startBooking(
  therapist: RankedProfile,
  agentSessionId: string,
  prefs?: IntakePreferences
): Promise<BookingSession> {
  const bookingSessionId = uuidv4();

  if (!therapist.bookingUrl) {
    emitEvent(agentSessionId, {
      type: "booking_action",
      description: "No online booking page found. Preparing an outreach message instead...",
    });
    return {
      sessionId: bookingSessionId,
      therapistId: therapist.id,
      status: "fallback",
      filledFields: [],
      currentUrl: "",
    };
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  emitEvent(agentSessionId, {
    type: "booking_action",
    description: `Opening ${therapist.name}'s booking page...`,
  });

  try {
    await page.goto(therapist.bookingUrl, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    await browser.close();
    emitEvent(agentSessionId, {
      type: "booking_action",
      description: "Booking page didn't load. Preparing an outreach message instead...",
    });
    return {
      sessionId: bookingSessionId,
      therapistId: therapist.id,
      status: "fallback",
      filledFields: [],
      currentUrl: therapist.bookingUrl,
    };
  }

  const session: BookingSession = {
    sessionId: bookingSessionId,
    therapistId: therapist.id,
    status: "active",
    filledFields: [],
    currentUrl: page.url(),
  };

  activeBookings.set(bookingSessionId, { browser, context, page, session });

  // Kick off the agentic loop in the background (non-blocking)
  if (prefs) {
    runBookingAgentLoop(bookingSessionId, agentSessionId, therapist, prefs).catch((err) => {
      console.error("Booking agent loop error:", err);
      emitEvent(agentSessionId, { type: "error", message: `Booking error: ${String(err)}` });
    });
  }

  return session;
}

// Keep these for any direct use from routes
export async function fillBookingField(
  bookingSessionId: string,
  field: string,
  value: string,
  agentSessionId: string
): Promise<{ success: boolean; error?: string }> {
  const active = activeBookings.get(bookingSessionId);
  if (!active) return { success: false, error: "Session not found" };
  if (isTrustBoundaryField(field)) {
    return { success: false, error: `Trust boundary: "${field}" requires user input` };
  }
  return executeAction(active.page, {
    action: "fill",
    target: field,
    value,
    narration: `Filling in "${field}"...`,
  });
}

export async function detectTrustBoundary(
  bookingSessionId: string
): Promise<TrustBoundaryEvent | null> {
  const active = activeBookings.get(bookingSessionId);
  if (!active) return null;
  return checkPageForTrustBoundary(active.page, bookingSessionId);
}

export async function closeBookingSession(bookingSessionId: string): Promise<void> {
  const active = activeBookings.get(bookingSessionId);
  if (active) {
    await active.browser.close().catch(() => {});
    activeBookings.delete(bookingSessionId);
  }
}
