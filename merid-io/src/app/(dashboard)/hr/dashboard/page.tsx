"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  Users,
  Clock,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Smile,
  Heart,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

interface KPIs {
  pendingHR: number;
  activeAbsences: number;
  totalEmployees: number;
  approvedDaysThisYear: number;
  absenteeismRate: number;
}

interface MonthData {
  month: number;
  label_fr: string;
  label_en: string;
  days: number;
}

interface OfficeData {
  name: string;
  days: number;
  employees: number;
  rate: number;
}

interface TypeData {
  name_fr: string;
  name_en: string;
  color: string;
  value: number;
}

interface PulseData {
  moodAverage: number | null;
  moodTotal: number;
  moodDistribution: Record<string, number>;
  shoutoutsThisWeek: number;
  shoutoutsThisMonth: number;
}

interface DashboardData {
  kpis: KPIs;
  pulse?: PulseData;
  byMonth: MonthData[];
  byOffice: OfficeData[];
  byType: TypeData[];
}

export default function HRDashboardPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hr/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error("Load failed");
        return r.json();
      })
      .then(setData)
      .catch(() => {
        addToast({ type: "error", title: lang === "en" ? "Load error" : "Erreur de chargement" });
      })
      .finally(() => setLoading(false));
  }, [addToast, lang]);

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
        <AlertCircle className="h-5 w-5" />
        {lang === "en" ? "Unable to load dashboard." : "Impossible de charger le tableau de bord."}
      </div>
    );
  }

  const { kpis, pulse, byMonth, byOffice, byType } = data;

  const MOOD_EMOJIS: Record<string, string> = {
    VERY_BAD: "\uD83D\uDE29",
    BAD: "\uD83D\uDE1E",
    NEUTRAL: "\uD83D\uDE10",
    GOOD: "\uD83D\uDE0A",
    VERY_GOOD: "\uD83E\uDD29",
  };

  const moodLabel = (avg: number | null) => {
    if (avg === null) return "—";
    if (avg >= 4.5) return lang === "en" ? "Excellent" : "Excellent";
    if (avg >= 3.5) return lang === "en" ? "Good" : "Bon";
    if (avg >= 2.5) return lang === "en" ? "Average" : "Moyen";
    return lang === "en" ? "Needs attention" : "A surveiller";
  };

  const moodColor = (avg: number | null) => {
    if (avg === null) return "text-gray-400";
    if (avg >= 4) return "text-green-600";
    if (avg >= 3) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === "en" ? "HR Dashboard" : "Tableau de bord RH"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {lang === "en"
            ? `Overview for ${new Date().getFullYear()}`
            : `Vue d'ensemble pour ${new Date().getFullYear()}`}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Pending HR" : "En attente RH"}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{kpis.pendingHR}</p>
          <p className="mt-1 text-xs text-gray-500">
            {lang === "en" ? "requests to review" : "demandes a traiter"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Active absences" : "Absences en cours"}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(27,58,92,0.1)" }}>
              <CalendarDays className="h-5 w-5" style={{ color: "#1B3A5C" }} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{kpis.activeAbsences}</p>
          <p className="mt-1 text-xs text-gray-500">
            {lang === "en" ? "employees on leave today" : "employes absents aujourd'hui"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Total employees" : "Total employes"}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(0,188,212,0.1)" }}>
              <Users className="h-5 w-5" style={{ color: "#00BCD4" }} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{kpis.totalEmployees}</p>
          <p className="mt-1 text-xs text-gray-500">
            {lang === "en" ? "active users" : "utilisateurs actifs"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Days taken" : "Jours pris"}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <CalendarDays className="h-5 w-5 text-green-500" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{kpis.approvedDaysThisYear}</p>
          <p className="mt-1 text-xs text-gray-500">
            {lang === "en" ? "approved this year" : "approuves cette annee"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Absenteeism" : "Absenteisme"}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{kpis.absenteeismRate}%</p>
          <p className="mt-1 text-xs text-gray-500">
            {lang === "en" ? "global rate" : "taux global"}
          </p>
        </div>
      </div>

      {/* Pulse KPIs */}
      {pulse && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                {lang === "en" ? "Mood score (7d)" : "Humeur (7j)"}
              </p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50">
                <Smile className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
            <p className={`mt-3 text-3xl font-bold ${moodColor(pulse.moodAverage)}`}>
              {pulse.moodAverage !== null ? pulse.moodAverage.toFixed(1) : "—"}<span className="text-lg text-gray-400">/5</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">{moodLabel(pulse.moodAverage)}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                {lang === "en" ? "Check-ins (7d)" : "Check-ins (7j)"}
              </p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <CalendarDays className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{pulse.moodTotal}</p>
            <p className="mt-1 text-xs text-gray-500">
              {lang === "en" ? "mood responses" : "reponses humeur"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                {lang === "en" ? "Shoutouts (7d)" : "Shoutouts (7j)"}
              </p>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-50">
                <Heart className="h-5 w-5 text-pink-500" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{pulse.shoutoutsThisWeek}</p>
            <p className="mt-1 text-xs text-gray-500">
              {lang === "en" ? "peer recognitions" : "reconnaissances pair"}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500 mb-3">
              {lang === "en" ? "Mood distribution (7d)" : "Distribution humeur (7j)"}
            </p>
            <div className="flex items-end gap-1 h-12">
              {Object.entries(pulse.moodDistribution).map(([mood, count]) => {
                const maxCount = Math.max(...Object.values(pulse.moodDistribution), 1);
                const height = count > 0 ? Math.max((count / maxCount) * 100, 10) : 4;
                const colors: Record<string, string> = {
                  VERY_BAD: "bg-red-400", BAD: "bg-orange-400", NEUTRAL: "bg-yellow-400", GOOD: "bg-green-400", VERY_GOOD: "bg-emerald-500",
                };
                return (
                  <div key={mood} className="flex flex-col items-center flex-1 gap-0.5">
                    <div className={`w-full rounded-t ${colors[mood] || "bg-gray-300"}`} style={{ height: `${height}%` }} />
                    <span className="text-xs" title={mood}>{MOOD_EMOJIS[mood]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 1: Line + Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Absences by month (line) */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Absences by month" : "Absences par mois"}
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey={lang === "en" ? "label_en" : "label_fr"} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value}j`, lang === "en" ? "Days" : "Jours"]} />
                <Line type="monotone" dataKey="days" stroke="#1B3A5C" strokeWidth={2} dot={{ fill: "#1B3A5C" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Absences by office (bar) */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Absences by office" : "Absences par bureau"}
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byOffice}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) => [
                    `${value}${name === "rate" ? "%" : "j"}`,
                    name === "rate" ? (lang === "en" ? "Rate" : "Taux") : (lang === "en" ? "Days" : "Jours"),
                  ]}
                />
                <Bar dataKey="days" fill="#1B3A5C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart Row 2: Pie + Absenteeism by office table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* By type (pie) */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Leave distribution by type" : "Repartition par type de conge"}
          </h2>
          {byType.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-gray-400">
              {lang === "en" ? "No data" : "Aucune donnee"}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
              <div className="h-64 w-64 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byType} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                      {byType.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value}j`, ""]}
                      labelFormatter={(_, payload) => {
                        if (payload && payload.length > 0) {
                          const item = payload[0].payload as Record<string, string>;
                          return lang === "en" ? item.name_en : item.name_fr;
                        }
                        return "";
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2">
                {byType.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-gray-700">{lang === "en" ? entry.name_en : entry.name_fr}</span>
                    <span className="ml-auto text-sm font-semibold text-gray-900">{entry.value}j</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Absenteeism by office */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Absenteeism rate" : "Taux d'absenteisme"}
          </h2>
          <ul className="mt-4 space-y-3">
            {byOffice.map((o, idx) => (
              <li key={idx} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{o.name}</p>
                  <p className="text-xs text-gray-500">
                    {o.employees} {lang === "en" ? "employees" : "employes"}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${o.rate > 5 ? "text-red-600" : "text-green-600"}`}>
                  {o.rate}%
                </span>
              </li>
            ))}
            {byOffice.length === 0 && (
              <li className="text-sm text-gray-400">{lang === "en" ? "No offices" : "Aucun bureau"}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
