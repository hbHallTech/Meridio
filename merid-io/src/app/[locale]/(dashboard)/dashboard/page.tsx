"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import {
  CalendarDays,
  Clock,
  Gift,
  Loader2,
  AlertTriangle,
  Calendar,
  ArrowRight,
  PlusCircle,
  Eye,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface BalanceData {
  total: number;
  used: number;
  pending: number;
  remaining: number;
  carriedOver?: number;
}

interface LeaveTypeInfo {
  code: string;
  label_fr: string;
  label_en: string;
  color: string;
}

interface DashboardData {
  balances: {
    annual: BalanceData | null;
    offered: BalanceData | null;
  };
  pendingCount: number;
  upcomingLeaves: {
    id: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    leaveType: LeaveTypeInfo;
  }[];
  chartData: {
    name_fr: string;
    name_en: string;
    code: string;
    color: string;
    value: number;
  }[];
  recentRequests: {
    id: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    status: string;
    createdAt: string;
    leaveType: LeaveTypeInfo;
  }[];
  upcomingHolidays: {
    id: string;
    date: string;
    name_fr: string;
    name_en: string | null;
  }[];
  probation: { endDate: string } | null;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "Brouillon", bg: "bg-gray-100", text: "text-gray-700" },
  PENDING_MANAGER: { label: "En attente (Manager)", bg: "bg-amber-100", text: "text-amber-700" },
  PENDING_HR: { label: "En attente (RH)", bg: "bg-amber-100", text: "text-amber-700" },
  APPROVED: { label: "Approuvé", bg: "bg-green-100", text: "text-green-700" },
  REFUSED: { label: "Refusé", bg: "bg-red-100", text: "text-red-700" },
  CANCELLED: { label: "Annulé", bg: "bg-gray-100", text: "text-gray-500" },
  RETURNED: { label: "Retourné", bg: "bg-blue-100", text: "text-blue-700" },
};

