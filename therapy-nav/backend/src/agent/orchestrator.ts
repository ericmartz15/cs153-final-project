import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { searchDirectories } from "./tools/searchTool.js";
import { rankProfiles } from "./tools/rankingTool.js";
import { startBooking, fillBookingField, detectTrustBoundary } from "./tools/bookingTool.js";
import { generateOutreachMessage } from "./tools/outreachTool.js";
import { getSession, updateSession, emitEvent } from "../sessionStore.js";
import { IntakePreferences, RankedProfile } from "../types/index.js";

const client = new Anthropic();

const TOOLS: Anthropic.Tool[] = [
  {
    name: "intake_complete",
    description: "Call this when intake is complete and you have confirmed preferences with the user. Triggers the search phase.",
    input_schema: {
      type: "object" as const,
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
  {
    name: "search_directories",
    description: "Search therapist directories using collected preferences. Returns normalized profiles.",
    input_schema: {
      type: "object" as const,
      properties: {
        preferences: { type: "object", description: "The IntakePreferences object" },
      },
      required: ["preferences"],
    },
  },
  {
    name: "rank_profiles",
    description: "Rank profiles by preference match and return top 5 with tradeoff explanations.",
    input_schema: {
      type: "object" as const,
      properties: {
        preferences: { type: "object", description: "User preferences" },
      },
      required: ["preferences"],
    },
  },
  {
    name: "start_booking",
    description: "Start the automated booking flow for a selected therapist.",
    input_schema: {
      type: "object" as const,
      properties: {
        therapist_id: { type: "string", description: "The ID of the selected therapist from ranked results" },
      },
      required: ["therapist_id"],
    },
  },
  {
    name: "fill_booking_field",
    description: "Fill a non-sensitive field in the booking form.",
    input_schema: {
      type: "object" as const,
      properties: {
        booking_session_id: { type: "string" },
        field: { type: "string", description: "Field label or name" },
        value: { type: "string", description: "Value to fill" },
      },
      required: ["booking_session_id", "field", "value"],
    },
  },
  {
    name: "detect_trust_boundary",
    description: "Check if the current booking form page has any trust boundary fields.",
    input_schema: {
      type: "object" as const,
      properties: {
        booking_session_id: { type: "string" },
      },
      required: ["booking_session_id"],
    },
  },
  {
    name: "generate_outreach_message",
    description: "Generate a pre-filled outreach message for a therapist when online booking is unavailable.",
    input_schema: {
      type: "object" as const,
      properties: {
        therapist_id: { type: "string" },
      },
      required: ["therapist_id"],
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

  // Append user message to history
  session.conversationHistory.push({ role: "user", content: userMessage });

  const messages: Anthropic.MessageParam[] = session.conversationHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages,
  });

  // Agentic loop
  while (response.stop_reason === "tool_use") {
    const assistantContent = response.content;
    messages.push({ role: "assistant", content: assistantContent });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of assistantContent) {
      if (block.type === "tool_use") {
        emitEvent(sessionId, {
          type: "status",
          message: `Using tool: ${block.name}...`,
        });

        try {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            sessionId
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ error: String(err) }),
            is_error: true,
          });
        }
      }
    }

    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });
  }

  // Extract final text response
  const finalText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("\n");

  // Save assistant response to history
  session.conversationHistory.push({ role: "assistant", content: finalText });

  return finalText;
}
