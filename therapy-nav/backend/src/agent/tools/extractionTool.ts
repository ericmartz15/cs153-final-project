import OpenAI from "openai";
import { NormalizedProfile } from "../../types/index.js";
import { v4 as uuidv4 } from "uuid";

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

const FAST_MODEL = process.env.OPENROUTER_FAST_MODEL ?? "anthropic/claude-haiku-4-5";

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
  const truncated = rawText.slice(0, 8000);

  try {
    const response = await getClient().chat.completions.create({
      model: FAST_MODEL,
      max_tokens: 1024,
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: `SOURCE: ${source}\nURL: ${profileUrl}\n\n${truncated}`,
        },
      ],
    });

    const text = response.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(text) as Record<string, unknown>;

    return {
      id: uuidv4(),
      source,
      name: (parsed.name as string) ?? "Unknown",
      credentials: (parsed.credentials as string) ?? "",
      specialties: Array.isArray(parsed.specialties) ? (parsed.specialties as string[]) : [],
      insuranceAccepted: Array.isArray(parsed.insuranceAccepted)
        ? (parsed.insuranceAccepted as string[])
        : [],
      selfPayRate: (parsed.selfPayRate as string) ?? undefined,
      location: (parsed.location as string) ?? "Unknown",
      telehealth: Boolean(parsed.telehealth),
      acceptingNewPatients: parsed.acceptingNewPatients !== false,
      nextAvailableSlot: (parsed.nextAvailableSlot as string) ?? undefined,
      bookingUrl: (parsed.bookingUrl as string) ?? undefined,
      contactEmail: (parsed.contactEmail as string) ?? undefined,
      contactPhone: (parsed.contactPhone as string) ?? undefined,
      photoUrl: (parsed.photoUrl as string) ?? undefined,
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