function formatDate(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatDateLong(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const lang = useLocale();
  const userName = session?.user?.name?.split(" ")[0] ?? "";

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        Impossible de charger le tableau de bord.
      </div>
    );
  }

  const annual = data.balances.annual;
  const offered = data.balances.offered;
  const chartEmpty = data.chartData.length === 0;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === "en" ? "Welcome" : "Bienvenue"}, {userName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {lang === "en"
            ? "Here is an overview of your leaves and balances."
            : "Voici un aperçu de vos congés et soldes."}
        </p>
      </div>

      {/* Probation alert */}
      {data.probation && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {lang === "en" ? "Trial period" : "Période d'essai"}
            </p>
            <p className="mt-0.5 text-sm text-amber-700">
              {lang === "en"
                ? `You are on probation until ${formatDateLong(data.probation.endDate, "en")}. Leave requests are not possible during this period.`
                : `Vous êtes en période d'essai jusqu'au ${formatDateLong(data.probation.endDate, "fr")}. Les demandes de congé ne sont pas possibles pendant cette période.`}
            </p>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Annual leave balance */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Annual Leave" : "Congé annuel"}
            </p>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
            >
              <CalendarDays className="h-5 w-5" style={{ color: "#1B3A5C" }} />
            </div>
          </div>
          {annual ? (
            <>
              <p className="mt-3 text-3xl font-bold text-gray-900">
                {annual.remaining}
                <span className="ml-1 text-base font-normal text-gray-400">
                  / {annual.total + (annual.carriedOver ?? 0)}
                </span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (annual.used / (annual.total + (annual.carriedOver ?? 0))) * 100)}%`,
                    backgroundColor: "#1B3A5C",
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {annual.used} {lang === "en" ? "used" : "pris"}
                {annual.pending > 0 && (
                  <span className="text-amber-600">
                    {" "}· {annual.pending} {lang === "en" ? "pending" : "en attente"}
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-400">
              {lang === "en" ? "No balance configured" : "Aucun solde configuré"}
            </p>
          )}
        </div>

        {/* Offered days */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Offered Days" : "Congés offerts"}
            </p>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
            >
              <Gift className="h-5 w-5" style={{ color: "#00BCD4" }} />
            </div>
          </div>
          {offered ? (
            <>
              <p className="mt-3 text-3xl font-bold text-gray-900">
                {offered.remaining}
                <span className="ml-1 text-base font-normal text-gray-400">
                  / {offered.total}
                </span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (offered.used / offered.total) * 100)}%`,
                    backgroundColor: "#00BCD4",
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {offered.used} {lang === "en" ? "used" : "pris"}
                {offered.pending > 0 && (
                  <span className="text-amber-600">
                    {" "}· {offered.pending} {lang === "en" ? "pending" : "en attente"}
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-400">
              {lang === "en" ? "No balance configured" : "Aucun solde configuré"}
            </p>
          )}
        </div>

        {/* Pending requests */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Pending Requests" : "Demandes en attente"}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-gray-900">{data.pendingCount}</p>
          <p className="mt-2 text-xs text-gray-500">
            {data.pendingCount === 0
              ? lang === "en"
                ? "All requests processed"
                : "Toutes les demandes traitées"
              : lang === "en"
                ? "Awaiting validation"
                : "En attente de validation"}
          </p>
        </div>

        {/* Upcoming leaves */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Next Leave" : "Prochain congé"}
            </p>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <Calendar className="h-5 w-5 text-green-500" />
            </div>
          </div>
          {data.upcomingLeaves.length > 0 ? (
            <>
              <p className="mt-3 text-lg font-bold text-gray-900">
                {formatDate(data.upcomingLeaves[0].startDate, lang)}
                {data.upcomingLeaves[0].startDate !== data.upcomingLeaves[0].endDate && (
                  <span>
                    {" → "}
                    {formatDate(data.upcomingLeaves[0].endDate, lang)}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {lang === "en"
                  ? data.upcomingLeaves[0].leaveType.label_en
                  : data.upcomingLeaves[0].leaveType.label_fr}{" "}
                · {data.upcomingLeaves[0].totalDays}j
              </p>
              {data.upcomingLeaves.length > 1 && (
                <p className="mt-2 text-xs text-gray-400">
                  +{data.upcomingLeaves.length - 1}{" "}
                  {lang === "en" ? "other(s) planned" : "autre(s) prévu(s)"}
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-400">
              {lang === "en" ? "No upcoming leave" : "Aucun congé à venir"}
            </p>
          )}
        </div>
      </div>

      {/* Chart + Holidays */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Donut chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Leave Distribution" : "Répartition des congés"}
          </h2>
          <p className="text-sm text-gray-500">
            {lang === "en"
              ? `Approved days taken in ${new Date().getFullYear()}`
              : `Jours pris approuvés en ${new Date().getFullYear()}`}
          </p>
          {chartEmpty ? (
            <div className="flex h-64 items-center justify-center text-sm text-gray-400">
              {lang === "en"
                ? "No approved leave yet this year"
                : "Aucun congé approuvé cette année"}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
              <div className="h-64 w-64 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {data.chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
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
                {data.chartData.map((entry, idx) => (
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

        {/* Upcoming holidays */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Upcoming Holidays" : "Prochains jours fériés"}
          </h2>
          {data.upcomingHolidays.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">
              {lang === "en"
                ? "No upcoming holidays"
                : "Aucun jour férié à venir"}
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {data.upcomingHolidays.map((holiday) => {
                const d = new Date(holiday.date);
                const dayName = d.toLocaleDateString(
                  lang === "en" ? "en-GB" : "fr-FR",
                  { weekday: "long" }
                );
                const dateStr = d.toLocaleDateString(
                  lang === "en" ? "en-GB" : "fr-FR",
                  { day: "numeric", month: "long" }
                );
                return (
                  <li key={holiday.id} className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: "#1B3A5C" }}
                    >
                      <span className="text-[10px] font-medium uppercase leading-none">
                        {d.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
                          month: "short",
                        })}
                      </span>
                      <span className="text-sm font-bold leading-tight">
                        {d.getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {lang === "en"
                          ? holiday.name_en || holiday.name_fr
                          : holiday.name_fr}
                      </p>
                      <p className="text-xs capitalize text-gray-500">
                        {dayName}, {dateStr}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Recent requests table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Recent Requests" : "Dernières demandes"}
          </h2>
          <div className="flex gap-2">
            <Link
              href="/leaves/new"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              <PlusCircle className="h-4 w-4" />
              {lang === "en" ? "New request" : "Nouvelle demande"}
            </Link>
            <Link
              href="/leaves"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {lang === "en" ? "View all" : "Voir tout"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {data.recentRequests.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            {lang === "en"
              ? "No leave request yet."
              : "Aucune demande de congé pour le moment."}
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
                    {lang === "en" ? "Actions" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentRequests.map((req) => {
                  const status = statusConfig[req.status] ?? {
                    label: req.status,
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                  };
                  return (
                    <tr key={req.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: req.leaveType.color }}
                          />
                          <span className="font-medium text-gray-900">
                            {lang === "en"
                              ? req.leaveType.label_en
                              : req.leaveType.label_fr}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {formatDate(req.startDate, lang)}
                        {req.startDate !== req.endDate && (
                          <span> → {formatDate(req.endDate, lang)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {req.totalDays}j
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.bg} ${status.text}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link
                          href={`/leaves/${req.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                          style={{ color: "#00BCD4" }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {lang === "en" ? "View" : "Voir"}
                        </Link>
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
