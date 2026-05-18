const TRUST_BOUNDARY_BLOCKLIST = [
  "password",
  "date of birth",
  "dob",
  "insurance id",
  "member id",
  "ssn",
  "social security",
  "credit card",
  "card number",
  "billing",
  "login",
  "sign in",
  "bank account",
  "routing number",
  "tax id",
];

export function isTrustBoundaryField(fieldLabel: string): boolean {
  const normalized = fieldLabel.toLowerCase().trim();
  return TRUST_BOUNDARY_BLOCKLIST.some((blocked) =>
    normalized.includes(blocked)
  );
}

export function sanitizeForLLM(data: Record<string, unknown>): Record<string, unknown> {
  const sensitive = [
    "password",
    "dob",
    "dateofbirth",
    "ssn",
    "insuranceid",
    "memberid",
    "creditcard",
    "cardnumber",
    "billinginfo",
  ];
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[_\s-]/g, "");
    if (sensitive.some((s) => lowerKey.includes(s))) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }
  return result;
}
