"use client";

import { useEffect, useState } from "react";
import { Loader2, Tag } from "lucide-react";

interface LeaveTypeData {
  id: string;
  code: string;
  label_fr: string;
  label_en: string;
  requiresAttachment: boolean;
  deductsFromBalance: boolean;
  isActive: boolean;
  color: string;
  createdAt: string;
  office: { id: string; name: string } | null;
}

export default function AdminLeaveTypesPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/leave-types")
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`HTTP ${r.status}: ${text}`);
        }
        return r.json();
      })
      .then((d) => setLeaveTypes(d))
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
          <h1 className="text-2xl font-bold text-gray-900">Types de congé</h1>
          <p className="mt-1 text-sm text-gray-500">
            {leaveTypes.length} type{leaveTypes.length !== 1 ? "s" : ""} configuré{leaveTypes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
        >
          <Tag className="h-5 w-5" style={{ color: "#00BCD4" }} />
        </div>
      </div>

      {/* Table */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700 shadow-sm">
          <p className="font-semibold">Erreur de chargement</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {!error && leaveTypes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun type de congé configuré.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Code</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Libellé FR</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Libellé EN</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Déduit du solde</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Justificatif</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaveTypes.map((lt) => (
                  <tr key={lt.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: lt.color }}
                        />
                        <span className="font-medium text-gray-900">{lt.code}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{lt.label_fr}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{lt.label_en}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {lt.office?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {lt.deductsFromBalance ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          Oui
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                          Non
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {lt.requiresAttachment ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          Requis
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                          Non
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {lt.isActive ? (
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
