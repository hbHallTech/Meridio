"use client";

import { useSession, signOut } from "next-auth/react";
import { useInactivity } from "@/hooks/useInactivity";
import { Clock } from "lucide-react";

const i18n = {
  fr: {
    title: "Session bientot expiree",
    body: "Vous serez deconnecte dans",
    seconds: "secondes",
    stay: "Rester connecte",
    logout: "Se deconnecter",
  },
  en: {
    title: "Session about to expire",
    body: "You will be logged out in",
    seconds: "seconds",
    stay: "Stay connected",
    logout: "Log out",
  },
} as const;

export function IdleTimeoutModal() {
  const { data: session } = useSession();
  const { showWarning, secondsLeft, stayActive } = useInactivity();
  const lang = (session?.user?.language as "fr" | "en") ?? "fr";
  const t = i18n[lang] ?? i18n.fr;

  if (!showWarning) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h2
            id="idle-title"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {t.title}
          </h2>
        </div>

        <p
          id="idle-desc"
          className="mt-4 text-sm text-gray-600 dark:text-gray-400"
        >
          {t.body}{" "}
          <span className="font-mono text-lg font-bold text-red-600 dark:text-red-400">
            {secondsLeft}
          </span>{" "}
          {t.seconds}.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={stayActive}
            autoFocus
            className="flex-1 rounded-lg bg-[#1B3A5C] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#15304d] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] focus:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            {t.stay}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {t.logout}
          </button>
        </div>
      </div>
    </div>
  );
}
