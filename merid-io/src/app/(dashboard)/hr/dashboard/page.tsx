"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import {
  Loader2,
  Users,
  Clock,
  CalendarOff,
  TrendingUp,
  Building2,
} from "lucide-react";

// ─── Types ───

interface KPIs {
  currentAbsences: number;
  pendingHR: number;
  pendingManager: number;
  totalEmployees: number;
  avgDelayHours: number;
}

interface OfficeAbsenteeism {
  officeId: string;
  name: string;
  city: string;
  employees: number;
  absent: number;
  rate: number;
}

interface ChartData {
  byMonth: { month: number; days: number }[];
  byOffice: { name: string; city: string; days: number }[];
  byType: { label_fr: string; label_en: string; color: string; days: number }[];
}

// ─── Constants ───

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Component ───

export default function HRDashboardPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [absenteeism, setAbsenteeism] = useState<OfficeAbsenteeism[]>([]);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/dashboard");
      if (res.ok) {
        const data = await res.json();
        setKpis(data.kpis);
        setAbsenteeism(data.absenteeismByOffice);
        setCharts(data.charts);
        setYear(data.year);
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setLoading(false);
    }
  }, [addToast, lang]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Format month data for chart
  const monthData = charts?.byMonth.map((m) => ({
    name: (lang === "en" ? MONTHS_EN : MONTHS_FR)[m.month],
    days: m.days,
  })) ?? [];

  // Format delay as human-readable
  const formatDelay = (hours: number): string => {
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return lang === "en" ? `${days}d` : `${days}j`;
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === "en" ? "HR Dashboard" : "Tableau de bord RH"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {lang === "en" ? `Overview of absences and requests — ${year}` : `Vue d'ensemble des absences et demandes — ${year}`}
        </p>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <CalendarOff className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "Currently absent" : "Absents actuels"}
                </p>
                <p className="text-2xl font-bold text-gray-900">{kpis.currentAbsences}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "Pending HR" : "En attente RH"}
                </p>
                <p className="text-2xl font-bold text-gray-900">{kpis.pendingHR}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "Pending Manager" : "En attente Manager"}
                </p>
                <p className="text-2xl font-bold text-gray-900">{kpis.pendingManager}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "Active employees" : "Employés actifs"}
                </p>
                <p className="text-2xl font-bold text-gray-900">{kpis.totalEmployees}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "Avg. validation" : "Délai moyen"}
                </p>
                <p className="text-2xl font-bold text-gray-900">{formatDelay(kpis.avgDelayHours)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Absenteeism by office */}
      {absenteeism.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Building2 className="h-4 w-4" />
            {lang === "en" ? "Absenteeism rate by office" : "Taux d'absentéisme par bureau"}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {absenteeism.map((o) => (
              <div key={o.officeId} className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{o.name}</p>
                    <p className="text-xs text-gray-500">{o.city} — {o.employees} {lang === "en" ? "employees" : "employés"}</p>
                  </div>
                  <span className={`text-2xl font-bold ${o.rate > 20 ? "text-red-600" : o.rate > 10 ? "text-amber-600" : "text-green-600"}`}>
                    {o.rate}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${o.rate > 20 ? "bg-red-500" : o.rate > 10 ? "bg-amber-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(o.rate, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {o.absent} {lang === "en" ? "absent today" : "absent(s) aujourd'hui"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      {charts && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Line chart: absences by month */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              {lang === "en" ? "Absences by month" : "Absences par mois"}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="days"
                  name={lang === "en" ? "Days" : "Jours"}
                  stroke="#1B3A5C"
                  strokeWidth={2}
                  dot={{ fill: "#1B3A5C", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart: absences by office */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              {lang === "en" ? "Absences by office" : "Absences par bureau"}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={charts.byOffice} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="days" name={lang === "en" ? "Days" : "Jours"} fill="#00BCD4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Pie chart: absences by type */}
      {charts && charts.byType.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            {lang === "en" ? "Absences by leave type" : "Absences par type de congé"}
          </h3>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ResponsiveContainer width="100%" height={280} className="max-w-sm">
              <PieChart>
                <Pie
                  data={charts.byType}
                  dataKey="days"
                  nameKey={lang === "en" ? "label_en" : "label_fr"}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  paddingAngle={2}
                  label={(props: PieLabelRenderProps) => `${props.name ?? ""} ${((Number(props.percent) || 0) * 100).toFixed(0)}%`}
                >
                  {charts.byType.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2">
              {charts.byType.map((t) => (
                <div key={t.color} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="text-sm text-gray-700">
                    {lang === "en" ? t.label_en : t.label_fr}: <strong>{t.days}</strong> {lang === "en" ? "days" : "jours"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
