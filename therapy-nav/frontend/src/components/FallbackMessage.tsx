import { useState } from "react";
import { useSessionStore } from "../store/sessionStore";
import { Copy, Mail, Check } from "lucide-react";

export function FallbackMessage() {
  const outreachMessage = useSessionStore((s) => s.outreachMessage);
  const [edited, setEdited] = useState(outreachMessage ?? "");
  const [copied, setCopied] = useState(false);

  if (!outreachMessage) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(edited);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mailtoLink = `mailto:?subject=New%20Patient%20Inquiry&body=${encodeURIComponent(edited)}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="font-semibold text-gray-900 text-lg mb-1">
        Ready-to-send outreach message
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Review and edit this message before sending. Your personal details are not
        submitted automatically.
      </p>

      <textarea
        value={edited}
        onChange={(e) => setEdited(e.target.value)}
        className="w-full h-56 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-sage-300 font-mono leading-relaxed"
      />

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>

        <a
          href={mailtoLink}
          className="flex items-center gap-2 px-4 py-2 border border-sage-300 hover:bg-sage-50 text-sage-700 text-sm font-medium rounded-lg transition-colors"
        >
          <Mail className="w-4 h-4" />
          Open in email app
        </a>
      </div>
    </div>
  );
}
