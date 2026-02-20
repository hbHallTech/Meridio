"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, ScrollText, Search, Eye, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";

interface AuditLogData {
  id: string;
  action: string;
  success: boolean;
  entityType: string | null;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface AuditResponse {
  logs: AuditLogData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const actionConfig: Record<string, { label: string; bg: string; text: string }> = {
  // Auth
  LOGIN_SUCCESS: { label: "Connexion", bg: "bg-green-100", text: "text-green-700" },
  LOGIN_FAILURE: { label: "Echec connexion", bg: "bg-red-100", text: "text-red-700" },
  LOGIN_FAILED: { label: "Echec connexion", bg: "bg-red-100", text: "text-red-700" },
  LOGOUT: { label: "Deconnexion", bg: "bg-gray-100", text: "text-gray-700" },
  IDLE_LOGOUT: { label: "Timeout inactivite", bg: "bg-amber-100", text: "text-amber-700" },
  ACCOUNT_BLOCKED: { label: "Compte bloque", bg: "bg-red-100", text: "text-red-700" },
  NEW_DEVICE: { label: "Nouvel appareil", bg: "bg-amber-100", text: "text-amber-700" },
  // Users
  USER_CREATED: { label: "Utilisateur cree", bg: "bg-green-100", text: "text-green-700" },
  USER_UPDATED: { label: "Utilisateur modifie", bg: "bg-blue-100", text: "text-blue-700" },
  USER_DEACTIVATED: { label: "Utilisateur desactive", bg: "bg-red-100", text: "text-red-700" },
  // Leaves
  CREATE_LEAVE: { label: "Conge cree", bg: "bg-green-100", text: "text-green-700" },
  UPDATE_LEAVE: { label: "Conge modifie", bg: "bg-blue-100", text: "text-blue-700" },
  LEAVE_SUBMITTED: { label: "Conge soumis", bg: "bg-amber-100", text: "text-amber-700" },
  LEAVE_CANCELLED: { label: "Conge annule", bg: "bg-gray-100", text: "text-gray-700" },
  // Approvals
  MANAGER_APPROVAL_APPROVED: { label: "Approuve (Manager)", bg: "bg-green-100", text: "text-green-700" },
  MANAGER_APPROVAL_REFUSED: { label: "Refuse (Manager)", bg: "bg-red-100", text: "text-red-700" },
  MANAGER_APPROVAL_RETURNED: { label: "Retourne (Manager)", bg: "bg-purple-100", text: "text-purple-700" },
  HR_APPROVAL_APPROVED: { label: "Approuve (HR)", bg: "bg-green-100", text: "text-green-700" },
  HR_APPROVAL_REFUSED: { label: "Refuse (HR)", bg: "bg-red-100", text: "text-red-700" },
  HR_APPROVAL_RETURNED: { label: "Retourne (HR)", bg: "bg-purple-100", text: "text-purple-700" },
  // Files
  UPLOAD_ATTACHMENT: { label: "Upload fichier", bg: "bg-blue-100", text: "text-blue-700" },
  DOWNLOAD_ATTACHMENT: { label: "Download fichier", bg: "bg-blue-100", text: "text-blue-700" },
  // Security
  RBAC_DENIED: { label: "Acces refuse", bg: "bg-red-100", text: "text-red-700" },
  PASSWORD_CHANGED: { label: "Mot de passe change", bg: "bg-amber-100", text: "text-amber-700" },
  PASSWORD_RESET: { label: "Mot de passe reinit.", bg: "bg-amber-100", text: "text-amber-700" },
  PASSWORD_AUTO_RESET: { label: "Mot de passe expire", bg: "bg-amber-100", text: "text-amber-700" },
  // Admin
  TEAM_CREATED: { label: "Equipe creee", bg: "bg-green-100", text: "text-green-700" },
  TEAM_UPDATED: { label: "Equipe modifiee", bg: "bg-blue-100", text: "text-blue-700" },
  TEAM_DELETED: { label: "Equipe supprimee", bg: "bg-red-100", text: "text-red-700" },
  DELEGATION_CREATED: { label: "Delegation creee", bg: "bg-green-100", text: "text-green-700" },
  DELEGATION_REVOKED: { label: "Delegation revoquee", bg: "bg-red-100", text: "text-red-700" },
  COMPANY_UPDATED: { label: "Entreprise modifiee", bg: "bg-blue-100", text: "text-blue-700" },
  OFFICE_CREATED: { label: "Bureau cree", bg: "bg-green-100", text: "text-green-700" },
  OFFICE_UPDATED: { label: "Bureau modifie", bg: "bg-blue-100", text: "text-blue-700" },
  WORKFLOW_DUPLICATED: { label: "Workflow duplique", bg: "bg-blue-100", text: "text-blue-700" },
  EXPORT_AUDIT: { label: "Export audit", bg: "bg-blue-100", text: "text-blue-700" },
};

const knownActions = Object.keys(actionConfig);

export default function AdminAuditPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter state
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [page, setPage] = useState(1);

  // Detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogData | null>(null);

  const buildParams = useCallback(
    (p: number) => {
      const params = new URLSearchParams();
      if (filterStartDate) params.set("startDate", filterStartDate);
      if (filterEndDate) params.set("endDate", filterEndDate);
      if (filterAction) params.set("action", filterAction);
      params.set("page", String(p));
      params.set("pageSize", "50");
      return params;
    },
    [filterStartDate, filterEndDate, filterAction]
  );

  const fetchLogs = useCallback(
    async (p: number) => {
      try {
        const params = buildParams(p);
        const res = await fetch(`/api/admin/audit?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: AuditResponse = await res.json();
        setData(json);
        setPage(json.page);
      } catch (e) {
        addToast({
          type: "error",
          title: "Erreur de chargement",
          message: e instanceof Error ? e.message : "Erreur inconnue",
        });
      }
    },
    [addToast, buildParams]
  );

  useEffect(() => {
    fetchLogs(1).finally(() => setLoading(false));
  }, [fetchLogs]);

  const handleApplyFilters = async () => {
    setFiltering(true);
    await fetchLogs(1);
    setFiltering(false);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = buildParams(1);
      params.delete("page");
      params.delete("pageSize");
      const res = await fetch(`/api/admin/audit?${params.toString()}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: "success", title: "Export CSV", message: "Fichier telecharge" });
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur export",
        message: e instanceof Error ? e.message : "Erreur inconnue",
      });
    } finally {
      setExporting(false);
    }
  };

  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Journal d&apos;audit</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} entree{total !== 1 ? "s" : ""} au total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exporter CSV
          </button>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
          >
            <ScrollText className="h-5 w-5" style={{ color: "#1B3A5C" }} />
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[160px]">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Date debut</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Date fin</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Action</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
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
            {filtering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Appliquer
          </button>
        </div>
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          Aucune entree d&apos;audit trouvee.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Date/Heure</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Utilisateur</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Action</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Entite</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {logs.map((log) => {
                  const cfg = actionConfig[log.action] ?? {
                    label: log.action,
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                  };
                  const entityDisplay = log.entityType
                    ? `${log.entityType}:${(log.entityId ?? "").length > 8 ? (log.entityId ?? "").slice(0, 8) + "..." : log.entityId ?? ""}`
                    : "\u2014";
                  const hasDetails = log.oldValue !== null || log.newValue !== null;

                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600 dark:text-gray-400">
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
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {log.user.firstName} {log.user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{log.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">{"\u2014"}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                        {!log.success && (
                          <span className="ml-1.5 inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            ECHEC
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="font-mono text-xs text-gray-500">{entityDisplay}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {hasDetails ? (
                          <button
                            onClick={() => {
                              setSelectedLog(log);
                              setDetailDialogOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 dark:border-gray-700">
              <p className="text-xs text-gray-500">
                Page {page}/{totalPages} ({total} resultats)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchLogs(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => fetchLogs(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg p-1.5 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedLog(null);
        }}
        title="Details de l'entree d'audit"
        description={
          selectedLog
            ? `${actionConfig[selectedLog.action]?.label ?? selectedLog.action} - ${new Date(selectedLog.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
            : undefined
        }
        maxWidth="lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Utilisateur</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">
                  {selectedLog.user ? `${selectedLog.user.firstName} ${selectedLog.user.lastName}` : "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Entite</p>
                <p className="mt-0.5 font-mono text-sm text-gray-900">
                  {selectedLog.entityType ?? "\u2014"}:{selectedLog.entityId ?? "\u2014"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Adresse IP</p>
                <p className="mt-0.5 text-sm text-gray-900">{selectedLog.ipAddress ?? "\u2014"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Succes</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">{selectedLog.success ? "Oui" : "Non"}</p>
              </div>
            </div>

            {selectedLog.oldValue !== null && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">Ancienne valeur</p>
                <pre className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  {JSON.stringify(selectedLog.oldValue, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.newValue !== null && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">Nouvelle valeur</p>
                <pre className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  {JSON.stringify(selectedLog.newValue, null, 2)}
                </pre>
              </div>
            )}

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
