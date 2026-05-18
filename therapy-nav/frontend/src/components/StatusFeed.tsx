import { useSessionStore } from "../store/sessionStore";
import { Search, Loader2, CheckCircle, AlertCircle, MousePointerClick } from "lucide-react";

export function StatusFeed() {
  const statusFeed = useSessionStore((s) => s.statusFeed);

  if (statusFeed.length === 0) return null;

  return (
    <div className="space-y-2">
      {statusFeed.map((entry) => {
        const Icon =
          entry.type === "error"
            ? AlertCircle
            : entry.type === "booking_action"
            ? MousePointerClick
            : entry.type === "search_progress"
            ? Search
            : entry.type === "status" && entry.message.includes("Found")
            ? CheckCircle
            : Loader2;

        const iconClass =
          entry.type === "error"
            ? "text-red-500"
            : entry.type === "booking_action"
            ? "text-blue-500"
            : entry.type === "search_progress"
            ? "text-sage-500"
            : "text-gray-400";

        return (
          <div
            key={entry.id}
            className="flex items-start gap-2.5 text-sm text-gray-600"
          >
            <Icon
              className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconClass} ${
                Icon === Loader2 ? "animate-spin" : ""
              }`}
            />
            <span>{entry.message}</span>
          </div>
        );
      })}
    </div>
  );
}
