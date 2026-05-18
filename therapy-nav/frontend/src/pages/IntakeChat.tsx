import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { ChatBubble } from "../components/ChatBubble";
import { Send, RotateCcw, Loader2 } from "lucide-react";

const INTAKE_STEPS = [
  "Specialty",
  "Insurance",
  "Location",
  "Availability",
  "Preferences",
];

export function IntakeChat() {
  const navigate = useNavigate();
  const { messages, phase, sendMessage, isLoading, initSession } = useSessionStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Redirect to results if searching or beyond
  useEffect(() => {
    if (phase === "searching") navigate("/search");
    if (phase === "results") navigate("/results");
    if (phase === "booking") navigate("/booking");
  }, [phase, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRestart = async () => {
    await initSession();
  };

  // Estimate current step from message count
  const stepIndex = Math.min(Math.floor(messages.filter((m) => m.role === "user").length), INTAKE_STEPS.length - 1);

  return (
    <div className="min-h-screen bg-sage-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-sage-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">TN</span>
            </div>
            <span className="font-semibold text-sage-800">TherapyNav</span>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Step {stepIndex + 1} of {INTAKE_STEPS.length}: {INTAKE_STEPS[stepIndex]}
            </span>
            <button
              onClick={handleRestart}
              title="Restart intake"
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="w-8 h-8 rounded-full bg-sage-500 flex items-center justify-center text-white text-xs font-semibold mr-3 flex-shrink-0">
                TN
              </div>
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
                <Loader2 className="w-4 h-4 text-sage-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-4 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message…"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-300 disabled:opacity-60 max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-sage-500 hover:bg-sage-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
