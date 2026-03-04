"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ScrollText,
  Filter,
} from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  success: boolean;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  companyName: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export default function SuperAdminAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "30");
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);

      const res = await fetch(`/api/super-admin/audit-logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchLogs, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchLogs, search]);

  const actionColor = (action: string) => {
    if (action.includes("LOGIN")) return "bg-blue-50 text-blue-700";
    if (action.includes("APPROVED") || action.includes("PROVISION"))
      return "bg-emerald-50 text-emerald-700";
    if (action.includes("REJECTED") || action.includes("DENIED") || action.includes("LOCKED"))
      return "bg-red-50 text-red-700";
    if (action.includes("CREATED") || action.includes("UPDATED"))
      return "bg-purple-50 text-purple-700";
    return "bg-gray-50 text-gray-700";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Journal d&apos;audit global
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {total} entrée(s) sur tous les tenants
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher par action, email, entité..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 py-2.5 pl-10 pr-8 text-sm focus:border-[#1B3A5C] focus:outline-none appearance-none bg-white"
          >
            <option value="">Toutes les actions</option>
            <option value="LOGIN_SUCCESS">Connexion</option>
            <option value="TENANT_PROVISIONED">Tenant créé</option>
            <option value="SIGNUP_REQUEST_REJECTED">Demande rejetée</option>
            <option value="IMPERSONATE_USER">Impersonation</option>
            <option value="USER_CREATED">Utilisateur créé</option>
            <option value="PASSWORD_CHANGED">Mot de passe changé</option>
            <option value="RBAC_DENIED">Accès refusé</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <ScrollText className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Aucune entrée trouvée</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Action</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Utilisateur</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Tenant</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Entité</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                      {new Date(log.createdAt).toLocaleString("fr-CH", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${actionColor(log.action)}`}
                      >
                        {log.action}
                      </span>
                      {!log.success && (
                        <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          FAIL
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <div>
                          <p className="font-medium text-gray-900">
                            {log.user.firstName} {log.user.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Système</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.companyName || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {log.entityType ? (
                        <span className="text-xs">
                          {log.entityType}
                          {log.entityId && (
                            <span className="text-gray-400 ml-1">
                              {log.entityId.slice(0, 8)}...
                            </span>
                          )}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      {log.ipAddress || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <p className="text-sm text-gray-500">
                Page {page} sur {totalPages} ({total} entrées)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
