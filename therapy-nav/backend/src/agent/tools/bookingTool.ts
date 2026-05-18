import { chromium, Browser, BrowserContext, Page } from "playwright";
import { BookingSession, RankedProfile, TrustBoundaryEvent } from "../../types/index.js";
import { isTrustBoundaryField } from "../../trustBoundary.js";
import { emitEvent } from "../../sessionStore.js";
import { v4 as uuidv4 } from "uuid";

const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";

interface ActiveBooking {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  session: BookingSession;
}

const activeBookings = new Map<string, ActiveBooking>();

export async function startBooking(
  therapist: RankedProfile,
  sessionId: string
): Promise<BookingSession> {
  const bookingSessionId = uuidv4();

  if (!therapist.bookingUrl) {
    const session: BookingSession = {
      sessionId: bookingSessionId,
      therapistId: therapist.id,
      status: "fallback",
      filledFields: [],
      currentUrl: "",
    };
    emitEvent(sessionId, { type: "booking_action", description: "No online booking available. Preparing outreach message..." });
    return session;
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  emitEvent(sessionId, {
    type: "booking_action",
    description: `Navigating to ${therapist.name}'s booking page...`,
  });

  try {
    await page.goto(therapist.bookingUrl, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    await browser.close();
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
  return session;
}

export async function fillBookingField(
  bookingSessionId: string,
  field: string,
  value: string,
  agentSessionId: string
): Promise<{ success: boolean; error?: string }> {
  const active = activeBookings.get(bookingSessionId);
  if (!active) return { success: false, error: "Booking session not found" };

  // Hard trust boundary check
  if (isTrustBoundaryField(field)) {
    const event: TrustBoundaryEvent = {
      sessionId: bookingSessionId,
      fieldLabel: field,
      fieldType: "input",
      pageUrl: active.page.url(),
    };
    active.session.status = "paused_trust_boundary";
    emitEvent(agentSessionId, { type: "trust_boundary", event });
    return { success: false, error: `Trust boundary: field "${field}" requires user input` };
  }

  try {
    emitEvent(agentSessionId, {
      type: "booking_action",
      description: `Filling in "${field}"...`,
    });

    // Try to find the field by label, placeholder, or name
    const selectors = [
      `[placeholder*="${field}" i]`,
      `[name*="${field}" i]`,
      `[aria-label*="${field}" i]`,
      `label:has-text("${field}") + input`,
      `label:has-text("${field}") ~ input`,
    ];

    let filled = false;
    for (const selector of selectors) {
      try {
        const el = active.page.locator(selector).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.fill(value);
          filled = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (filled) {
      active.session.filledFields.push({ field, value });
      return { success: true };
    }
    return { success: false, error: `Could not find field: ${field}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function detectTrustBoundary(
  bookingSessionId: string
): Promise<TrustBoundaryEvent | null> {
  const active = activeBookings.get(bookingSessionId);
  if (!active) return null;

  try {
    const inputs = await active.page.$$eval(
      "input, select, textarea",
      (els) =>
        els.map((el) => {
          const input = el as HTMLInputElement;
          const label = document.querySelector(`label[for="${input.id}"]`);
          return {
            label: label?.textContent?.trim() ?? input.placeholder ?? input.name ?? "",
            type: input.type ?? "text",
          };
        })
    );

    for (const input of inputs) {
      if (isTrustBoundaryField(input.label)) {
        return {
          sessionId: bookingSessionId,
          fieldLabel: input.label,
          fieldType: input.type,
          pageUrl: active.page.url(),
        };
      }
    }
  } catch (err) {
    console.error("Trust boundary detection error:", err);
  }

  return null;
}

export async function closeBookingSession(bookingSessionId: string): Promise<void> {
  const active = activeBookings.get(bookingSessionId);
  if (active) {
    await active.browser.close();
    activeBookings.delete(bookingSessionId);
  }
}
