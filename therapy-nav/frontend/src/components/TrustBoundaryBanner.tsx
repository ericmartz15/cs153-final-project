import { ShieldAlert, ExternalLink } from "lucide-react";
import { useSessionStore } from "../store/sessionStore";

export function TrustBoundaryBanner() {
  const { trustBoundaryEvent, acknowledgeHandoff } = useSessionStore();

  if (!trustBoundaryEvent) return null;

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 mt-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-800 text-base">
            I've paused here — your input is needed
          </h3>
          <p className="mt-1 text-sm text-amber-700 leading-relaxed">
            I've filled out everything I can. The booking form is now asking for{" "}
            <strong>"{trustBoundaryEvent.fieldLabel}"</strong>, which I'm not able
            to fill in for your privacy and security.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            You'll need to complete this field directly on the booking page.
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            {trustBoundaryEvent.pageUrl && (
              <a
                href={trustBoundaryEvent.preFilledBookingUrl ?? trustBoundaryEvent.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => acknowledgeHandoff()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Complete booking yourself
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
