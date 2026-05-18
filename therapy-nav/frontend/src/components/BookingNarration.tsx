import { useSessionStore } from "../store/sessionStore";
import { MousePointerClick } from "lucide-react";

export function BookingNarration() {
  const statusFeed = useSessionStore((s) => s.statusFeed);
  const bookingActions = statusFeed.filter((e) => e.type === "booking_action");

  return (
    <div className="bg-gray-50 rounded-xl p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Booking Progress</h3>
      {bookingActions.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Starting booking process...</p>
      ) : (
        <div className="space-y-2">
          {bookingActions.map((action) => (
            <div key={action.id} className="flex items-start gap-2 text-sm text-gray-600">
              <MousePointerClick className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <span>{action.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
