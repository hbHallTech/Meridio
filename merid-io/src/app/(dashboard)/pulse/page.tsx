"use client";

import { useState, useEffect } from "react";
import { MoodWidget } from "@/components/pulse/MoodWidget";
import { ShoutoutFeed } from "@/components/pulse/ShoutoutFeed";
import { Activity, TrendingUp } from "lucide-react";

const MOOD_EMOJI: Record<string, string> = {
  VERY_BAD: "\uD83D\uDE1E",
  BAD: "\uD83D\uDE1F",
  NEUTRAL: "\uD83D\uDE10",
  GOOD: "\uD83D\uDE0A",
  VERY_GOOD: "\uD83D\uDE04",
};

interface MoodHistoryItem {
  id: string;
  mood: string;
  comment: string | null;
  createdAt: string;
}

export default function PulsePage() {
  const [history, setHistory] = useState<MoodHistoryItem[]>([]);

  useEffect(() => {
    fetch("/api/profile/mood-checkins?limit=14")
      .then((r) => (r.ok ? r.json() : []))
      .then(setHistory)
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="h-7 w-7 text-[#00BCD4]" />
          Pulse
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Mon humeur et la reconnaissance entre collegues
        </p>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Mood */}
        <div className="space-y-4">
          <MoodWidget />

          {/* Mood history */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-[#00BCD4]" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Historique recent
              </h3>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                Aucun check-in pour l&apos;instant
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2"
                  >
                    <span className="text-xl">{MOOD_EMOJI[item.mood] || "\uD83D\uDE10"}</span>
                    <div className="flex-1 min-w-0">
                      {item.comment && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                          {item.comment}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Shoutouts */}
        <ShoutoutFeed />
      </div>
    </div>
  );
}
