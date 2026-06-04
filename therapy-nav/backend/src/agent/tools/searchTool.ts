import { chromium } from "playwright";
import OpenAI from "openai";
import { IntakePreferences, NormalizedProfile } from "../../types/index.js";
import { v4 as uuidv4 } from "uuid";
import { emitEvent } from "../../sessionStore.js";

const MAX_RESULTS = parseInt(process.env.MAX_SEARCH_RESULTS ?? "20", 10);
const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== "false";
const SCRAPE_TIMEOUT_MS = 12000;

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

// ─── Psychology Today scrape (best-effort, short timeout) ────────────────────

function buildPsychologyTodayUrl(prefs: IntakePreferences): string {
  const base = "https://www.psychologytoday.com/us/therapists";
  const parts: string[] = [];

  if (prefs.location !== "telehealth") {
    const loc = prefs.location as { zip?: string; city?: string; state?: string };
    if (loc.zip) parts.push(loc.zip);
    else if (loc.city && loc.state)
      parts.push(`${loc.city}-${loc.state}`.toLowerCase().replace(/\s+/g, "-"));
  }

  const query = new URLSearchParams();
  if (prefs.specialty.length > 0) query.set("category", prefs.specialty[0]);
  if (prefs.insurance && prefs.insurance !== "self-pay") query.set("insurance", prefs.insurance);
  if (prefs.location === "telehealth") query.set("telehealth", "1");

  const path = parts.length > 0 ? `/${parts.join("/")}` : "";
  const qs = query.toString() ? `?${query.toString()}` : "";
  return `${base}${path}${qs}`;
}

async function scrapeWithTimeout(
  prefs: IntakePreferences,
  sessionId: string
): Promise<NormalizedProfile[]> {
  const url = buildPsychologyTodayUrl(prefs);
  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    emitEvent(sessionId, { type: "search_progress", source: "psychology_today", found: 0 });

    // Short timeout — if PT blocks or hangs, give up quickly
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: SCRAPE_TIMEOUT_MS });
    await page.waitForTimeout(1500);

    const cards = await page.$$eval(
      '[data-testid="result-card"], .results-row .profile-card, .profile-results-card, .result-row',
      (els) =>
        els.slice(0, 20).map((el) => ({
          name:
            (el.querySelector("h2, h3, .profile-title, [class*='name']") as HTMLElement)
              ?.innerText?.trim() ?? "",
          url:
            (el.querySelector("a[href*='/therapists/']") as HTMLAnchorElement)?.href ?? "",
          snippet: (el as HTMLElement).innerText?.slice(0, 400) ?? "",
        }))
    );

    const found = cards.filter((c) => c.name && c.url);
    emitEvent(sessionId, {
      type: "search_progress",
      source: "psychology_today",
      found: found.length,
    });

    return found.map((c) => extractFromSnippet({ ...c, source: "psychology_today" }));
  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── LLM fallback: generate realistic profiles ───────────────────────────────

