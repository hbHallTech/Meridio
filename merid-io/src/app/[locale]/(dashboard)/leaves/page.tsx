"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  PlusCircle,
  Eye,
  Pencil,
  XCircle,
  Send,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from "lucide-react";

// ─── Types ───

interface LeaveTypeInfo {
  id: string;
  code: string;
  label_fr: string;
  label_en: string;
  color: string;
}

interface LeaveItem {
  id: string;
  startDate: string;
  endDate: string;
  startHalfDay: string;
  endHalfDay: string;
  totalDays: number;
  status: string;
  reason: string | null;
  createdAt: string;
  leaveType: LeaveTypeInfo;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Constants ───

const STATUS_CONFIG: Record<
  string,
  { label_fr: string; label_en: string; bg: string; text: string }
> = {
  DRAFT: { label_fr: "Brouillon", label_en: "Draft", bg: "bg-gray-100", text: "text-gray-700" },
  PENDING_MANAGER: {
    label_fr: "En attente (Manager)",
    label_en: "Pending (Manager)",
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  PENDING_HR: {
    label_fr: "En attente (RH)",
    label_en: "Pending (HR)",
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  APPROVED: { label_fr: "Approuvé", label_en: "Approved", bg: "bg-green-100", text: "text-green-700" },
  REFUSED: { label_fr: "Refusé", label_en: "Refused", bg: "bg-red-100", text: "text-red-700" },
  CANCELLED: { label_fr: "Annulé", label_en: "Cancelled", bg: "bg-gray-100", text: "text-gray-500" },
  RETURNED: { label_fr: "Renvoyé", label_en: "Returned", bg: "bg-blue-100", text: "text-blue-700" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG);

const HALF_DAY_LABELS: Record<string, { fr: string; en: string }> = {
  MORNING: { fr: "matin", en: "AM" },
  AFTERNOON: { fr: "après-midi", en: "PM" },
};

function formatDate(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
  });
}

// ─── Component ───

export default function LeavesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const lang = useLocale();

  const [items, setItems] = useState<LeaveItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeInfo[]>([]);

  // Filters
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const currentPage = parseInt(searchParams.get("page") ?? "1", 10);

  // Fetch leave types for filter dropdown
  useEffect(() => {
    fetch("/api/leaves/form-data")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.leaveTypes) setLeaveTypes(d.leaveTypes);
      })
      .catch(() => {});
  }, []);

  // Fetch leaves
  const fetchLeaves = useCallback(
    async (page: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "10");
      if (statusFilters.length > 0) params.set("status", statusFilters.join(","));
      if (typeFilter) params.set("type", typeFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      try {
        const res = await fetch(`/api/leaves?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
          setPagination(data.pagination);
        }
      } catch {
        addToast({ type: "error", title: lang === "en" ? "Load error" : "Erreur de chargement" });
      } finally {
        setLoading(false);
      }
    },
    [statusFilters, typeFilter, dateFrom, dateTo, addToast, lang]
  );

  useEffect(() => {
    fetchLeaves(currentPage);
  }, [currentPage, fetchLeaves]);

  // Actions
  const handleAction = async (id: string, action: "cancel" | "submit") => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      addToast({
        type: "success",
        title:
          action === "cancel"
            ? lang === "en"
              ? "Request cancelled"
              : "Demande annulée"
            : lang === "en"
              ? "Request submitted"
              : "Demande soumise",
      });
      fetchLeaves(currentPage);
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setActionLoading(null);
    }
  };

  const toggleStatus = (s: string) => {
    setStatusFilters((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const clearFilters = () => {
    setStatusFilters([]);
    setTypeFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    statusFilters.length > 0 || typeFilter !== "" || dateFrom !== "" || dateTo !== "";

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/leaves?${params.toString()}`);
  };

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "My Leave Requests" : "Mes demandes de congé"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? `${pagination.total} request(s) in total`
              : `${pagination.total} demande(s) au total`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              hasActiveFilters
                ? "border-[#1B3A5C] bg-blue-50 text-[#1B3A5C]"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Filter className="h-4 w-4" />
            {lang === "en" ? "Filters" : "Filtres"}
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1B3A5C] text-[10px] font-bold text-white">
                {statusFilters.length + (typeFilter ? 1 : 0) + (dateFrom || dateTo ? 1 : 0)}
              </span>
            )}
          </button>
          <Link
            href="/leaves/new"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            <PlusCircle className="h-4 w-4" />
            {lang === "en" ? "New request" : "Nouvelle demande"}
          </Link>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {lang === "en" ? "Filters" : "Filtres"}
            </h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
              >
                <X className="h-3 w-3" />
                {lang === "en" ? "Clear all" : "Tout effacer"}
              </button>
            )}
          </div>

          {/* Status chips */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500">
              {lang === "en" ? "Status" : "Statut"}
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const active = statusFilters.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                      active
                        ? `${cfg.bg} ${cfg.text} ring-2 ring-offset-1 ring-gray-300`
                        : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {lang === "en" ? cfg.label_en : cfg.label_fr}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Leave type */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                {lang === "en" ? "Leave type" : "Type de congé"}
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              >
                <option value="">{lang === "en" ? "All types" : "Tous les types"}</option>
                {leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lang === "en" ? lt.label_en : lt.label_fr}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                {lang === "en" ? "From" : "Du"}
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                {lang === "en" ? "To" : "Au"}
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-400">
              {hasActiveFilters
                ? lang === "en"
                  ? "No request matches your filters."
                  : "Aucune demande ne correspond à vos filtres."
                : lang === "en"
                  ? "No leave request yet."
                  : "Aucune demande de congé pour le moment."}
            </p>
            {!hasActiveFilters && (
              <Link
                href="/leaves/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#1B3A5C" }}
              >
                <PlusCircle className="h-4 w-4" />
                {lang === "en" ? "Create your first request" : "Créer votre première demande"}
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Type" : "Type"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Dates" : "Dates"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Duration" : "Durée"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Status" : "Statut"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Submitted" : "Soumis le"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Actions" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const status = STATUS_CONFIG[item.status] ?? {
                    label_fr: item.status,
                    label_en: item.status,
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                  };
                  const canEdit = item.status === "DRAFT" || item.status === "RETURNED";
                  const canCancel =
                    item.status === "DRAFT" ||
                    item.status === "PENDING_MANAGER" ||
                    item.status === "PENDING_HR";
                  const canSubmit = item.status === "DRAFT";

                  const startHalf = HALF_DAY_LABELS[item.startHalfDay];
                  const endHalf = HALF_DAY_LABELS[item.endHalfDay];

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.leaveType.color }}
                          />
                          <span className="font-medium text-gray-900">
                            {lang === "en"
                              ? item.leaveType.label_en
                              : item.leaveType.label_fr}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        <span>{formatDateShort(item.startDate, lang)}</span>
                        {startHalf && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({lang === "en" ? startHalf.en : startHalf.fr})
                          </span>
                        )}
                        {item.startDate !== item.endDate && (
                          <>
                            <span className="mx-1 text-gray-400">→</span>
                            <span>{formatDateShort(item.endDate, lang)}</span>
                            {endHalf && (
                              <span className="ml-1 text-xs text-gray-400">
                                ({lang === "en" ? endHalf.en : endHalf.fr})
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {item.totalDays}{" "}
                        {lang === "en"
                          ? item.totalDays > 1
                            ? "days"
                            : "day"
                          : item.totalDays > 1
                            ? "jours"
                            : "jour"}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.bg} ${status.text}`}
                        >
                          {lang === "en" ? status.label_en : status.label_fr}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                        {formatDate(item.createdAt, lang)}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/leaves/${item.id}`}
                            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title={lang === "en" ? "View" : "Voir"}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          {canEdit && (
                            <Link
                              href={`/leaves/new?edit=${item.id}`}
                              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                              title={lang === "en" ? "Edit" : "Modifier"}
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          )}

                          {canSubmit && (
                            <button
                              onClick={() => handleAction(item.id, "submit")}
                              disabled={actionLoading === item.id}
                              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
                              title={lang === "en" ? "Submit" : "Soumettre"}
                            >
                              {actionLoading === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </button>
                          )}

                          {canCancel && (
                            <button
                              onClick={() => handleAction(item.id, "cancel")}
                              disabled={actionLoading === item.id}
                              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              title={lang === "en" ? "Cancel" : "Annuler"}
                            >
                              {actionLoading === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <p className="text-sm text-gray-500">
              {lang === "en"
                ? `Page ${pagination.page} of ${pagination.totalPages}`
                : `Page ${pagination.page} sur ${pagination.totalPages}`}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === pagination.totalPages ||
                    Math.abs(p - pagination.page) <= 1
                )
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "..." ? (
                    <span key={`dots-${idx}`} className="px-2 py-1 text-sm text-gray-400">
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      className={`min-w-[32px] rounded-md px-2 py-1 text-sm font-medium transition-colors ${
                        p === pagination.page
                          ? "bg-[#1B3A5C] text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
