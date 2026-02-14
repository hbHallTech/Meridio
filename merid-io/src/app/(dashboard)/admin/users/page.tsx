"use client";

import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  isActive: boolean;
  hireDate: string;
  language: string;
  createdAt: string;
  office: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
}

const roleConfig: Record<string, { bg: string; text: string }> = {
  ADMIN: { bg: "bg-purple-100", text: "text-purple-700" },
  HR: { bg: "bg-blue-100", text: "text-blue-700" },
  MANAGER: { bg: "bg-amber-100", text: "text-amber-700" },
  EMPLOYEE: { bg: "bg-gray-100", text: "text-gray-700" },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setUsers(d))
      .catch(() => setUsers([]))
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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {users.length} utilisateur{users.length !== 1 ? "s" : ""} enregistré{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
        >
          <Users className="h-5 w-5" style={{ color: "#1B3A5C" }} />
        </div>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun utilisateur trouvé.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Nom</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Email</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Rôles</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Équipe</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Statut</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Embauche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => {
                          const cfg = roleConfig[role] ?? { bg: "bg-gray-100", text: "text-gray-700" };
                          return (
                            <span
                              key={role}
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
                            >
                              {role}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {user.office?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {user.team?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {user.isActive ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(user.hireDate).toLocaleDateString("fr-FR")}
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
