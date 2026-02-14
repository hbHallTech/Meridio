"use client";

import { useEffect, useState } from "react";
import { Loader2, CalendarOff } from "lucide-react";

interface ClosureData {
  id: string;
  startDate: string;
  endDate: string;
  reason_fr: string;
  reason_en: string | null;
  year: number;
  createdAt: string;
  office: { id: string; name: string } | null;
}

export default function AdminClosuresPage() {
  const [closures, setClosures] = useState<ClosureData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/closures")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClosures(d))
      .catch(() => setClosures([]))
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
          <h1 className="text-2xl font-bold text-gray-900">Fermetures d&apos;entreprise</h1>
          <p className="mt-1 text-sm text-gray-500">
            {closures.length} fermeture{closures.length !== 1 ? "s" : ""} enregistrée{closures.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
        >
          <CalendarOff className="h-5 w-5" style={{ color: "#1B3A5C" }} />
        </div>
      </div>

      {/* Table */}
      {closures.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune fermeture enregistrée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Période</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Motif FR</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Motif EN</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Année</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {closures.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {new Date(c.startDate).toLocaleDateString("fr-FR")}
                      {" — "}
                      {new Date(c.endDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{c.reason_fr}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {c.reason_en ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: "rgba(0,188,212,0.1)", color: "#00BCD4" }}
                      >
                        {c.year}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {c.office?.name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
