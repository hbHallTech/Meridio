"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  ArrowLeft,
  Save,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";

// ─── Types ───

interface OfficeDetail {
  id: string;
  name: string;
  country: string;
  city: string;
  defaultAnnualLeave: number;
  defaultOfferedDays: number;
  minNoticeDays: number;
  maxCarryOverDays: number;
  carryOverDeadline: string;
  probationMonths: number;
  sickLeaveJustifFromDay: number;
  workingDays: string[];
  companyId: string;
  company: { id: string; name: string };
  exceptionalLeaveRules: ExceptionalRule[];
  _count: { users: number; teams: number };
}

interface ExceptionalRule {
  id: string;
  reason_fr: string;
  reason_en: string;
  maxDays: number;
  isActive: boolean;
}

interface CompanyOption {
  id: string;
  name: string;
}

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const DAY_LABELS_FR: Record<string, string> = {
  MON: "Lundi", TUE: "Mardi", WED: "Mercredi", THU: "Jeudi", FRI: "Vendredi", SAT: "Samedi", SUN: "Dimanche",
};
const DAY_LABELS_EN: Record<string, string> = {
  MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
};

// ─── Component ───

export default function OfficeEditPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const officeId = params.id as string;
  const lang = session?.user?.language ?? "fr";
  const dayLabels = lang === "en" ? DAY_LABELS_EN : DAY_LABELS_FR;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  // Office form
  const [form, setForm] = useState({
    name: "",
    country: "",
    city: "",
    companyId: "",
    defaultAnnualLeave: 25,
    defaultOfferedDays: 0,
    minNoticeDays: 2,
    maxCarryOverDays: 10,
    carryOverDeadline: "03-31",
    probationMonths: 3,
    sickLeaveJustifFromDay: 2,
    workingDays: ["MON", "TUE", "WED", "THU", "FRI"] as string[],
  });

  const [officeInfo, setOfficeInfo] = useState<{ _count: { users: number; teams: number } } | null>(null);

  // Exceptional rules
  const [rules, setRules] = useState<ExceptionalRule[]>([]);
  const [ruleModal, setRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ExceptionalRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    reason_fr: "",
    reason_en: "",
    maxDays: 1,
    isActive: true,
  });
  const [savingRule, setSavingRule] = useState(false);
  const [deleteRule, setDeleteRule] = useState<ExceptionalRule | null>(null);

  // ─── Fetch ───

  const fetchOffice = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/offices/${officeId}`);
      if (res.ok) {
        const data = await res.json();
        const o: OfficeDetail = data.office;
        setForm({
          name: o.name,
          country: o.country,
          city: o.city,
          companyId: o.companyId,
          defaultAnnualLeave: o.defaultAnnualLeave,
          defaultOfferedDays: o.defaultOfferedDays,
          minNoticeDays: o.minNoticeDays,
          maxCarryOverDays: o.maxCarryOverDays,
          carryOverDeadline: o.carryOverDeadline,
          probationMonths: o.probationMonths,
          sickLeaveJustifFromDay: o.sickLeaveJustifFromDay,
          workingDays: o.workingDays,
        });
        setOfficeInfo({ _count: o._count });
        setRules(o.exceptionalLeaveRules);
        setCompanies(data.companies);
      } else {
        addToast({ type: "error", title: lang === "en" ? "Office not found" : "Bureau non trouvé" });
        router.push("/admin/offices");
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setLoading(false);
    }
  }, [officeId, addToast, lang, router]);

  useEffect(() => {
    fetchOffice();
  }, [fetchOffice]);

  // ─── Save office ───

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.country.trim() || !form.city.trim()) {
      addToast({ type: "error", title: lang === "en" ? "Fill all required fields" : "Remplissez tous les champs obligatoires" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/offices/${officeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        addToast({ type: "success", title: lang === "en" ? "Office saved" : "Bureau enregistré" });
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Working days toggle ───

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day],
    }));
  };

  // ─── Exceptional rule handlers ───

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({ reason_fr: "", reason_en: "", maxDays: 1, isActive: true });
    setRuleModal(true);
  };

  const openEditRule = (rule: ExceptionalRule) => {
    setEditingRule(rule);
    setRuleForm({
      reason_fr: rule.reason_fr,
      reason_en: rule.reason_en,
      maxDays: rule.maxDays,
      isActive: rule.isActive,
    });
    setRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.reason_fr.trim() || !ruleForm.reason_en.trim() || ruleForm.maxDays < 1) {
      addToast({ type: "error", title: lang === "en" ? "Fill all fields" : "Remplissez tous les champs" });
      return;
    }

    setSavingRule(true);
    try {
      if (editingRule) {
        // PATCH
        const res = await fetch(`/api/admin/offices/${officeId}/exceptional-rules`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleId: editingRule.id, ...ruleForm }),
        });
        if (res.ok) {
          const updated = await res.json();
          setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          addToast({ type: "success", title: lang === "en" ? "Rule updated" : "Règle modifiée" });
          setRuleModal(false);
        } else {
          const err = await res.json();
          addToast({ type: "error", title: err.error || "Erreur" });
        }
      } else {
        // POST
        const res = await fetch(`/api/admin/offices/${officeId}/exceptional-rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ruleForm),
        });
        if (res.ok) {
          const created = await res.json();
          setRules((prev) => [...prev, created]);
          addToast({ type: "success", title: lang === "en" ? "Rule created" : "Règle créée" });
          setRuleModal(false);
        } else {
          const err = await res.json();
          addToast({ type: "error", title: err.error || "Erreur" });
        }
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRule) return;
    setSavingRule(true);
    try {
      const res = await fetch(`/api/admin/offices/${officeId}/exceptional-rules?ruleId=${deleteRule.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== deleteRule.id));
        addToast({ type: "success", title: lang === "en" ? "Rule deleted" : "Règle supprimée" });
        setDeleteRule(null);
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setSavingRule(false);
    }
  };

  // ─── Render ───

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back + Title */}
      <div>
        <button
          onClick={() => router.push("/admin/offices")}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "en" ? "Back to offices" : "Retour aux bureaux"}
        </button>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{form.name || "—"}</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {form.city}, {form.country}
              {officeInfo && (
                <span className="ml-3 text-gray-400">
                  {officeInfo._count.users} {lang === "en" ? "users" : "utilisateurs"} &middot; {officeInfo._count.teams} {lang === "en" ? "teams" : "équipes"}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Office Settings Form ─── */}
      <form onSubmit={handleSave}>
        <div className="space-y-6">
          {/* Identity */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">
              {lang === "en" ? "General Information" : "Informations générales"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Name *" : "Nom *"}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Country *" : "Pays *"}
                </label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "City *" : "Ville *"}
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>
            </div>
            {companies.length > 1 && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Company" : "Entreprise"}
                </label>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Leave parameters */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">
              {lang === "en" ? "Leave Parameters" : "Paramètres de congés"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Default annual leave (days)" : "Congés annuels par défaut (jours)"}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.defaultAnnualLeave}
                  onChange={(e) => setForm({ ...form, defaultAnnualLeave: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Default offered days" : "Congés offerts par défaut"}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.defaultOfferedDays}
                  onChange={(e) => setForm({ ...form, defaultOfferedDays: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-700">
                  {lang === "en" ? "Min notice days (warning)" : "Délai min. de préavis (warning)"}
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.minNoticeDays}
                  onChange={(e) => setForm({ ...form, minNoticeDays: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Max carry-over days" : "Max jours reportables"}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.maxCarryOverDays}
                  onChange={(e) => setForm({ ...form, maxCarryOverDays: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Carry-over deadline (MM-DD)" : "Date limite de report (MM-DD)"}
                </label>
                <input
                  type="text"
                  value={form.carryOverDeadline}
                  onChange={(e) => setForm({ ...form, carryOverDeadline: e.target.value })}
                  placeholder="03-31"
                  pattern="\d{2}-\d{2}"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Probation period (months)" : "Période d'essai (mois)"}
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.probationMonths}
                  onChange={(e) => setForm({ ...form, probationMonths: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Sick leave certificate from (days)" : "Justificatif maladie à partir de (jours)"}
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.sickLeaveJustifFromDay}
                  onChange={(e) => setForm({ ...form, sickLeaveJustifFromDay: Number(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
              </div>
            </div>
          </div>

          {/* Working days */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 uppercase tracking-wider">
              {lang === "en" ? "Working Days" : "Jours ouvrés"}
            </h2>
            <div className="flex flex-wrap gap-3">
              {ALL_DAYS.map((day) => {
                const active = form.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-[#1B3A5C] bg-[#1B3A5C] text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                    {dayLabels[day]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#15304D] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {lang === "en" ? "Save changes" : "Enregistrer les modifications"}
            </button>
          </div>
        </div>
      </form>

      {/* ─── Exceptional Leave Rules ─── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              {lang === "en" ? "Exceptional Leave Rules" : "Congés exceptionnels"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {lang === "en"
                ? `${rules.length} rule${rules.length > 1 ? "s" : ""}`
                : `${rules.length} règle${rules.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={openCreateRule}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B3A5C] px-3 py-2 text-xs font-medium text-white hover:bg-[#15304D] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === "en" ? "Add rule" : "Ajouter"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-6 py-3 font-semibold text-gray-700">
                  {lang === "en" ? "Reason (FR)" : "Raison (FR)"}
                </th>
                <th className="px-6 py-3 font-semibold text-gray-700">
                  {lang === "en" ? "Reason (EN)" : "Raison (EN)"}
                </th>
                <th className="px-6 py-3 font-semibold text-gray-700">
                  {lang === "en" ? "Max days" : "Max jours"}
                </th>
                <th className="px-6 py-3 font-semibold text-gray-700">
                  {lang === "en" ? "Status" : "Statut"}
                </th>
                <th className="px-6 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((rule) => (
                <tr key={rule.id} className={`hover:bg-gray-50 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}>
                  <td className="px-6 py-3 text-gray-900">{rule.reason_fr}</td>
                  <td className="px-6 py-3 text-gray-600">{rule.reason_en}</td>
                  <td className="px-6 py-3">
                    <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      {rule.maxDays} {lang === "en" ? "day" : "jour"}{rule.maxDays > 1 ? "s" : ""}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${rule.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                      {rule.isActive
                        ? lang === "en" ? "Active" : "Actif"
                        : lang === "en" ? "Inactive" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditRule(rule)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                        title={lang === "en" ? "Edit" : "Modifier"}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteRule(rule)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title={lang === "en" ? "Delete" : "Supprimer"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                    {lang === "en" ? "No exceptional leave rules" : "Aucune règle de congé exceptionnel"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Rule Create/Edit Modal ─── */}
      {ruleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRule
                  ? lang === "en" ? "Edit rule" : "Modifier la règle"
                  : lang === "en" ? "New exceptional leave rule" : "Nouvelle règle de congé exceptionnel"}
              </h2>
              <button onClick={() => setRuleModal(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSaveRule} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Reason (FR) *" : "Raison (FR) *"}
                </label>
                <input
                  type="text"
                  value={ruleForm.reason_fr}
                  onChange={(e) => setRuleForm({ ...ruleForm, reason_fr: e.target.value })}
                  placeholder="ex. Mariage"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Reason (EN) *" : "Raison (EN) *"}
                </label>
                <input
                  type="text"
                  value={ruleForm.reason_en}
                  onChange={(e) => setRuleForm({ ...ruleForm, reason_en: e.target.value })}
                  placeholder="e.g. Wedding"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "Max days *" : "Max jours *"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={ruleForm.maxDays}
                    onChange={(e) => setRuleForm({ ...ruleForm, maxDays: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "Status" : "Statut"}
                  </label>
                  <select
                    value={ruleForm.isActive ? "true" : "false"}
                    onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.value === "true" })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  >
                    <option value="true">{lang === "en" ? "Active" : "Actif"}</option>
                    <option value="false">{lang === "en" ? "Inactive" : "Inactif"}</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRuleModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {lang === "en" ? "Cancel" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304D] disabled:opacity-50 transition-colors"
                >
                  {savingRule && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingRule
                    ? lang === "en" ? "Save" : "Enregistrer"
                    : lang === "en" ? "Create" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Rule Confirm ─── */}
      {deleteRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mx-auto">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-center text-lg font-semibold text-gray-900">
              {lang === "en" ? "Delete rule?" : "Supprimer la règle ?"}
            </h3>
            <p className="mt-2 text-center text-sm text-gray-500">
              <strong>{deleteRule.reason_fr}</strong> / <strong>{deleteRule.reason_en}</strong>
              <br />
              {lang === "en" ? "This action cannot be undone." : "Cette action est irréversible."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setDeleteRule(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
              <button
                onClick={handleDeleteRule}
                disabled={savingRule}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {savingRule && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "en" ? "Delete" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
