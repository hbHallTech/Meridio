"use client";

import { useEffect, useState } from "react";
import { Loader2, ScrollText } from "lucide-react";

interface AuditLogData {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

const actionConfig: Record<string, { label: string; bg: string; text: string }> = {
  USER_CREATED: { label: "Utilisateur créé", bg: "bg-green-100", text: "text-green-700" },
  USER_UPDATED: { label: "Utilisateur modifié", bg: "bg-blue-100", text: "text-blue-700" },
  USER_DEACTIVATED: { label: "Utilisateur désactivé", bg: "bg-red-100", text: "text-red-700" },
  LEAVE_SUBMITTED: { label: "Congé soumis", bg: "bg-amber-100", text: "text-amber-700" },
  LEAVE_APPROVED: { label: "Congé approuvé", bg: "bg-green-100", text: "text-green-700" },
  LEAVE_REFUSED: { label: "Congé refusé", bg: "bg-red-100", text: "text-red-700" },
  LEAVE_CANCELLED: { label: "Congé annulé", bg: "bg-gray-100", text: "text-gray-700" },
  LEAVE_RETURNED: { label: "Congé retourné", bg: "bg-purple-100", text: "text-purple-700" },
  OFFICE_CREATED: { label: "Bureau créé", bg: "bg-green-100", text: "text-green-700" },
  OFFICE_UPDATED: { label: "Bureau modifié", bg: "bg-blue-100", text: "text-blue-700" },
  TEAM_CREATED: { label: "Équipe créée", bg: "bg-green-100", text: "text-green-700" },
  TEAM_UPDATED: { label: "Équipe modifiée", bg: "bg-blue-100", text: "text-blue-700" },
  DELEGATION_CREATED: { label: "Délégation créée", bg: "bg-green-100", text: "text-green-700" },
  DELEGATION_REVOKED: { label: "Délégation révoquée", bg: "bg-red-100", text: "text-red-700" },
  PASSWORD_CHANGED: { label: "Mot de passe changé", bg: "bg-amber-100", text: "text-amber-700" },
  LOGIN_SUCCESS: { label: "Connexion réussie", bg: "bg-green-100", text: "text-green-700" },
  LOGIN_FAILED: { label: "Connexion échouée", bg: "bg-red-100", text: "text-red-700" },
};

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setLogs(d))
      .catch(() => setLogs([]))
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
          <h1 className="text-2xl font-bold text-gray-900">Journal d&apos;audit</h1>
          <p className="mt-1 text-sm text-gray-500">
            {logs.length} entrée{logs.length !== 1 ? "s" : ""} (100 dernières)
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
        >
          <ScrollText className="h-5 w-5" style={{ color: "#1B3A5C" }} />
        </div>
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune entrée d&apos;audit trouvée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Date</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Utilisateur</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Action</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Entité</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const cfg = actionConfig[log.action] ?? {
                    label: log.action,
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                  };
                  const entityDisplay = `${log.entityType}:${log.entityId.length > 8 ? log.entityId.slice(0, 8) + "..." : log.entityId}`;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {log.user ? (
                          <div>
                            <p className="font-medium text-gray-900">
                              {log.user.firstName} {log.user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{log.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-mono text-xs text-gray-500">{entityDisplay}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {log.ipAddress ?? "—"}
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
