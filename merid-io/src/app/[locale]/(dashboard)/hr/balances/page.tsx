"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  Filter,
  Edit3,
  X,
  History,
  Building2,
  Users,
} from "lucide-react";

// ─── Types ───

interface BalanceInfo {
  id: string;
  total: number;
  used: number;
  pending: number;
  remaining: number;
  carriedOver?: number;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  office: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  annualBalance: BalanceInfo | null;
  offeredBalance: BalanceInfo | null;
}

interface OfficeOption {
  id: string;
  name: string;
}

interface TeamOption {
  id: string;
  name: string;
}

interface AdjustmentEntry {
  id: string;
  byUser: string;
  entityId: string;
  oldValue: { totalDays: number; reason: string } | null;
  newValue: { totalDays: number; reason: string } | null;
  createdAt: string;
}

// ─── Component ───

export default function HRBalancesPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = useLocale();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [year, setYear] = useState(new Date().getFullYear());
  const [officeFilter, setOfficeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Adjust modal
  const [adjustModal, setAdjustModal] = useState<{
    employee: Employee;
    balanceType: "annual" | "offered";
    balanceId: string;
    currentTotal: number;
  } | null>(null);
  const [newTotal, setNewTotal] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("year", String(year));
      if (officeFilter) params.set("office", officeFilter);
      if (teamFilter) params.set("team", teamFilter);

      const res = await fetch(`/api/hr/balances?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees);
        setOffices(data.offices);
        setTeams(data.teams);
        setAdjustmentHistory(data.adjustmentHistory);
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setLoading(false);
    }
  }, [year, officeFilter, teamFilter, addToast, lang]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const openAdjust = (emp: Employee, type: "annual" | "offered") => {
    const balance = type === "annual" ? emp.annualBalance : emp.offeredBalance;
    if (!balance) return;
    setAdjustModal({ employee: emp, balanceType: type, balanceId: balance.id, currentTotal: balance.total });
    setNewTotal(String(balance.total));
    setAdjustReason("");
  };

  const handleAdjust = async () => {
    if (!adjustModal || !adjustReason.trim()) {
      addToast({ type: "error", title: lang === "en" ? "Reason is required" : "Le motif est obligatoire" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/hr/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balanceId: adjustModal.balanceId,
          newTotalDays: parseFloat(newTotal),
          reason: adjustReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      addToast({ type: "success", title: lang === "en" ? "Balance adjusted" : "Solde ajusté" });
      setAdjustModal(null);
      fetchBalances();
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Leave Balances" : "Soldes de congés"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en" ? "View and adjust employee leave balances" : "Consultez et ajustez les soldes de congés"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showFilters ? "border-[#1B3A5C] bg-blue-50 text-[#1B3A5C]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
          >
            <Filter className="h-4 w-4" />
            {lang === "en" ? "Filters" : "Filtres"}
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showHistory ? "border-[#1B3A5C] bg-blue-50 text-[#1B3A5C]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
          >
            <History className="h-4 w-4" />
            {lang === "en" ? "History" : "Historique"}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{lang === "en" ? "Year" : "Année"}</label>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{lang === "en" ? "Office" : "Bureau"}</label>
              <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]">
                <option value="">{lang === "en" ? "All offices" : "Tous les bureaux"}</option>
                {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{lang === "en" ? "Team" : "Équipe"}</label>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]">
                <option value="">{lang === "en" ? "All teams" : "Toutes les équipes"}</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-500">{lang === "en" ? "No employees found." : "Aucun employé trouvé."}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Employee" : "Employé"}</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-500">{lang === "en" ? "Office" : "Bureau"}</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-500">{lang === "en" ? "Team" : "Équipe"}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-gray-500">{lang === "en" ? "Annual Total" : "Annuel Total"}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-gray-500">{lang === "en" ? "Used" : "Utilisés"}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-gray-500">{lang === "en" ? "Pending" : "En attente"}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-gray-500">{lang === "en" ? "Remaining" : "Restants"}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-gray-500">{lang === "en" ? "Offered" : "Offert"}</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-500">{lang === "en" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-3">
                      <p className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {emp.office ? (
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3 text-gray-400" />{emp.office.name}</span>
                      ) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {emp.team ? (
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-gray-400" />{emp.team.name}</span>
                      ) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center font-medium text-gray-900">
                      {emp.annualBalance ? emp.annualBalance.total : "-"}
                      {emp.annualBalance && emp.annualBalance.carriedOver ? (
                        <span className="ml-1 text-xs text-gray-400">(+{emp.annualBalance.carriedOver})</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-gray-600">
                      {emp.annualBalance ? emp.annualBalance.used : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-gray-600">
                      {emp.annualBalance ? emp.annualBalance.pending : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {emp.annualBalance ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${emp.annualBalance.remaining > 5 ? "bg-green-100 text-green-700" : emp.annualBalance.remaining > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {emp.annualBalance.remaining}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {emp.offeredBalance ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {emp.offeredBalance.remaining}/{emp.offeredBalance.total}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-1">
                        {emp.annualBalance && (
                          <button
                            onClick={() => openAdjust(emp, "annual")}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#1B3A5C] hover:bg-blue-50"
                            title={lang === "en" ? "Adjust annual" : "Ajuster annuel"}
                          >
                            <Edit3 className="h-3 w-3" />
                            {lang === "en" ? "Annual" : "Annuel"}
                          </button>
                        )}
                        {emp.offeredBalance && (
                          <button
                            onClick={() => openAdjust(emp, "offered")}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                            title={lang === "en" ? "Adjust offered" : "Ajuster offert"}
                          >
                            <Edit3 className="h-3 w-3" />
                            {lang === "en" ? "Offered" : "Offert"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjustment History */}
      {showHistory && adjustmentHistory.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <History className="h-4 w-4" />
            {lang === "en" ? "Recent adjustments" : "Ajustements récents"}
          </h3>
          <div className="space-y-2">
            {adjustmentHistory.map((a) => {
              const oldVal = a.oldValue as { totalDays: number; reason: string } | null;
              const newVal = a.newValue as { totalDays: number; reason: string } | null;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-2.5 text-sm">
                  <span className="text-gray-500">{new Date(a.createdAt).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-medium text-gray-900">{a.byUser}</span>
                  <span className="text-gray-500">:</span>
                  <span className="text-red-600 line-through">{oldVal?.totalDays ?? "?"}</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="font-semibold text-green-700">{newVal?.totalDays ?? "?"}</span>
                  {newVal?.reason && (
                    <span className="italic text-gray-500">&mdash; {newVal.reason}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Adjust Modal */}
      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setAdjustModal(null)} />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {lang === "en" ? "Adjust balance" : "Ajuster le solde"}
              </h3>
              <button onClick={() => setAdjustModal(null)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {adjustModal.employee.firstName} {adjustModal.employee.lastName} — {adjustModal.balanceType === "annual" ? (lang === "en" ? "Annual balance" : "Solde annuel") : (lang === "en" ? "Offered balance" : "Solde offert")}
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "New total (days)" : "Nouveau total (jours)"}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={newTotal}
                  onChange={(e) => setNewTotal(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {lang === "en" ? "Current" : "Actuel"}: {adjustModal.currentTotal} {lang === "en" ? "days" : "jours"}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "Reason" : "Motif"} *
                </label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={lang === "en" ? "Reason for adjustment..." : "Motif de l'ajustement..."}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAdjustModal(null)} disabled={saving} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
              <button onClick={handleAdjust} disabled={saving || !adjustReason.trim()} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#1B3A5C" }}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "en" ? "Save" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
