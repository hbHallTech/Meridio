"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  BarChart3,
  Download,
  Filter,
  X,
  Clock,
  CalendarDays,
  Users,
  TrendingUp,
  UserCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// ─── Dashboard types ───

interface DashboardKPIs {
  pendingApprovals: number;
  activeAbsences: number;
  teamMembers: number;
  approvedDaysThisYear: number;
  absenteeismRate: number;
}

interface MonthData {
  month: number;
  label_fr: string;
  label_en: string;
  days: number;
}

interface TypeData {
  name_fr: string;
  name_en: string;
  color: string;
  value: number;
}

interface BalanceData {
  balanceType: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
}

interface MemberInfo {
  id: string;
  firstName: string;
  lastName: string;
}

interface DashboardData {
  kpis: DashboardKPIs;
  byMonth: MonthData[];
  byType: TypeData[];
  balances: BalanceData[];
  members: MemberInfo[];
}

// ─── Report types ───

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
    team: { name: string } | null;
  };
  leaveTypeConfig: {
    code: string;
    label_fr: string;
    label_en: string;
    color: string;
  };
}

interface FilterOpt {
  id: string;
  name?: string;
  label_fr?: string;
  label_en?: string;
}

interface ReportData {
  items: ReportItem[];
  filters: { teams: FilterOpt[]; leaveTypes: FilterOpt[] };
  summary: { totalRequests: number; totalDays: number; approvedCount: number };
}

const STATUS_CONFIG: Record<
  string,
  { fr: string; en: string; bg: string; text: string }
> = {
  DRAFT: { fr: "Brouillon", en: "Draft", bg: "bg-gray-100", text: "text-gray-700" },
  PENDING_MANAGER: { fr: "En attente Manager", en: "Pending Manager", bg: "bg-amber-100", text: "text-amber-700" },
  PENDING_HR: { fr: "En attente RH", en: "Pending HR", bg: "bg-amber-100", text: "text-amber-700" },
  APPROVED: { fr: "Approuve", en: "Approved", bg: "bg-green-100", text: "text-green-700" },
  REFUSED: { fr: "Refuse", en: "Refused", bg: "bg-red-100", text: "text-red-700" },
  CANCELLED: { fr: "Annule", en: "Cancelled", bg: "bg-gray-100", text: "text-gray-500" },
  RETURNED: { fr: "Renvoye", en: "Returned", bg: "bg-blue-100", text: "text-blue-700" },
};

const BALANCE_LABELS: Record<string, { fr: string; en: string }> = {
  ANNUAL: { fr: "Congés annuels", en: "Annual leave" },
  OFFERED: { fr: "Jours offerts", en: "Offered days" },
};

function formatDate(d: string, lang: string) {
  return new Date(d).toLocaleDateString(
    lang === "en" ? "en-GB" : "fr-FR",
    { day: "numeric", month: "short", year: "numeric" }
  );
}

