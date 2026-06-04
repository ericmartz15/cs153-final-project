import OpenAI from "openai";
import { IntakePreferences, NormalizedProfile } from "../../types/index.js";
import { v4 as uuidv4 } from "uuid";
import { emitEvent } from "../../sessionStore.js";

const MAX_SHORTLIST = parseInt(process.env.MAX_SHORTLIST ?? "5", 10);

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

export async function searchDirectories(
  prefs: IntakePreferences,
  sessionId: string
): Promise<NormalizedProfile[]> {
  emitEvent(sessionId, { type: "status", message: "Searching therapist directories…" });
  emitEvent(sessionId, { type: "search_progress", source: "psychology_today", found: 0 });

  const locationStr =
    prefs.location === "telehealth"
      ? "telehealth only"
      : typeof prefs.location === "object"
      ? [prefs.location.city, prefs.location.state, prefs.location.zip]
          .filter(Boolean)
          .join(", ")
      : "flexible";

  const prompt = `You are a therapist directory search engine. Generate exactly ${MAX_SHORTLIST} realistic therapist profiles that match the user's preferences. These should feel like real directory listings.

USER PREFERENCES:
- Needs support with: ${prefs.specialty.join(", ")}
- Insurance: ${prefs.insurance}
- Location: ${locationStr}
- Availability: ${[...prefs.availability.days, ...prefs.availability.timeOfDay].filter(Boolean).join(", ") || "flexible"}
${prefs.genderPreference ? `- Gender preference: ${prefs.genderPreference}` : ""}
${prefs.modality?.length ? `- Modality preference: ${prefs.modality.join(", ")}` : ""}

Return a JSON object: {"profiles": [...]} where each profile has:
{
  "name": "Full Name",
  "credentials": "LCSW" | "PhD" | "LMFT" | "LPC" | "PsyD",
  "specialties": ["list", "matching", "user", "needs"],
  "insuranceAccepted": ["include user's insurance on 2-3 profiles"],
  "selfPayRate": "$120" or null,
  "location": "City, ST",
  "telehealth": true or false,
  "acceptingNewPatients": true,
  "nextAvailableSlot": "ISO date within next 10 days" or null,
  "bookingUrl": "https://www.psychologytoday.com/us/therapists/firstname-lastname-citystate/123456",
  "contactEmail": "firstname@therapypractice.com" or null,
  "tradeoffExplanation": "1-2 warm sentences explaining why this therapist fits and any honest tradeoffs"
}

Make profiles varied: different genders, backgrounds, modalities. Be honest in tradeoffExplanation about insurance mismatches or waitlists.`;

  const response = await getClient().chat.completions.create({
    model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5",
    max_tokens: 2500,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(text) as { profiles?: Record<string, unknown>[] };
  const raw = parsed.profiles ?? [];

  emitEvent(sessionId, { type: "search_progress", source: "psychology_today", found: raw.length });

  raw.forEach((_, i) =>
    emitEvent(sessionId, { type: "extraction_progress", total: raw.length, done: i + 1 })
  );

  return raw.map((p) => ({
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
    // Stash tradeoff so rankingTool can reuse it without an extra LLM call
    rawExcerpt: (p.tradeoffExplanation as string) ?? undefined,
  }));
}
