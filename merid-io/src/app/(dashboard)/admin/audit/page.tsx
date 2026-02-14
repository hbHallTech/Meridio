"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, ScrollText, Search, Eye } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";

interface AuditLogData {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
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

const knownActions = Object.keys(actionConfig);

export default function AdminAuditPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);

  // Filter state
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterAction, setFilterAction] = useState("");

  // Detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogData | null>(null);

  const fetchLogs = useCallback(async (startDate?: string, endDate?: string, action?: string) => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (action) params.set("action", action);

      const url = `/api/admin/audit${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur de chargement",
        message: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  useEffect(() => {
    fetchLogs().finally(() => setLoading(false));
  }, [fetchLogs]);

  const handleApplyFilters = async () => {
    setFiltering(true);
    await fetchLogs(filterStartDate, filterEndDate, filterAction);
    setFiltering(false);
  };

  const openDetailDialog = (log: AuditLogData) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

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
            {logs.length} entrée{logs.length !== 1 ? "s" : ""} (max 200)
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
        >
          <ScrollText className="h-5 w-5" style={{ color: "#1B3A5C" }} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[160px]">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Date début</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Date fin</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Action</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            >
              <option value="">Toutes les actions</option>
              {knownActions.map((a) => (
                <option key={a} value={a}>
                  {actionConfig[a].label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleApplyFilters}
            disabled={filtering}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {filtering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Appliquer
          </button>
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
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Date/Heure</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Utilisateur</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Action</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Entité</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Détails</th>
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
                  const hasDetails = log.oldValue !== null || log.newValue !== null;

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
                          <span className="text-gray-400">{"\u2014"}</span>
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
                      <td className="whitespace-nowrap px-6 py-4">
                        {hasDetails ? (
                          <button
                            onClick={() => openDetailDialog(log)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100"
                            style={{ color: "#1B3A5C" }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Voir
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">{"\u2014"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedLog(null);
        }}
        title="Détails de l'entrée d'audit"
        description={selectedLog ? `${actionConfig[selectedLog.action]?.label ?? selectedLog.action} - ${new Date(selectedLog.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : undefined}
        maxWidth="lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            {/* Meta info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Utilisateur</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">
                  {selectedLog.user
                    ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}`
                    : "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Entité</p>
                <p className="mt-0.5 font-mono text-sm text-gray-900">
                  {selectedLog.entityType}:{selectedLog.entityId}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Adresse IP</p>
                <p className="mt-0.5 text-sm text-gray-900">
                  {selectedLog.ipAddress ?? "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Action</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">
                  {actionConfig[selectedLog.action]?.label ?? selectedLog.action}
                </p>
              </div>
            </div>

            {/* Old value */}
            {selectedLog.oldValue !== null && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">Ancienne valeur</p>
                <pre className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  {JSON.stringify(selectedLog.oldValue, null, 2)}
                </pre>
              </div>
            )}

            {/* New value */}
            {selectedLog.newValue !== null && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">Nouvelle valeur</p>
                <pre className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  {JSON.stringify(selectedLog.newValue, null, 2)}
                </pre>
              </div>
            )}

            {/* Close button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setDetailDialogOpen(false);
                  setSelectedLog(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
