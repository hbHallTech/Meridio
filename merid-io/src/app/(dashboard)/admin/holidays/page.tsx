"use client";

import { useEffect, useState } from "react";
import { Loader2, CalendarHeart } from "lucide-react";

interface HolidayData {
  id: string;
  date: string;
  name_fr: string;
  name_en: string | null;
  type: string;
  createdAt: string;
  office: { id: string; name: string } | null;
}

const typeConfig: Record<string, { label: string; bg: string; text: string }> = {
  PUBLIC: { label: "Public", bg: "bg-blue-100", text: "text-blue-700" },
  RELIGIOUS: { label: "Religieux", bg: "bg-purple-100", text: "text-purple-700" },
  NATIONAL: { label: "National", bg: "bg-amber-100", text: "text-amber-700" },
};

export default function AdminHolidaysPage() {
  const [holidays, setHolidays] = useState<HolidayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/holidays")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setHolidays(d))
      .catch(() => setHolidays([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jours fériés</h1>
          <p className="mt-1 text-sm text-gray-500">
            {holidays.length} jour{holidays.length !== 1 ? "s" : ""} férié{holidays.length !== 1 ? "s" : ""} enregistré{holidays.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
        >
          <CalendarHeart className="h-5 w-5" style={{ color: "#1B3A5C" }} />
        </div>
      </div>

      {/* Table */}
      {holidays.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun jour férié enregistré.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Date</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Nom FR</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Nom EN</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Type</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {holidays.map((h) => {
                  const d = new Date(h.date);
                  const dayName = d.toLocaleDateString("fr-FR", { weekday: "long" });
                  const dateStr = d.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                  const cfg = typeConfig[h.type] ?? {
                    label: h.type,
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                  };
                  return (
                    <tr key={h.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-6 py-4 text-gray-900">
                        <span className="font-medium capitalize">{dayName}</span>{" "}
                        <span className="text-gray-600">{dateStr}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">{h.name_fr}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {h.name_en ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {h.office?.name ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
