"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import { Loader2, BarChart3, Download, Filter, X } from "lucide-react";

interface ReportItem {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  reason: string | null;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    office: { name: string } | null;
    team: { name: string } | null;
  };
  leaveTypeConfig: {
    code: string;
    label_fr: string;
    label_en: string;
    color: string;
  };
}

interface FilterOpt { id: string; name?: string; label_fr?: string; label_en?: string; }

interface ReportData {
  items: ReportItem[];
  filters: { offices: FilterOpt[]; teams: FilterOpt[]; leaveTypes: FilterOpt[] };
  summary: { totalRequests: number; totalDays: number; approvedCount: number };
}

const STATUS_CONFIG: Record<string, { fr: string; en: string; bg: string; text: string }> = {
  DRAFT: { fr: "Brouillon", en: "Draft", bg: "bg-gray-100", text: "text-gray-700" },
  PENDING_MANAGER: { fr: "En attente Manager", en: "Pending Manager", bg: "bg-amber-100", text: "text-amber-700" },
  PENDING_HR: { fr: "En attente RH", en: "Pending HR", bg: "bg-amber-100", text: "text-amber-700" },
  APPROVED: { fr: "Approuve", en: "Approved", bg: "bg-green-100", text: "text-green-700" },
  REFUSED: { fr: "Refuse", en: "Refused", bg: "bg-red-100", text: "text-red-700" },
  CANCELLED: { fr: "Annule", en: "Cancelled", bg: "bg-gray-100", text: "text-gray-500" },
  RETURNED: { fr: "Renvoye", en: "Returned", bg: "bg-blue-100", text: "text-blue-700" },
};

function formatDate(d: string, lang: string) {
  return new Date(d).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function HRReportsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const [officeId, setOfficeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [csvSeparator, setCsvSeparator] = useState(",");

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (officeId) p.set("officeId", officeId);
    if (teamId) p.set("teamId", teamId);
    if (typeId) p.set("typeId", typeId);
    if (status) p.set("status", status);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    try {
      const res = await fetch(`/api/hr/reports?${p.toString()}`);
      if (res.ok) setData(await res.json());
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Load error" : "Erreur de chargement" });
    } finally {
      setLoading(false);
    }
  }, [officeId, teamId, typeId, status, from, to, addToast, lang]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  useEffect(() => {
    fetch("/api/settings/csv").then((r) => r.ok ? r.json() : null).then((d) => { if (d?.separator) setCsvSeparator(d.separator); }).catch(() => {});
  }, []);

  const clearFilters = () => { setOfficeId(""); setTeamId(""); setTypeId(""); setStatus(""); setFrom(""); setTo(""); };

  const hasFilters = officeId || teamId || typeId || status || from || to;

  const handleExportCSV = () => {
    if (!data) return;
    const header = ["Employee", "Email", "Office", "Team", "Type", "Start", "End", "Days", "Status"];
    const rows = data.items.map((i) => [
      `${i.user.firstName} ${i.user.lastName}`,
      i.user.email,
      i.user.office?.name ?? "",
      i.user.team?.name ?? "",
      lang === "en" ? i.leaveTypeConfig.label_en : i.leaveTypeConfig.label_fr,
      i.startDate.slice(0, 10),
      i.endDate.slice(0, 10),
      String(i.totalDays),
      i.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(csvSeparator)).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-rh-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === "en" ? "HR Reports" : "Rapports RH"}</h1>
          {data && (
            <p className="mt-1 text-sm text-gray-500">
              {data.summary.totalRequests} {lang === "en" ? "requests" : "demandes"} · {data.summary.totalDays}j · {data.summary.approvedCount} {lang === "en" ? "approved" : "approuvees"}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${hasFilters ? "border-[#1B3A5C] bg-blue-50 text-[#1B3A5C]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            <Filter className="h-4 w-4" />
            {lang === "en" ? "Filters" : "Filtres"}
          </button>
          <button onClick={handleExportCSV} disabled={!data || data.items.length === 0} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#1B3A5C" }}>
            <Download className="h-4 w-4" />
            CSV
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(0,188,212,0.1)" }}>
            <BarChart3 className="h-5 w-5" style={{ color: "#00BCD4" }} />
          </div>
        </div>
      </div>

      {showFilters && data && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">{lang === "en" ? "Filters" : "Filtres"}</h3>
            {hasFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline">
                <X className="h-3 w-3" />{lang === "en" ? "Clear all" : "Tout effacer"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <select value={officeId} onChange={(e) => setOfficeId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none">
              <option value="">{lang === "en" ? "All offices" : "Tous bureaux"}</option>
              {data.filters.offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none">
              <option value="">{lang === "en" ? "All teams" : "Toutes equipes"}</option>
              {data.filters.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none">
              <option value="">{lang === "en" ? "All types" : "Tous types"}</option>
              {data.filters.leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lang === "en" ? lt.label_en : lt.label_fr}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none">
              <option value="">{lang === "en" ? "All statuses" : "Tous statuts"}</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang === "en" ? v.en : v.fr}</option>)}
            </select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none" />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">
            {lang === "en" ? "No results." : "Aucun resultat."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Employee" : "Employe"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Office" : "Bureau"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Type" : "Type"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Dates" : "Dates"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Days" : "Jours"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Status" : "Statut"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => {
                  const st = STATUS_CONFIG[item.status] ?? { fr: item.status, en: item.status, bg: "bg-gray-100", text: "text-gray-700" };
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="font-medium text-gray-900">{item.user.firstName} {item.user.lastName}</p>
                        <p className="text-xs text-gray-400">{item.user.email}</p>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">{item.user.office?.name ?? "—"}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.leaveTypeConfig.color }} />
                          <span>{lang === "en" ? item.leaveTypeConfig.label_en : item.leaveTypeConfig.label_fr}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {formatDate(item.startDate, lang)} → {formatDate(item.endDate, lang)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">{item.totalDays}j</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${st.bg} ${st.text}`}>
                          {lang === "en" ? st.en : st.fr}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
