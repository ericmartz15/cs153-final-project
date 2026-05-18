import { RankedProfile, IntakePreferences } from "../../types/index.js";

export function generateOutreachMessage(
  therapist: RankedProfile,
  prefs: IntakePreferences
): string {
  const location =
    prefs.location === "telehealth"
      ? "telehealth/online"
      : typeof prefs.location === "object"
      ? [prefs.location.city, prefs.location.state].filter(Boolean).join(", ") ||
        prefs.location.zip ||
        "my area"
      : "my area";

  const availabilityStr =
    prefs.availability.days.length > 0 || prefs.availability.timeOfDay.length > 0
      ? [
          prefs.availability.days.join(", "),
          prefs.availability.timeOfDay.map((t) => `${t}s`).join(", "),
        ]
          .filter(Boolean)
          .join(" ")
      : "flexible";

  const insurance =
    prefs.insurance === "self-pay"
      ? "I will be paying out of pocket."
      : `I have ${prefs.insurance} insurance.`;

  const concern =
    prefs.specialty.length > 0
      ? `I'm reaching out because I'm looking for support with ${prefs.specialty.join(" and ")}.`
      : "I'm reaching out because I'm looking for therapy support.";

  return `Subject: New Patient Inquiry

Dear ${therapist.name}${therapist.credentials ? `, ${therapist.credentials}` : ""},

I hope this message finds you well. ${concern}

I'm located in ${location} and would love to schedule an appointment${therapist.telehealth ? " (in-person or via telehealth)" : ""}. My availability is generally ${availabilityStr}.

${insurance}

Could you let me know if you are currently accepting new patients and if you have any availability that might work?

Thank you so much for your time. I look forward to hearing from you.

Warm regards,
[Your Name]`;
}
