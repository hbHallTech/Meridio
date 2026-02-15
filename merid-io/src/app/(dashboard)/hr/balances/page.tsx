"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import { Loader2, Wallet, Search, SlidersHorizontal } from "lucide-react";

interface BalanceInfo {
  total: number;
  used: number;
  pending: number;
  remaining: number;
  carriedOver?: number;
}

interface EmployeeBalance {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  office: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  annual: BalanceInfo | null;
  offered: BalanceInfo | null;
}

interface FilterOption {
  id: string;
  name: string;
}

export default function HRBalancesPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  const [items, setItems] = useState<EmployeeBalance[]>([]);
  const [offices, setOffices] = useState<FilterOption[]>([]);
  const [teams, setTeams] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");

  // Adjust modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustUser, setAdjustUser] = useState<EmployeeBalance | null>(null);
  const [adjustType, setAdjustType] = useState<"ANNUAL" | "OFFERED">("ANNUAL");
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const fetchBalances = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (officeFilter) params.set("officeId", officeFilter);
    if (teamFilter) params.set("teamId", teamFilter);
    try {
      const res = await fetch(`/api/hr/balances?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
        setOffices(data.offices);
        setTeams(data.teams);
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Load error" : "Erreur de chargement" });
    } finally {
      setLoading(false);
    }
  }, [officeFilter, teamFilter, addToast, lang]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const filtered = items.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.firstName.toLowerCase().includes(q) ||
      i.lastName.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q)
    );
  });

  const openAdjust = (user: EmployeeBalance, type: "ANNUAL" | "OFFERED") => {
    setAdjustUser(user);
    setAdjustType(type);
    setAdjustValue("");
    setAdjustReason("");
    setAdjustOpen(true);
  };

  const handleAdjust = async () => {
    if (!adjustUser || !adjustValue || !adjustReason.trim()) {
      addToast({ type: "error", title: lang === "en" ? "Fill all fields" : "Remplissez tous les champs" });
      return;
    }
    setAdjustSaving(true);
    try {
      const res = await fetch("/api/hr/balances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: adjustUser.id,
          balanceType: adjustType,
          adjustment: parseFloat(adjustValue),
          reason: adjustReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      addToast({ type: "success", title: lang === "en" ? "Balance adjusted" : "Solde ajuste" });
      setAdjustOpen(false);
      fetchBalances();
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur reseau" });
    } finally {
      setAdjustSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Leave Balances" : "Soldes de conges"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? `${filtered.length} employee(s)`
              : `${filtered.length} employe(s)`}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(0,188,212,0.1)" }}>
          <Wallet className="h-5 w-5" style={{ color: "#00BCD4" }} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "en" ? "Search employee..." : "Rechercher un employe..."}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-gray-400" />
          <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none">
            <option value="">{lang === "en" ? "All offices" : "Tous les bureaux"}</option>
            {offices.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
          </select>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none">
            <option value="">{lang === "en" ? "All teams" : "Toutes les equipes"}</option>
            {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">
            {lang === "en" ? "No employees found." : "Aucun employe trouve."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Employee" : "Employe"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Office" : "Bureau"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Team" : "Equipe"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500 text-center">{lang === "en" ? "Annual" : "Annuel"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500 text-center">{lang === "en" ? "Offered" : "Offert"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <p className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-gray-400">{emp.email}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{emp.office?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{emp.team?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      {emp.annual ? (
                        <div>
                          <span className="font-semibold text-gray-900">{emp.annual.remaining}</span>
                          <span className="text-gray-400"> / {emp.annual.total + (emp.annual.carriedOver ?? 0)}</span>
                          {emp.annual.pending > 0 && <span className="ml-1 text-xs text-amber-500">({emp.annual.pending}p)</span>}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center">
                      {emp.offered ? (
                        <div>
                          <span className="font-semibold text-gray-900">{emp.offered.remaining}</span>
                          <span className="text-gray-400"> / {emp.offered.total}</span>
                          {emp.offered.pending > 0 && <span className="ml-1 text-xs text-amber-500">({emp.offered.pending}p)</span>}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex gap-1">
                        {emp.annual && (
                          <button onClick={() => openAdjust(emp, "ANNUAL")} className="rounded px-2 py-1 text-xs font-medium text-[#1B3A5C] hover:bg-blue-50">
                            {lang === "en" ? "Adj. Annual" : "Aj. Annuel"}
                          </button>
                        )}
                        {emp.offered && (
                          <button onClick={() => openAdjust(emp, "OFFERED")} className="rounded px-2 py-1 text-xs font-medium text-[#00BCD4] hover:bg-cyan-50">
                            {lang === "en" ? "Adj. Offered" : "Aj. Offert"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjust Modal */}
      {adjustOpen && adjustUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              {lang === "en" ? "Adjust balance" : "Ajuster le solde"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {adjustUser.firstName} {adjustUser.lastName} — {adjustType === "ANNUAL" ? (lang === "en" ? "Annual" : "Annuel") : (lang === "en" ? "Offered" : "Offert")}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {lang === "en" ? "Current balance:" : "Solde actuel:"}{" "}
              <span className="font-semibold">
                {adjustType === "ANNUAL" ? adjustUser.annual?.remaining ?? 0 : adjustUser.offered?.remaining ?? 0}
              </span>{" "}
              {lang === "en" ? "remaining" : "restant(s)"}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {lang === "en" ? "Adjustment (days)" : "Ajustement (jours)"}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={adjustValue}
                  onChange={(e) => setAdjustValue(e.target.value)}
                  placeholder={lang === "en" ? "e.g. 2 or -1" : "ex: 2 ou -1"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {lang === "en" ? "Reason (required)" : "Motif (requis)"}
                </label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAdjustOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
              <button onClick={handleAdjust} disabled={adjustSaving} className="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#1B3A5C" }}>
                {adjustSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : lang === "en" ? "Adjust" : "Ajuster"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
