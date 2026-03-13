"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  Users,
  TrendingDown,
  Target,
  Smile,
  AlertTriangle,
  Download,
  Building2,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ── Types ──

interface TeamAnalytics {
  teamId: string | null;
  teamName: string | null;
  headcount: number;
  turnoverRate: number;
  absenteeismRate: number;
  avgObjectiveCompletion: number;
  avgMood: number | null;
  avgRiskScore: number;
  riskAlerts: number;
  moodTrend: Array<{ week: string; avg: number; count: number }>;
  objectivesByStatus: Record<string, number>;
  topRiskUsers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    riskScore: number;
    riskLabel: string;
  }>;
}

interface TeamOption {
  id: string;
  name: string;
}

// ── Constants ──

const OBJ_STATUS_LABELS: Record<string, { label_fr: string; label_en: string; color: string }> = {
  IN_PROGRESS: { label_fr: "En cours", label_en: "In Progress", color: "#3B82F6" },
  ACHIEVED: { label_fr: "Atteint", label_en: "Achieved", color: "#10B981" },
  PARTIALLY_ACHIEVED: { label_fr: "Partiel", label_en: "Partial", color: "#F59E0B" },
  NOT_ACHIEVED: { label_fr: "Non atteint", label_en: "Not Achieved", color: "#EF4444" },
};

const RISK_COLORS: Record<string, string> = {
  low: "text-green-600 bg-green-50",
  moderate: "text-amber-600 bg-amber-50",
  high: "text-orange-600 bg-orange-50",
  critical: "text-red-600 bg-red-50",
};

const RISK_LABELS: Record<string, { fr: string; en: string }> = {
  low: { fr: "Faible", en: "Low" },
  moderate: { fr: "Modéré", en: "Moderate" },
  high: { fr: "Élevé", en: "High" },
  critical: { fr: "Critique", en: "Critical" },
};

// ── Component ──

