"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  Plus,
  X,
  Pencil,
  Trash2,
  Shield,
  Calendar,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface ExceptionalRule {
  id: string;
  officeId: string;
  reason_fr: string;
  reason_en: string;
  maxDays: number;
  isActive: boolean;
}

interface OfficeOption {
  id: string;
  name: string;
  city: string;
}

export default function AdminExceptionalRulesPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = (session?.user?.language ?? "fr") as "fr" | "en";

  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [selectedOffice, setSelectedOffice] = useState("");
  const [rules, setRules] = useState<ExceptionalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExceptionalRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    reason_fr: "",
    reason_en: "",
    maxDays: "1",
    isActive: true,
  });

  // Fetch offices list
  const fetchOffices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/offices");
      if (res.ok) {
        const data = await res.json();
        setOffices(data.offices.map((o: { id: string; name: string; city: string }) => ({
          id: o.id,
          name: o.name,
          city: o.city,
        })));
        if (data.offices.length > 0 && !selectedOffice) {
          setSelectedOffice(data.offices[0].id);
        }
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Loading error" : "Erreur de chargement" });
    } finally {
      setLoading(false);
    }
  }, [addToast, lang, selectedOffice]);

  // Fetch rules for selected office
  const fetchRules = useCallback(async () => {
    if (!selectedOffice) return;
    setLoadingRules(true);
    try {
      const res = await fetch(`/api/admin/offices/${selectedOffice}/exceptional-rules`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Loading error" : "Erreur de chargement" });
    } finally {
      setLoadingRules(false);
    }
  }, [selectedOffice, addToast, lang]);

  useEffect(() => {
    fetchOffices();
  }, [fetchOffices]);

  useEffect(() => {
    if (selectedOffice) {
      fetchRules();
    }
  }, [selectedOffice, fetchRules]);

  const openCreate = () => {
    setEditing(null);
    setForm({ reason_fr: "", reason_en: "", maxDays: "1", isActive: true });
    setModalOpen(true);
  };

  const openEdit = (rule: ExceptionalRule) => {
    setEditing(rule);
    setForm({
      reason_fr: rule.reason_fr,
      reason_en: rule.reason_en,
      maxDays: rule.maxDays.toString(),
      isActive: rule.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason_fr.trim() || !form.reason_en.trim() || !form.maxDays) {
      addToast({ type: "error", title: lang === "en" ? "Fill all required fields" : "Remplissez les champs obligatoires" });
      return;
    }

    setSaving(true);
    try {
      const body = editing
        ? {
            ruleId: editing.id,
            reason_fr: form.reason_fr,
            reason_en: form.reason_en,
            maxDays: Number(form.maxDays),
            isActive: form.isActive,
          }
        : {
            reason_fr: form.reason_fr,
            reason_en: form.reason_en,
            maxDays: Number(form.maxDays),
            isActive: form.isActive,
          };

      const res = await fetch(`/api/admin/offices/${selectedOffice}/exceptional-rules`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addToast({
          type: "success",
          title: lang === "en"
            ? (editing ? "Rule updated" : "Rule created")
            : (editing ? "Règle mise à jour" : "Règle créée"),
        });
        setModalOpen(false);
        fetchRules();
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

  const handleDelete = async (rule: ExceptionalRule) => {
    if (!confirm(lang === "en" ? "Delete this rule?" : "Supprimer cette règle ?")) return;
    try {
      const res = await fetch(
        `/api/admin/offices/${selectedOffice}/exceptional-rules?ruleId=${rule.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        addToast({ type: "success", title: lang === "en" ? "Rule deleted" : "Règle supprimée" });
        fetchRules();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    }
  };

  const toggleActive = async (rule: ExceptionalRule) => {
    try {
      const res = await fetch(`/api/admin/offices/${selectedOffice}/exceptional-rules`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: rule.id, isActive: !rule.isActive }),
      });
      if (res.ok) {
        addToast({
          type: "success",
          title: !rule.isActive
            ? (lang === "en" ? "Activated" : "Activé")
            : (lang === "en" ? "Deactivated" : "Désactivé"),
        });
        fetchRules();
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Exceptional Leave Rules" : "Règles de congé exceptionnel"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? "Manage exceptional leave reasons by office"
              : "Gérer les raisons de congé exceptionnel par bureau"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedOffice}
            onChange={(e) => setSelectedOffice(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          >
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <button
            onClick={openCreate}
            disabled={!selectedOffice}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#15304D] disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {lang === "en" ? "New rule" : "Nouvelle règle"}
          </button>
        </div>
      </div>

      {/* Rules table */}
      {loadingRules ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : rules.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                <th className="px-6 py-3">{lang === "en" ? "Reason FR" : "Raison FR"}</th>
                <th className="px-6 py-3">{lang === "en" ? "Reason EN" : "Raison EN"}</th>
                <th className="px-6 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {lang === "en" ? "Max days" : "Max jours"}
                  </div>
                </th>
                <th className="px-6 py-3 text-center">{lang === "en" ? "Status" : "Statut"}</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-900">{rule.reason_fr}</td>
                  <td className="px-6 py-3 text-gray-600">{rule.reason_en}</td>
                  <td className="px-6 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      {rule.maxDays} {lang === "en" ? "day" : "jour"}{rule.maxDays > 1 ? "s" : ""}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <button onClick={() => toggleActive(rule)}>
                      {rule.isActive ? (
                        <ToggleRight className="mx-auto h-5 w-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="mx-auto h-5 w-5 text-gray-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(rule)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B3A5C] transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Shield className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-gray-500">
            {lang === "en"
              ? "No exceptional leave rules for this office"
              : "Aucune règle de congé exceptionnel pour ce bureau"}
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304D] transition-colors"
          >
            <Plus className="h-4 w-4" />
            {lang === "en" ? "Add first rule" : "Ajouter la première règle"}
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing
                  ? (lang === "en" ? "Edit rule" : "Modifier la règle")
                  : (lang === "en" ? "New exceptional rule" : "Nouvelle règle exceptionnelle")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 px-6 py-5">
              {/* Reason FR */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Reason (French) *" : "Raison (Français) *"}
                </label>
                <input
                  type="text"
                  value={form.reason_fr}
                  onChange={(e) => setForm({ ...form, reason_fr: e.target.value })}
                  placeholder={lang === "en" ? "e.g. Wedding" : "ex. Mariage"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>

              {/* Reason EN */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Reason (English) *" : "Raison (Anglais) *"}
                </label>
                <input
                  type="text"
                  value={form.reason_en}
                  onChange={(e) => setForm({ ...form, reason_en: e.target.value })}
                  placeholder="Wedding"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>

              {/* Max Days */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Maximum days *" : "Nombre de jours max *"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.maxDays}
                  onChange={(e) => setForm({ ...form, maxDays: e.target.value })}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>

              {/* Active */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  {lang === "en" ? "Active" : "Actif"}
                </span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {lang === "en" ? "Cancel" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304D] disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {lang === "en" ? "Save" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
