export interface IntakePreferences {
  specialty: string[];
  insurance: string | "self-pay";
  location: { zip?: string; city?: string; state?: string } | "telehealth";
  availability: { days: string[]; timeOfDay: string[] };
  genderPreference?: string;
  language?: string;
  modality?: string[];
}

export interface NormalizedProfile {
  id: string;
  source: string;
  name: string;
  credentials: string;
  specialties: string[];
  insuranceAccepted: string[];
  selfPayRate?: string;
  location: string;
  telehealth: boolean;
  acceptingNewPatients: boolean;
  nextAvailableSlot?: string;
  bookingUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  photoUrl?: string;
  profileUrl: string;
  rawExcerpt?: string;
}

export interface RankedProfile extends NormalizedProfile {
  score: number;
  tradeoffExplanation: string;
}

export interface BookingSession {
  sessionId: string;
  therapistId: string;
  status: "active" | "paused_trust_boundary" | "complete" | "fallback";
  filledFields: { field: string; value: string }[];
  currentUrl: string;
}

export interface TrustBoundaryEvent {
  sessionId: string;
  fieldLabel: string;
  fieldType: string;
  pageUrl: string;
  preFilledBookingUrl?: string;
}

export type SessionPhase =
  | "intake"
  | "searching"
  | "results"
  | "booking"
  | "complete";

export interface AgentSession {
  id: string;
  phase: SessionPhase;
  preferences?: IntakePreferences;
  profiles?: RankedProfile[];
  bookingSession?: BookingSession;
  outreachMessage?: string;
  createdAt: number;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "search_progress"; source: string; found: number }
  | { type: "extraction_progress"; total: number; done: number }
  | { type: "results_ready"; count: number }
  | { type: "booking_action"; description: string }
  | { type: "trust_boundary"; event: TrustBoundaryEvent }
  | { type: "booking_complete" }
  | { type: "fallback_ready" }
  | { type: "error"; message: string };
