"use client";

import { useEffect, useState } from "react";
import { Loader2, UsersRound } from "lucide-react";

interface TeamData {
  id: string;
  name: string;
  createdAt: string;
  manager: { id: string; firstName: string; lastName: string; email: string } | null;
  office: { id: string; name: string } | null;
  _count: { members: number };
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/teams")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTeams(d))
      .catch(() => setTeams([]))
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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des équipes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {teams.length} équipe{teams.length !== 1 ? "s" : ""} enregistrée{teams.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
        >
          <UsersRound className="h-5 w-5" style={{ color: "#00BCD4" }} />
        </div>
      </div>

      {/* Table */}
      {teams.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune équipe trouvée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Nom</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Manager</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Membres</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Créé le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teams.map((team) => (
                  <tr key={team.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {team.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {team.manager
                        ? `${team.manager.firstName} ${team.manager.lastName}`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {team.office?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: "rgba(27,58,92,0.1)", color: "#1B3A5C" }}
                      >
                        {team._count.members}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(team.createdAt).toLocaleDateString("fr-FR")}
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