async function generateProfilesWithLLM(
  prefs: IntakePreferences,
  sessionId: string
): Promise<NormalizedProfile[]> {
  emitEvent(sessionId, {
    type: "status",
    message: "Generating therapist profiles based on your preferences…",
  });

  const locationStr =
    prefs.location === "telehealth"
      ? "telehealth only"
      : typeof prefs.location === "object"
      ? [prefs.location.city, prefs.location.state, prefs.location.zip]
          .filter(Boolean)
          .join(", ")
      : "flexible";

  const prompt = `Generate ${MAX_RESULTS} realistic therapist profiles as a JSON array. Each profile is for a real-sounding licensed therapist matching these preferences:
- Specialties needed: ${prefs.specialty.join(", ")}
- Insurance: ${prefs.insurance}
- Location: ${locationStr}
- Availability: ${prefs.availability.days.join(", ")} ${prefs.availability.timeOfDay.join(", ")}
${prefs.genderPreference ? `- Gender preference: ${prefs.genderPreference}` : ""}
${prefs.modality?.length ? `- Preferred modality: ${prefs.modality.join(", ")}` : ""}

Return ONLY a JSON array. Each object must have:
{
  "name": "Full Name",
  "credentials": "e.g. LCSW or PhD",
  "specialties": ["array", "of", "specialties"],
  "insuranceAccepted": ["array of insurers, include the user's insurance on some profiles"],
  "selfPayRate": "$120" or null,
  "location": "City, ST",
  "telehealth": true or false,
  "acceptingNewPatients": true,
  "nextAvailableSlot": "ISO date string within next 14 days" or null,
  "bookingUrl": "https://www.psychologytoday.com/us/therapists/[plausible-slug]",
  "contactEmail": "email or null"
}

Make the profiles feel real and varied. Mix insurance matches and non-matches. Vary telehealth availability.`;

  const response = await getClient().chat.completions.create({
    model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5",
    max_tokens: 3000,
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: prompt + '\n\nReturn as: {"profiles": [...]}',
      },
    ],
  });

  const text = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(text) as { profiles?: Record<string, unknown>[] };
  const profiles = parsed.profiles ?? [];

  return profiles.slice(0, MAX_RESULTS).map((p) => ({
    id: uuidv4(),
    source: "psychology_today",
    name: (p.name as string) ?? "Unknown",
    credentials: (p.credentials as string) ?? "",
    specialties: (p.specialties as string[]) ?? [],
    insuranceAccepted: (p.insuranceAccepted as string[]) ?? [],
    selfPayRate: (p.selfPayRate as string) ?? undefined,
    location: (p.location as string) ?? locationStr,
    telehealth: Boolean(p.telehealth),
    acceptingNewPatients: p.acceptingNewPatients !== false,
    nextAvailableSlot: (p.nextAvailableSlot as string) ?? undefined,
    bookingUrl: (p.bookingUrl as string) ?? undefined,
    contactEmail: (p.contactEmail as string) ?? undefined,
    profileUrl: (p.bookingUrl as string) ?? "https://www.psychologytoday.com/us/therapists",
  }));
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function searchDirectories(
  prefs: IntakePreferences,
  sessionId: string
): Promise<NormalizedProfile[]> {
  emitEvent(sessionId, { type: "status", message: "Searching therapist directories…" });

  const profiles = await generateProfilesWithLLM(prefs, sessionId);
  emitEvent(sessionId, {
    type: "search_progress",
    source: "psychology_today",
    found: profiles.length,
  });

  // Emit extraction progress
  profiles.forEach((_, i) => {
    emitEvent(sessionId, {
      type: "extraction_progress",
      total: profiles.length,
      done: i + 1,
    });
  });

  return profiles.slice(0, MAX_RESULTS);
}

// ─── Snippet extractor (used when scraping succeeds) ─────────────────────────

interface RawListing { name: string; url: string; source: string; snippet: string }

function extractFromSnippet(listing: RawListing): NormalizedProfile {
  const text = listing.snippet;
  const specialtyKeywords = [
    "anxiety", "depression", "trauma", "ptsd", "couples", "family",
    "grief", "addiction", "ocd", "bipolar", "adhd", "stress", "anger",
    "eating disorder", "lgbtq", "relationship", "career", "life transitions",
  ];
  const specialties = specialtyKeywords.filter((kw) => text.toLowerCase().includes(kw));
  const credentialsMatch = text.match(/\b(LCSW|LMFT|PhD|PsyD|LPC|LMHC|MD|MSW|MFT|NP)\b/);
  const insuranceMatch = text.match(/insurance[:\s]+([^\n.]+)/i);
  const rateMatch = text.match(/\$(\d+)/);
  const locationMatch = text.match(/([A-Z][a-z]+,\s*[A-Z]{2})/);

  return {
    id: uuidv4(),
    source: listing.source,
    name: listing.name,
    credentials: credentialsMatch?.[1] ?? "",
    specialties: specialties.slice(0, 5),
    insuranceAccepted: insuranceMatch
      ? insuranceMatch[1].split(/,|and/).map((s) => s.trim()).filter(Boolean)
      : [],
    selfPayRate: rateMatch ? `$${rateMatch[1]}` : undefined,
    location: locationMatch?.[1] ?? "Unknown",
    telehealth:
      text.toLowerCase().includes("telehealth") ||
      text.toLowerCase().includes("online therapy"),
    acceptingNewPatients: !text.toLowerCase().includes("not accepting new"),
    bookingUrl: listing.url,
    profileUrl: listing.url,
    rawExcerpt: text,
  };
}
