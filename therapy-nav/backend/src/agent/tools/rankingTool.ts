import Anthropic from "@anthropic-ai/sdk";
import { NormalizedProfile, RankedProfile, IntakePreferences } from "../../types/index.js";

const client = new Anthropic();

const MAX_SHORTLIST = parseInt(process.env.MAX_SHORTLIST ?? "5", 10);

function scoreProfile(profile: NormalizedProfile, prefs: IntakePreferences): number {
  let score = 0;

  // Disqualify if explicitly not accepting new patients
  if (!profile.acceptingNewPatients) return -1;

  // Insurance match: +40 pts for exact match, +10 for sliding scale when self-pay
  if (prefs.insurance === "self-pay") {
    if (
      profile.selfPayRate ||
      profile.insuranceAccepted.some((ins) =>
        ins.toLowerCase().includes("sliding scale")
      )
    ) {
      score += 10;
    }
  } else {
    const insuranceLower = (prefs.insurance as string).toLowerCase();
    if (
      profile.insuranceAccepted.some((ins) =>
        ins.toLowerCase().includes(insuranceLower)
      )
    ) {
      score += 40;
    }
  }

  // Specialty match: +30 pts per matched specialty
  for (const specialty of prefs.specialty) {
    if (
      profile.specialties.some((s) =>
        s.toLowerCase().includes(specialty.toLowerCase())
      )
    ) {
      score += 30;
    }
  }

  // Accepting new patients: +20 pts (already disqualified if false above)
  score += 20;

  // Telehealth match: +15 pts
  if (prefs.location === "telehealth" && profile.telehealth) {
    score += 15;
  }

  // Availability proximity: +0-15 pts
  if (profile.nextAvailableSlot) {
    const daysUntil = Math.max(
      0,
      (new Date(profile.nextAvailableSlot).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );
    const proximityScore = Math.max(0, 15 - daysUntil);
    score += proximityScore;
  }

  return score;
}

async function generateTradeoffExplanation(
  profile: NormalizedProfile,
  prefs: IntakePreferences,
  score: number
): Promise<string> {
  const hasInsuranceMatch =
    prefs.insurance !== "self-pay" &&
    profile.insuranceAccepted.some((ins) =>
      ins.toLowerCase().includes((prefs.insurance as string).toLowerCase())
    );

  const specialtyMatches = prefs.specialty.filter((s) =>
    profile.specialties.some((ps) =>
      ps.toLowerCase().includes(s.toLowerCase())
    )
  );

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `Write a 1-2 sentence warm, non-clinical explanation of why this therapist was recommended and any tradeoffs.
Therapist: ${profile.name} ${profile.credentials}
Specialties: ${profile.specialties.join(", ")}
Insurance match: ${hasInsuranceMatch ? "yes" : "no"}
Specialty matches: ${specialtyMatches.join(", ") || "partial"}
Self-pay rate: ${profile.selfPayRate ?? "not listed"}
Telehealth: ${profile.telehealth ? "yes" : "no"}
Score: ${score}

Be honest about tradeoffs. Keep it under 40 words. Warm and empathetic tone.`,
        },
      ],
    });

    return response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "A good match based on your preferences.";
  } catch {
    if (hasInsuranceMatch && specialtyMatches.length > 0) {
      return `Matches your insurance and specializes in ${specialtyMatches[0]}. Strong overall fit for your needs.`;
    }
    return `Specializes in ${profile.specialties[0] ?? "general therapy"} and is currently accepting new patients.`;
  }
}

export async function rankProfiles(
  profiles: NormalizedProfile[],
  prefs: IntakePreferences
): Promise<RankedProfile[]> {
  const scored = profiles
    .map((p) => ({ profile: p, score: scoreProfile(p, prefs) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SHORTLIST);

  const ranked: RankedProfile[] = await Promise.all(
    scored.map(async ({ profile, score }) => {
      const tradeoffExplanation = await generateTradeoffExplanation(
        profile,
        prefs,
        score
      );
      return { ...profile, score, tradeoffExplanation };
    })
  );

  return ranked;
}
