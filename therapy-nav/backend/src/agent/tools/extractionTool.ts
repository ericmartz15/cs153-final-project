import Anthropic from "@anthropic-ai/sdk";
import { NormalizedProfile } from "../../types/index.js";
import { v4 as uuidv4 } from "uuid";

const client = new Anthropic();

const EXTRACTION_PROMPT = `Extract therapist profile information from the following HTML/text.
Return a JSON object with these exact fields (use null for missing values):
{
  "name": string,
  "credentials": string,
  "specialties": string[],
  "insuranceAccepted": string[],
  "selfPayRate": string | null,
  "location": string,
  "telehealth": boolean,
  "acceptingNewPatients": boolean,
  "nextAvailableSlot": string | null,
  "bookingUrl": string | null,
  "contactEmail": string | null,
  "contactPhone": string | null,
  "photoUrl": string | null
}

Return ONLY valid JSON, no markdown, no explanation.`;

export async function extractProfile(
  rawText: string,
  source: string,
  profileUrl: string
): Promise<NormalizedProfile> {
  // Truncate to avoid token limits
  const truncated = rawText.slice(0, 8000);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: EXTRACTION_PROMPT,
      messages: [{ role: "user", content: `SOURCE: ${source}\nURL: ${profileUrl}\n\n${truncated}` }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const parsed = JSON.parse(text);

    return {
      id: uuidv4(),
      source,
      name: parsed.name ?? "Unknown",
      credentials: parsed.credentials ?? "",
      specialties: Array.isArray(parsed.specialties) ? parsed.specialties : [],
      insuranceAccepted: Array.isArray(parsed.insuranceAccepted) ? parsed.insuranceAccepted : [],
      selfPayRate: parsed.selfPayRate ?? undefined,
      location: parsed.location ?? "Unknown",
      telehealth: Boolean(parsed.telehealth),
      acceptingNewPatients: parsed.acceptingNewPatients !== false,
      nextAvailableSlot: parsed.nextAvailableSlot ?? undefined,
      bookingUrl: parsed.bookingUrl ?? undefined,
      contactEmail: parsed.contactEmail ?? undefined,
      contactPhone: parsed.contactPhone ?? undefined,
      photoUrl: parsed.photoUrl ?? undefined,
      profileUrl,
    };
  } catch (err) {
    console.error("Extraction error:", err);
    return {
      id: uuidv4(),
      source,
      name: "Unknown",
      credentials: "",
      specialties: [],
      insuranceAccepted: [],
      location: "Unknown",
      telehealth: false,
      acceptingNewPatients: true,
      profileUrl,
    };
  }
}