export default function HRAnalyticsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  const [data, setData] = useState<TeamAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("company");
  const [exporting, setExporting] = useState(false);

  // Fetch teams list
  useEffect(() => {
    fetch("/api/admin/teams")
      .then((r) => (r.ok ? r.json() : []))
      .then((t) => setTeams(Array.isArray(t) ? t : []))
      .catch(() => {});
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        selectedTeam === "company"
          ? "/api/analytics/company"
          : `/api/analytics/team/${selectedTeam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erreur");
      setData(await res.json());
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Load error" : "Erreur de chargement",
      });
    }
    setLoading(false);
  }, [selectedTeam, addToast, lang]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const url =
        selectedTeam === "company"
          ? "/api/analytics/company?format=csv"
          : `/api/analytics/team/${selectedTeam}?format=csv`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `analytics-${selectedTeam}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Export error" : "Erreur d'export" });
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <AlertTriangle className="h-5 w-5" />
        {lang === "en" ? "Unable to load analytics." : "Impossible de charger les analytics."}
      </div>
    );
  }

  const objPieData = Object.entries(data.objectivesByStatus).map(([status, count]) => ({
    name: lang === "en" ? OBJ_STATUS_LABELS[status]?.label_en ?? status : OBJ_STATUS_LABELS[status]?.label_fr ?? status,
    value: count,
    color: OBJ_STATUS_LABELS[status]?.color ?? "#6B7280",
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingDown className="h-7 w-7 text-[#1B3A5C]" />
            People Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {lang === "en"
              ? "Workforce insights, risk scores & team metrics"
              : "Indicateurs RH, scores de risque & métriques équipe"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none"
          >
            <option value="company">
              {lang === "en" ? "All company" : "Toute l'entreprise"}
            </option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KPICard
          label={lang === "en" ? "Headcount" : "Effectif"}
          value={String(data.headcount)}
          sub={lang === "en" ? "active employees" : "employés actifs"}
          icon={<Users className="h-5 w-5 text-[#00BCD4]" />}
          iconBg="bg-cyan-50"
        />
        <KPICard
          label={lang === "en" ? "Turnover" : "Turnover"}
          value={`${data.turnoverRate}%`}
          sub={lang === "en" ? "this year" : "cette année"}
          icon={<TrendingDown className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
          valueColor={data.turnoverRate > 15 ? "text-red-600" : data.turnoverRate > 8 ? "text-amber-500" : "text-green-600"}
        />
        <KPICard
          label={lang === "en" ? "Absenteeism" : "Absentéisme"}
          value={`${data.absenteeismRate}%`}
          sub={lang === "en" ? "YTD rate" : "taux cumulé"}
          icon={<Building2 className="h-5 w-5 text-purple-500" />}
          iconBg="bg-purple-50"
          valueColor={data.absenteeismRate > 5 ? "text-red-600" : "text-green-600"}
        />
        <KPICard
          label={lang === "en" ? "Objectives" : "Objectifs"}
          value={`${data.avgObjectiveCompletion}%`}
          sub={lang === "en" ? "achieved/partial" : "atteints/partiels"}
          icon={<Target className="h-5 w-5 text-amber-500" />}
          iconBg="bg-amber-50"
          valueColor={data.avgObjectiveCompletion >= 70 ? "text-green-600" : data.avgObjectiveCompletion >= 40 ? "text-amber-500" : "text-red-600"}
        />
        <KPICard
          label={lang === "en" ? "Avg mood" : "Humeur moy."}
          value={data.avgMood !== null ? `${data.avgMood.toFixed(1)}/5` : "—"}
          sub={lang === "en" ? "last 30 days" : "30 derniers jours"}
          icon={<Smile className="h-5 w-5 text-yellow-500" />}
          iconBg="bg-yellow-50"
          valueColor={
            data.avgMood === null
              ? "text-gray-400"
              : data.avgMood >= 4
                ? "text-green-600"
                : data.avgMood >= 3
                  ? "text-amber-500"
                  : "text-red-500"
          }
        />
      </div>

      {/* Risk Score Alert Banner */}
      <div className={`rounded-xl border p-5 ${data.riskAlerts > 0 ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className={`h-6 w-6 ${data.riskAlerts > 0 ? "text-orange-600" : "text-green-600"}`} />
            <div>
              <p className={`font-semibold ${data.riskAlerts > 0 ? "text-orange-800" : "text-green-800"}`}>
                {lang === "en"
                  ? `${data.riskAlerts} flight risk alert${data.riskAlerts !== 1 ? "s" : ""}`
                  : `${data.riskAlerts} alerte${data.riskAlerts !== 1 ? "s" : ""} risque de départ`}
              </p>
              <p className={`text-sm ${data.riskAlerts > 0 ? "text-orange-600" : "text-green-600"}`}>
                {lang === "en"
                  ? `Average risk score: ${data.avgRiskScore}/100`
                  : `Score de risque moyen : ${data.avgRiskScore}/100`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Mood Trend */}
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {lang === "en" ? "Mood trend (30d)" : "Tendance humeur (30j)"}
          </h2>
          {data.moodTrend.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              {lang === "en" ? "No data" : "Aucune donnée"}
            </div>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.moodTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [
                      `${Number(value).toFixed(2)}`,
                      lang === "en" ? "Avg mood" : "Humeur moy.",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={{ fill: "#F59E0B", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Objectives by Status */}
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {lang === "en" ? "Objectives by status" : "Objectifs par statut"}
          </h2>
          {objPieData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              {lang === "en" ? "No data" : "Aucune donnée"}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={objPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {objPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {objPieData.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{entry.name}</span>
                    <span className="ml-auto text-sm font-semibold text-gray-900 dark:text-white">
                      {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Risk Users Table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {lang === "en" ? "Top flight risks" : "Principaux risques de départ"}
          </h2>
        </div>
        {data.topRiskUsers.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            {lang === "en" ? "No risk data available" : "Aucune donnée de risque disponible"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 font-medium text-gray-500">{lang === "en" ? "Employee" : "Employé"}</th>
                  <th className="pb-3 font-medium text-gray-500">{lang === "en" ? "Risk score" : "Score risque"}</th>
                  <th className="pb-3 font-medium text-gray-500">{lang === "en" ? "Level" : "Niveau"}</th>
                  <th className="pb-3 font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {data.topRiskUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B3A5C] text-white text-xs font-semibold">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {user.lastName} {user.firstName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-gray-200">
                          <div
                            className={`h-2 rounded-full ${
                              user.riskScore >= 70
                                ? "bg-red-500"
                                : user.riskScore >= 50
                                  ? "bg-orange-500"
                                  : user.riskScore >= 30
                                    ? "bg-amber-400"
                                    : "bg-green-500"
                            }`}
                            style={{ width: `${user.riskScore}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {user.riskScore}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          RISK_COLORS[user.riskLabel] ?? "text-gray-600 bg-gray-50"
                        }`}
                      >
                        {lang === "en"
                          ? RISK_LABELS[user.riskLabel]?.en ?? user.riskLabel
                          : RISK_LABELS[user.riskLabel]?.fr ?? user.riskLabel}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <a
                        href={`/admin/users/${user.id}`}
                        className="inline-flex items-center gap-1 text-sm text-[#1B3A5C] hover:underline"
                      >
                        {lang === "en" ? "View" : "Voir"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Risk Score Methodology */}
      <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {lang === "en" ? "Risk score methodology" : "Méthodologie score de risque"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          {[
            { label: lang === "en" ? "Seniority" : "Ancienneté", pct: "20%", desc: lang === "en" ? "< 1yr = high risk" : "< 1an = risque élevé" },
            { label: lang === "en" ? "Mood" : "Humeur", pct: "25%", desc: lang === "en" ? "30d avg inverted" : "Moy. 30j inversée" },
            { label: lang === "en" ? "Objectives" : "Objectifs", pct: "25%", desc: lang === "en" ? "% not achieved" : "% non atteints" },
            { label: lang === "en" ? "Leave usage" : "Congés pris", pct: "15%", desc: lang === "en" ? "Low usage = burnout" : "Peu pris = burnout" },
            { label: lang === "en" ? "Recognition" : "Reconnaissance", pct: "10%", desc: lang === "en" ? "Shoutouts received" : "Shoutouts reçus" },
            { label: lang === "en" ? "Contract" : "Contrat", pct: "5%", desc: lang === "en" ? "CDD ending soon" : "CDD bientôt fini" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-gray-100 dark:border-gray-700 p-3"
            >
              <p className="font-semibold text-gray-900 dark:text-white">{item.pct}</p>
              <p className="text-gray-700 dark:text-gray-300">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── KPI Card component ──

function KPICard({
  label,
  value,
  sub,
  icon,
  iconBg,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-800 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className={`mt-3 text-3xl font-bold ${valueColor ?? "text-gray-900 dark:text-white"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}
