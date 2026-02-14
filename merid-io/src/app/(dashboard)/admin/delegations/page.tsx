"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowRightLeft } from "lucide-react";

interface DelegationData {
  id: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  fromUser: { id: string; firstName: string; lastName: string; email: string };
  toUser: { id: string; firstName: string; lastName: string; email: string };
}

export default function AdminDelegationsPage() {
  const [delegations, setDelegations] = useState<DelegationData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/delegations")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDelegations(d))
      .catch(() => setDelegations([]))
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
          <h1 className="text-2xl font-bold text-gray-900">Délégations</h1>
          <p className="mt-1 text-sm text-gray-500">
            {delegations.length} délégation{delegations.length !== 1 ? "s" : ""} enregistrée{delegations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
        >
          <ArrowRightLeft className="h-5 w-5" style={{ color: "#00BCD4" }} />
        </div>
      </div>

      {/* Table */}
      {delegations.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune délégation enregistrée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">De</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Vers</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Période</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Créé par</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {delegations.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {d.fromUser.firstName} {d.fromUser.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{d.fromUser.email}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {d.toUser.firstName} {d.toUser.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{d.toUser.email}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(d.startDate).toLocaleDateString("fr-FR")}
                      {" — "}
                      {new Date(d.endDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: "rgba(27,58,92,0.1)", color: "#1B3A5C" }}
                      >
                        {d.createdBy}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {d.isActive ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Inactive
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
