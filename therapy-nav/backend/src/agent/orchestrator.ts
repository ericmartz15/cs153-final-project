import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { searchDirectories } from "./tools/searchTool.js";
import { rankProfiles } from "./tools/rankingTool.js";
import { startBooking, fillBookingField, detectTrustBoundary } from "./tools/bookingTool.js";
import { generateOutreachMessage } from "./tools/outreachTool.js";
import { getSession, updateSession, emitEvent } from "../sessionStore.js";
import { IntakePreferences, RankedProfile } from "../types/index.js";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://therapynav.app",
    "X-OpenRouter-Title": "TherapyNav",
  },
});

const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "intake_complete",
      description:
        "Call this when intake is complete and you have confirmed preferences with the user. Triggers the search phase.",
      parameters: {
        type: "object",
        properties: {
          preferences: {
            type: "object",
            description: "The collected user preferences",
            properties: {
              specialty: { type: "array", items: { type: "string" } },
              insurance: { type: "string" },
              location: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      zip: { type: "string" },
                      city: { type: "string" },
                      state: { type: "string" },
                    },
                  },
                  { type: "string", enum: ["telehealth"] },
                ],
              },
              availability: {
                type: "object",
                properties: {
                  days: { type: "array", items: { type: "string" } },
                  timeOfDay: { type: "array", items: { type: "string" } },
                },
                required: ["days", "timeOfDay"],
              },
              genderPreference: { type: "string" },
              language: { type: "string" },
              modality: { type: "array", items: { type: "string" } },
            },
            required: ["specialty", "insurance", "location", "availability"],
          },
        },
        required: ["preferences"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_directories",
      description:
        "Search therapist directories using collected preferences. Returns normalized profiles.",
      parameters: {
        type: "object",
        properties: {
          preferences: { type: "object", description: "The IntakePreferences object" },
        },
        required: ["preferences"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rank_profiles",
      description:
        "Rank profiles by preference match and return top 5 with tradeoff explanations.",
      parameters: {
        type: "object",
        properties: {
          preferences: { type: "object", description: "User preferences" },
        },
        required: ["preferences"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_booking",
      description: "Start the automated booking flow for a selected therapist.",
      parameters: {
        type: "object",
        properties: {
          therapist_id: {
            type: "string",
            description: "The ID of the selected therapist from ranked results",
          },
        },
        required: ["therapist_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fill_booking_field",
      description: "Fill a non-sensitive field in the booking form.",
      parameters: {
        type: "object",
        properties: {
          booking_session_id: { type: "string" },
          field: { type: "string", description: "Field label or name" },
          value: { type: "string", description: "Value to fill" },
        },
        required: ["booking_session_id", "field", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detect_trust_boundary",
      description:
        "Check if the current booking form page has any trust boundary fields.",
      parameters: {
        type: "object",
        properties: {
          booking_session_id: { type: "string" },
        },
        required: ["booking_session_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_outreach_message",
      description:
        "Generate a pre-filled outreach message for a therapist when online booking is unavailable.",
      parameters: {
        type: "object",
        properties: {
          therapist_id: { type: "string" },
        },
        required: ["therapist_id"],
      },
    },
  },
];

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  sessionId: string
): Promise<unknown> {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found");

  switch (toolName) {
    case "intake_complete": {
      const prefs = toolInput.preferences as IntakePreferences;
      updateSession(sessionId, { preferences: prefs, phase: "searching" });
      emitEvent(sessionId, { type: "status", message: "Starting therapist search..." });
      return { success: true, message: "Intake complete. Starting search." };
    }

    case "search_directories": {
      const prefs = (toolInput.preferences as IntakePreferences) ?? session.preferences!;
      updateSession(sessionId, { phase: "searching" });
      emitEvent(sessionId, { type: "status", message: "Searching therapist directories..." });
      const profiles = await searchDirectories(prefs, sessionId);
      updateSession(sessionId, { profiles: profiles as RankedProfile[] });
      return { profiles, count: profiles.length };
    }

    case "rank_profiles": {
      const prefs = (toolInput.preferences as IntakePreferences) ?? session.preferences!;
      const rawProfiles = session.profiles ?? [];
      emitEvent(sessionId, { type: "status", message: "Ranking therapists by your preferences..." });
      const ranked = await rankProfiles(rawProfiles, prefs);
      updateSession(sessionId, { profiles: ranked, phase: "results" });
      emitEvent(sessionId, { type: "results_ready", count: ranked.length });
      return { rankedProfiles: ranked };
    }

    case "start_booking": {
      const therapistId = toolInput.therapist_id as string;
      const therapist = session.profiles?.find((p) => p.id === therapistId);
      if (!therapist) return { error: "Therapist not found" };

      const bookingSession = await startBooking(therapist as RankedProfile, sessionId);
      updateSession(sessionId, { bookingSession, phase: "booking" });

      if (bookingSession.status === "fallback") {
        return { status: "fallback", message: "No online booking available" };
      }
      return { bookingSessionId: bookingSession.sessionId, status: "active" };
    }

    case "fill_booking_field": {
      const result = await fillBookingField(
        toolInput.booking_session_id as string,
        toolInput.field as string,
        toolInput.value as string,
        sessionId
      );
      return result;
    }

    case "detect_trust_boundary": {
      const event = await detectTrustBoundary(toolInput.booking_session_id as string);
      if (event) {
        emitEvent(sessionId, { type: "trust_boundary", event });
        return { trustBoundaryHit: true, event };
      }
      return { trustBoundaryHit: false };
    }

    case "generate_outreach_message": {
      const therapistId = toolInput.therapist_id as string;
      const therapist = session.profiles?.find((p) => p.id === therapistId) as RankedProfile;
      if (!therapist) return { error: "Therapist not found" };

      const message = generateOutreachMessage(therapist, session.preferences!);
      updateSession(sessionId, { outreachMessage: message });
      emitEvent(sessionId, { type: "fallback_ready" });
      return { message };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

export async function runOrchestratorTurn(
  sessionId: string,
  userMessage: string
): Promise<string> {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found");

  session.conversationHistory.push({ role: "user", content: userMessage });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...session.conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  let response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    tools: TOOLS,
    messages,
  });

  // Agentic loop
  while (response.choices[0].finish_reason === "tool_calls") {
    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);

    const toolCalls = assistantMessage.tool_calls ?? [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

      emitEvent(sessionId, {
        type: "status",
        message: `Using tool: ${toolName}...`,
      });

      let result: unknown;
      try {
        result = await executeTool(toolName, toolInput, sessionId);
      } catch (err) {
        result = { error: String(err) };
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      tools: TOOLS,
      messages,
    });
  }

  const finalText = response.choices[0].message.content ?? "";
  session.conversationHistory.push({ role: "assistant", content: finalText });

  return finalText;
}
