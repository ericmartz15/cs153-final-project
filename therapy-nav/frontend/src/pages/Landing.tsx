import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { ArrowRight, Search, Star, CalendarCheck } from "lucide-react";

export function Landing() {
  const navigate = useNavigate();
  const { initSession, isLoading } = useSessionStore();

  const handleStart = async () => {
    await initSession();
    navigate("/chat");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sage-50 to-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <div className="w-8 h-8 bg-sage-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">TN</span>
          </div>
          <span className="font-semibold text-sage-800 text-lg">TherapyNav</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Finding the right therapist{" "}
            <span className="text-sage-500">shouldn't be hard.</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed">
            Tell us what you need. We'll search real therapist directories, match
            you with the best fits, and handle the booking — so you can focus on
            taking that first step.
          </p>

          <button
            onClick={handleStart}
            disabled={isLoading}
            className="mt-10 inline-flex items-center gap-3 px-8 py-4 bg-sage-500 hover:bg-sage-600 disabled:opacity-60 text-white font-semibold rounded-2xl text-lg shadow-lg shadow-sage-200 transition-all hover:shadow-xl hover:-translate-y-0.5"
          >
            {isLoading ? "Getting started…" : "Find a therapist"}
            {!isLoading && <ArrowRight className="w-5 h-5" />}
          </button>

          <p className="mt-4 text-sm text-gray-400">
            No account needed · No sensitive data stored
          </p>
        </div>

        {/* How it works */}
        <div className="max-w-3xl mx-auto mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              icon: Star,
              title: "Tell us what you need",
              desc: "Share your preferences in a brief, supportive conversation.",
            },
            {
              icon: Search,
              title: "We find your options",
              desc: "We search real therapist directories in real time — never guessed results.",
            },
            {
              icon: CalendarCheck,
              title: "We book for you",
              desc: "We fill out the booking form and hand off only when your input is needed.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="w-12 h-12 bg-sage-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-sage-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-gray-400">
        TherapyNav is not a clinical service and does not provide medical advice.
      </footer>
    </div>
  );
}
