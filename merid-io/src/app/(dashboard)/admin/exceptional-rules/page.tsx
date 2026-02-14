"use client";

import { useEffect, useState } from "react";
import { Loader2, Scale } from "lucide-react";

interface ExceptionalRuleData {
  id: string;
  reason_fr: string;
  reason_en: string;
  maxDays: number;
  isActive: boolean;
  createdAt: string;
  office: { id: string; name: string } | null;
}

export default function AdminExceptionalRulesPage() {
  const [rules, setRules] = useState<ExceptionalRuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/exceptional-rules")
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`HTTP ${r.status}: ${text}`);
        }
        return r.json();
      })
      .then((d) => setRules(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur inconnue"))
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
          <h1 className="text-2xl font-bold text-gray-900">Règles exceptionnelles</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rules.length} règle{rules.length !== 1 ? "s" : ""} configurée{rules.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
        >
          <Scale className="h-5 w-5" style={{ color: "#00BCD4" }} />
        </div>
      </div>

      {/* Table */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
          <p className="font-semibold">Erreur de chargement</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {!error && rules.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune règle exceptionnelle configurée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Motif FR</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Motif EN</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Jours max</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {rule.reason_fr}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{rule.reason_en}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: "rgba(27,58,92,0.1)", color: "#1B3A5C" }}
                      >
                        {rule.maxDays}j
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {rule.office?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {rule.isActive ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Inactif
                        </span>
                      )}
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
