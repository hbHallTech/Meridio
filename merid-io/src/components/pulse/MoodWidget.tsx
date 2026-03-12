"use client";

import { useState, useEffect } from "react";

const MOODS = [
  { value: "VERY_BAD", emoji: "\uD83D\uDE1E", label: "Très mal" },
  { value: "BAD", emoji: "\uD83D\uDE1F", label: "Mal" },
  { value: "NEUTRAL", emoji: "\uD83D\uDE10", label: "Neutre" },
  { value: "GOOD", emoji: "\uD83D\uDE0A", label: "Bien" },
  { value: "VERY_GOOD", emoji: "\uD83D\uDE04", label: "Très bien" },
];

export function MoodWidget() {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [todayMood, setTodayMood] = useState<string | null>(null);

  // Check if already submitted today
  useEffect(() => {
    fetch("/api/profile/mood-checkins?limit=1")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (data.length > 0) {
          const latest = data[0];
          const latestDate = new Date(latest.createdAt).toDateString();
          const today = new Date().toDateString();
          if (latestDate === today) {
            setTodayMood(latest.mood);
            setSubmitted(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!selectedMood) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile/mood-checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: selectedMood, comment: comment || undefined }),
      });
      if (res.ok) {
        setTodayMood(selectedMood);
        setSubmitted(true);
      }
    } catch {
      /* ignore */
    }
    setSaving(false);
  }

  if (submitted && todayMood) {
    const mood = MOODS.find((m) => m.value === todayMood);
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">Mon humeur aujourd&apos;hui</p>
          <button
            onClick={() => {
              setSubmitted(false);
              setSelectedMood(todayMood);
            }}
            className="text-xs text-[#00BCD4] hover:underline"
          >
            Modifier
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-3xl">{mood?.emoji}</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{mood?.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
        Comment vous sentez-vous aujourd&apos;hui ?
      </p>
      <div className="flex justify-between mb-3">
        {MOODS.map((mood) => (
          <button
            key={mood.value}
            onClick={() => setSelectedMood(mood.value)}
            className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-all ${
              selectedMood === mood.value
                ? "bg-[#00BCD4]/10 ring-2 ring-[#00BCD4] scale-110"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            title={mood.label}
          >
            <span className="text-2xl">{mood.emoji}</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{mood.label}</span>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 280))}
        placeholder="Un commentaire ? (optionnel)"
        rows={2}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm resize-none focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">{comment.length}/280</span>
        <button
          onClick={handleSubmit}
          disabled={!selectedMood || saving}
          className="rounded-lg bg-[#1B3A5C] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50 transition-colors"
        >
          {saving ? "..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
