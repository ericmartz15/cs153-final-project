import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { BookingNarration } from "../components/BookingNarration";
import { TrustBoundaryBanner } from "../components/TrustBoundaryBanner";
import { FallbackMessage } from "../components/FallbackMessage";
import { ChatBubble } from "../components/ChatBubble";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";

export function Booking() {
  const navigate = useNavigate();
  const {
    messages,
    phase,
    bookingSession,
    trustBoundaryEvent,
    outreachMessage,
    isLoading,
  } = useSessionStore();

  const isFallback =
    bookingSession?.status === "fallback" || outreachMessage !== null;
  const isComplete = phase === "complete";

  // Latest assistant messages for context
  const recentMessages = messages.slice(-4);

  useEffect(() => {
    if (!bookingSession && phase !== "booking") {
      navigate("/results");
    }
  }, [bookingSession, phase, navigate]);

  return (
    <div className="min-h-screen bg-sage-50 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate("/results")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to results
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-sage-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">TN</span>
            </div>
            <span className="font-semibold text-sage-800">TherapyNav</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-8">
        {isComplete ? (
          <div className="flex flex-col items-center text-center py-16">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">All done!</h2>
            <p className="text-gray-500 max-w-sm">
              Your appointment has been booked. Take care of yourself — you've taken a great step.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {isFallback ? "Outreach message ready" : "Booking in progress"}
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              {isFallback
                ? "This therapist doesn't have online booking. Here's a ready-to-send message."
                : "I'm handling the booking form for you. I'll narrate every step."}
            </p>

            {/* Split view: narration + status */}
            {!isFallback && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Left: narration log */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                    What I'm doing
                  </h2>
                  <BookingNarration />
                </div>

                {/* Right: recent chat messages */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
                    Agent updates
                  </h2>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 min-h-32">
                    {recentMessages.length === 0 ? (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Initializing booking…</span>
                      </div>
                    ) : (
                      recentMessages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} />
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Trust boundary banner */}
            {trustBoundaryEvent && <TrustBoundaryBanner />}

            {/* Fallback message */}
            {isFallback && <FallbackMessage />}

            {isLoading && !trustBoundaryEvent && !isFallback && (
              <div className="flex items-center gap-2 text-sage-500 mt-4">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Working on it…</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