export default function ManagerReportsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  // ─── Dashboard state ───
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState("");

  // ─── Report state ───
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [csvSeparator, setCsvSeparator] = useState(",");

  // ─── Fetch dashboard KPIs ───
  const fetchDashboard = useCallback(
    async (userId?: string) => {
      setDashLoading(true);
      const p = new URLSearchParams();
      if (userId) p.set("userId", userId);
      try {
        const res = await fetch(`/api/manager/dashboard?${p.toString()}`);
        if (res.ok) {
          setDashboard(await res.json());
        }
      } catch {
        addToast({
          type: "error",
          title: lang === "en" ? "Dashboard load error" : "Erreur chargement KPI",
        });
      } finally {
        setDashLoading(false);
      }
    },
    [addToast, lang]
  );

  // ─── Fetch report table ───
  const fetchReport = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (teamId) p.set("teamId", teamId);
    if (typeId) p.set("typeId", typeId);
    if (status) p.set("status", status);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    try {
      const res = await fetch(`/api/manager/reports?${p.toString()}`);
      if (res.ok) setData(await res.json());
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Load error" : "Erreur de chargement",
      });
    } finally {
      setLoading(false);
    }
  }, [teamId, typeId, status, from, to, addToast, lang]);

  useEffect(() => {
    fetchDashboard(selectedMember || undefined);
  }, [fetchDashboard, selectedMember]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    fetch("/api/settings/csv").then((r) => r.ok ? r.json() : null).then((d) => { if (d?.separator) setCsvSeparator(d.separator); }).catch(() => {});
  }, []);

  const clearFilters = () => {
    setTeamId("");
    setTypeId("");
    setStatus("");
    setFrom("");
    setTo("");
  };
  const hasFilters = teamId || typeId || status || from || to;

  const handleExportCSV = () => {
    if (!data) return;
    const header = [
      "Employee",
      "Email",
      "Team",
      "Type",
      "Start",
      "End",
      "Days",
      "Status",
    ];
    const rows = data.items.map((i) => [
      `${i.user.firstName} ${i.user.lastName}`,
      i.user.email,
      i.user.team?.name ?? "",
      lang === "en" ? i.leaveTypeConfig.label_en : i.leaveTypeConfig.label_fr,
      i.startDate.slice(0, 10),
      i.endDate.slice(0, 10),
      String(i.totalDays),
      i.status,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(csvSeparator))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-manager-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedMemberName = dashboard?.members.find(
    (m) => m.id === selectedMember
  );

  return (
    <div className="space-y-6">
      {/* ═══════════ DASHBOARD HEADER ═══════════ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Team Reports" : "Rapports Équipe"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {selectedMemberName
              ? `${selectedMemberName.firstName} ${selectedMemberName.lastName} — ${new Date().getFullYear()}`
              : lang === "en"
                ? `Team overview for ${new Date().getFullYear()}`
                : `Vue d'ensemble de l'équipe pour ${new Date().getFullYear()}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Member selector */}
          {dashboard && dashboard.members.length > 0 && (
            <div className="flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-gray-400" />
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              >
                <option value="">
                  {lang === "en" ? "Entire team" : "Toute l'équipe"}
                </option>
                {dashboard.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
          >
            <BarChart3 className="h-5 w-5" style={{ color: "#00BCD4" }} />
          </div>
        </div>
      </div>

      {/* ═══════════ KPI CARDS ═══════════ */}
      {dashLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : dashboard ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {/* Pending approvals */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {lang === "en" ? "Pending" : "En attente"}
                </p>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-gray-900">
                {dashboard.kpis.pendingApprovals}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {lang === "en" ? "requests to review" : "demandes à traiter"}
              </p>
            </div>

            {/* Active absences */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {lang === "en" ? "Active absences" : "Absences en cours"}
                </p>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
                >
                  <CalendarDays
                    className="h-5 w-5"
                    style={{ color: "#1B3A5C" }}
                  />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-gray-900">
                {dashboard.kpis.activeAbsences}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {lang === "en"
                  ? "on leave today"
                  : "absent(s) aujourd'hui"}
              </p>
            </div>

            {/* Team members */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {selectedMember
                    ? lang === "en"
                      ? "Employee"
                      : "Employé"
                    : lang === "en"
                      ? "Team members"
                      : "Membres équipe"}
                </p>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
                >
                  <Users className="h-5 w-5" style={{ color: "#00BCD4" }} />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-gray-900">
                {dashboard.kpis.teamMembers}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {selectedMember
                  ? selectedMemberName
                    ? `${selectedMemberName.firstName} ${selectedMemberName.lastName}`
                    : ""
                  : lang === "en"
                    ? "active members"
                    : "membres actifs"}
              </p>
            </div>

            {/* Days taken */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {lang === "en" ? "Days taken" : "Jours pris"}
                </p>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                  <CalendarDays className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-gray-900">
                {dashboard.kpis.approvedDaysThisYear}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {lang === "en" ? "approved this year" : "approuvés cette année"}
              </p>
            </div>

            {/* Absenteeism rate */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {lang === "en" ? "Absenteeism" : "Absentéisme"}
                </p>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-gray-900">
                {dashboard.kpis.absenteeismRate}%
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {lang === "en" ? "rate" : "taux"}
              </p>
            </div>
          </div>

          {/* ═══════════ CHARTS ═══════════ */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Absences by month (line chart) */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                {lang === "en" ? "Absences by month" : "Absences par mois"}
              </h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey={lang === "en" ? "label_en" : "label_fr"}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) => [
                        `${value}j`,
                        lang === "en" ? "Days" : "Jours",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="days"
                      stroke="#1B3A5C"
                      strokeWidth={2}
                      dot={{ fill: "#1B3A5C" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Leave distribution by type (pie chart) */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                {lang === "en"
                  ? "Leave distribution by type"
                  : "Répartition par type de congé"}
              </h2>
              {dashboard.byType.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-gray-400">
                  {lang === "en" ? "No data" : "Aucune donnée"}
                </div>
              ) : (
                <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
                  <div className="h-64 w-64 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboard.byType}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {dashboard.byType.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`${value}j`, ""]}
                          labelFormatter={(_, payload) => {
                            if (payload && payload.length > 0) {
                              const item = payload[0].payload as Record<
                                string,
                                string
                              >;
                              return lang === "en" ? item.name_en : item.name_fr;
                            }
                            return "";
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-2">
                    {dashboard.byType.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm text-gray-700">
                          {lang === "en" ? entry.name_en : entry.name_fr}
                        </span>
                        <span className="ml-auto text-sm font-semibold text-gray-900">
                          {entry.value}j
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════ BALANCES (individual member only) ═══════════ */}
          {selectedMember && dashboard.balances.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                {lang === "en" ? "Leave balances" : "Soldes de congés"}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dashboard.balances.map((b) => {
                  const remaining = b.totalDays - b.usedDays - b.pendingDays;
                  const usedPct =
                    b.totalDays > 0
                      ? Math.round((b.usedDays / b.totalDays) * 100)
                      : 0;
                  const label =
                    BALANCE_LABELS[b.balanceType] ?? { fr: b.balanceType, en: b.balanceType };
                  return (
                    <div
                      key={b.balanceType}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                    >
                      <p className="text-sm font-medium text-gray-700">
                        {lang === "en" ? label.en : label.fr}
                      </p>
                      <div className="mt-3 flex items-end justify-between">
                        <p className="text-2xl font-bold text-gray-900">
                          {remaining}
                          <span className="text-sm font-normal text-gray-400">
                            /{b.totalDays}j
                          </span>
                        </p>
                        <span className="text-xs text-gray-500">
                          {lang === "en" ? "remaining" : "restant(s)"}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(usedPct, 100)}%`,
                            backgroundColor:
                              usedPct > 80 ? "#EF4444" : "#1B3A5C",
                          }}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[11px] text-gray-400">
                        <span>
                          {b.usedDays}j {lang === "en" ? "used" : "pris"}
                        </span>
                        {b.pendingDays > 0 && (
                          <span>
                            {b.pendingDays}j{" "}
                            {lang === "en" ? "pending" : "en attente"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* ═══════════ REPORT TABLE ═══════════ */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {lang === "en" ? "Leave requests" : "Demandes de congés"}
            </h2>
            {data && (
              <p className="mt-1 text-sm text-gray-500">
                {data.summary.totalRequests}{" "}
                {lang === "en" ? "requests" : "demandes"} ·{" "}
                {data.summary.totalDays}j · {data.summary.approvedCount}{" "}
                {lang === "en" ? "approved" : "approuvées"}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                hasFilters
                  ? "border-[#1B3A5C] bg-blue-50 text-[#1B3A5C]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Filter className="h-4 w-4" />
              {lang === "en" ? "Filters" : "Filtres"}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={!data || data.items.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </div>
        </div>

        {showFilters && data && (
          <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">
                {lang === "en" ? "Filters" : "Filtres"}
              </h3>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                >
                  <X className="h-3 w-3" />
                  {lang === "en" ? "Clear all" : "Tout effacer"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              >
                <option value="">
                  {lang === "en" ? "All teams" : "Toutes équipes"}
                </option>
                {data.filters.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              >
                <option value="">
                  {lang === "en" ? "All types" : "Tous types"}
                </option>
                {data.filters.leaveTypes.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lang === "en" ? lt.label_en : lt.label_fr}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              >
                <option value="">
                  {lang === "en" ? "All statuses" : "Tous statuts"}
                </option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {lang === "en" ? v.en : v.fr}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-gray-400">
              {lang === "en" ? "No results." : "Aucun résultat."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                    <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                      {lang === "en" ? "Employee" : "Employé"}
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                      {lang === "en" ? "Team" : "Équipe"}
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                      {lang === "en" ? "Type" : "Type"}
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                      {lang === "en" ? "Dates" : "Dates"}
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                      {lang === "en" ? "Days" : "Jours"}
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                      {lang === "en" ? "Status" : "Statut"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((item) => {
                    const st = STATUS_CONFIG[item.status] ?? {
                      fr: item.status,
                      en: item.status,
                      bg: "bg-gray-100",
                      text: "text-gray-700",
                    };
                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50">
                        <td className="whitespace-nowrap px-6 py-4">
                          <p className="font-medium text-gray-900">
                            {item.user.firstName} {item.user.lastName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.user.email}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                          {item.user.team?.name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: item.leaveTypeConfig.color,
                              }}
                            />
                            <span>
                              {lang === "en"
                                ? item.leaveTypeConfig.label_en
                                : item.leaveTypeConfig.label_fr}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                          {formatDate(item.startDate, lang)} →{" "}
                          {formatDate(item.endDate, lang)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                          {item.totalDays}j
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${st.bg} ${st.text}`}
                          >
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
    </div>
  );
}
