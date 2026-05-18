import { useState } from "react";
import { RankedProfile } from "../types";
import { ChevronDown, ChevronUp, CheckCircle, Video, MapPin, Clock } from "lucide-react";

interface Props {
  profile: RankedProfile;
  onBook: (id: string) => void;
  rank: number;
}

export function TherapistCard({ profile, onBook, rank }: Props) {
  const [showTradeoff, setShowTradeoff] = useState(false);

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={profile.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 font-semibold text-lg">
              {initials}
            </div>
          )}
          <span className="absolute -top-1 -left-1 w-6 h-6 bg-sage-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {rank}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                {profile.name}
                {profile.credentials && (
                  <span className="text-gray-500 font-normal text-sm ml-1">
                    {profile.credentials}
                  </span>
                )}
              </h3>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.acceptingNewPatients && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200">
                    <CheckCircle className="w-3 h-3" />
                    Accepting new patients
                  </span>
                )}
                {profile.telehealth && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                    <Video className="w-3 h-3" />
                    Telehealth
                  </span>
                )}
                {profile.insuranceAccepted.slice(0, 2).map((ins) => (
                  <span
                    key={ins}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                  >
                    {ins}
                  </span>
                ))}
                {profile.selfPayRate && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full border border-amber-200">
                    {profile.selfPayRate}/session
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Specialties */}
          {profile.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {profile.specialties.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 bg-sage-50 text-sage-700 text-xs rounded-full capitalize"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Location & Availability */}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
            {profile.location && profile.location !== "Unknown" && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {profile.location}
              </span>
            )}
            {profile.nextAvailableSlot && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Next: {new Date(profile.nextAvailableSlot).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Tradeoff explanation */}
          <div className="mt-3">
            <button
              onClick={() => setShowTradeoff(!showTradeoff)}
              className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-700 font-medium"
            >
              Why recommended
              {showTradeoff ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {showTradeoff && (
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed bg-sage-50 rounded-lg p-3">
                {profile.tradeoffExplanation}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Book CTA */}
      <button
        onClick={() => onBook(profile.id)}
        className="w-full mt-5 py-3 bg-sage-500 hover:bg-sage-600 text-white font-medium rounded-xl transition-colors"
      >
        Book with {profile.name.split(" ")[0]}
      </button>
    </div>
  );
}
