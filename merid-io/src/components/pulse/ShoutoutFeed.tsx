"use client";

import { useState, useEffect, useCallback } from "react";
import { Heart, Send, X } from "lucide-react";

interface ShoutoutUser {
  id: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
}

interface Shoutout {
  id: string;
  message: string;
  createdAt: string;
  fromUser: ShoutoutUser;
  toUser: ShoutoutUser;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

export function ShoutoutFeed() {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);

  const fetchShoutouts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/shoutouts?tab=${tab}`);
      if (res.ok) setShoutouts(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    fetchShoutouts();
  }, [fetchShoutouts]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-[#00BCD4]" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Shoutouts</h3>
        </div>
        <button
          onClick={() => setShowSend(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-[#1B3A5C] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#15304d] transition-colors"
        >
          <Send className="h-3 w-3" />
          Envoyer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(["received", "sent"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-[#00BCD4] text-[#00BCD4]"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            {t === "received" ? "Reçus" : "Envoyés"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-center text-sm text-gray-500">Chargement...</p>
        ) : shoutouts.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500">Aucun shoutout</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {shoutouts.map((s) => {
              const other = tab === "received" ? s.fromUser : s.toUser;
              return (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-bold">
                      {other.firstName[0]}
                      {other.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {tab === "received" ? "De" : "A"}{" "}
                        {other.firstName} {other.lastName}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300 italic">
                        &ldquo;{s.message}&rdquo;
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {new Date(s.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Send dialog */}
      {showSend && (
        <SendShoutoutDialog
          onClose={() => setShowSend(false)}
          onSent={() => {
            setShowSend(false);
            setTab("sent");
            fetchShoutouts();
          }}
        />
      )}
    </div>
  );
}

function SendShoutoutDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [toUserId, setToUserId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/hr/employees")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEmployees)
      .catch(() => {});
  }, []);

  const filtered = search
    ? employees.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase())
      )
    : employees;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!toUserId || !message) return;
    setSending(true);
    try {
      const res = await fetch("/api/shoutouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, message }),
      });
      if (res.ok) onSent();
    } catch {
      /* ignore */
    }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Envoyer un shoutout</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSend} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Destinataire *
            </label>
            <input
              type="text"
              placeholder="Rechercher un collegue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm mb-2 focus:border-[#00BCD4] focus:outline-none"
            />
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none"
              size={4}
            >
              <option value="" disabled>
                Choisir...
              </option>
              {filtered.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message * <span className="text-gray-400 font-normal">({message.length}/500)</span>
            </label>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Bravo pour..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm resize-none focus:border-[#00BCD4] focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!toUserId || !message || sending}
              className="rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-medium text-white hover:bg-[#15803d] disabled:opacity-50 transition-colors"
            >
              {sending ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
