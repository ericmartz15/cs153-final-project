import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { StatusFeed } from "../components/StatusFeed";
import { Loader2 } from "lucide-react";

export function SearchStatus() {
  const navigate = useNavigate();
  const { phase, statusFeed } = useSessionStore();

  useEffect(() => {
    if (phase === "results") navigate("/results");
  }, [phase, navigate]);

  const totalFound = statusFeed
    .filter((e) => e.type === "search_progress")
    .reduce((sum, e) => sum + ((e.extra?.found as number) ?? 0), 0);

  const done = statusFeed.some((e) => e.message.includes("Ranking"));

  return (
    <div className="min-h-screen bg-sage-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Animated logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-sage-100 rounded-2xl flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-sage-500 animate-spin" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 text-center mb-1">
          Searching for therapists…
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          We're checking real directories right now. This usually takes under 30 seconds.
        </p>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-6 overflow-hidden">
          <div
            className="bg-sage-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: done ? "100%" : totalFound > 0 ? "65%" : "30%" }}
          />
        </div>

        {/* Live status feed */}
        <div className="space-y-1">
          <StatusFeed />
        </div>

        {totalFound > 0 && (
          <p className="mt-4 text-center text-sm text-sage-600 font-medium">
            Found {totalFound} candidates so far…
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center max-w-sm">
        We search live directories like Psychology Today — never relying on
        pre-cached or made-up results.
      </p>
    </div>
  );
}
