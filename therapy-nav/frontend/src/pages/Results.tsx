import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { TherapistCard } from "../components/TherapistCard";
import { RankedProfile } from "../types";
import { RotateCcw, Loader2 } from "lucide-react";

export function Results() {
  const navigate = useNavigate();
  const { sessionId, profiles, phase, selectTherapist, isLoading } = useSessionStore();
  const [localProfiles, setLocalProfiles] = useState<RankedProfile[]>(profiles);

  useEffect(() => {
    if (phase === "booking") navigate("/booking");
  }, [phase, navigate]);

  // Fetch profiles from server if not yet in store
  useEffect(() => {
    if (profiles.length > 0) {
      setLocalProfiles(profiles);
      return;
    }
    if (!sessionId) return;

    fetch(`/api/session/${sessionId}/results`)
      .then((r) => r.json())
      .then((d: { profiles: RankedProfile[] }) => {
        setLocalProfiles(d.profiles);
      })
      .catch(console.error);
  }, [sessionId, profiles]);

  const handleBook = async (therapistId: string) => {
    await selectTherapist(therapistId);
    navigate("/booking");
  };

  if (localProfiles.length === 0) {
    return (
      <div className="min-h-screen bg-sage-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-sage-400 animate-spin mb-4" />
        <p className="text-gray-500">Loading your matches…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sage-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-sage-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">TN</span>
            </div>
            <span className="font-semibold text-sage-800">TherapyNav</span>
          </div>
          <button
            onClick={() => navigate("/chat")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="w-4 h-4" />
            Refine preferences
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Your top matches
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {localProfiles.length} therapists ranked by how well they fit your preferences.
          Click "Why recommended" to see our reasoning.
        </p>

        <div className="space-y-4">
          {localProfiles.map((profile, i) => (
            <TherapistCard
              key={profile.id}
              profile={profile}
              rank={i + 1}
              onBook={handleBook}
            />
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 mt-8 text-sage-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Starting booking process…</span>
          </div>
        )}
      </div>
    </div>
  );
}
