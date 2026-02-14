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
  Tags,
  Paperclip,
  Wallet,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface LeaveTypeRow {
  id: string;
  officeId: string;
  code: string;
  label_fr: string;
  label_en: string;
  requiresAttachment: boolean;
  attachmentFromDay: number | null;
  deductsFromBalance: boolean;
  balanceType: string | null;
  isActive: boolean;
  color: string;
  office: { id: string; name: string; city: string };
}

interface OfficeOption {
  id: string;
  name: string;
  city: string;
}

const BALANCE_TYPES = [
  { value: "", label_fr: "Aucun", label_en: "None" },
  { value: "ANNUAL", label_fr: "Congés annuels", label_en: "Annual leave" },
  { value: "OFFERED", label_fr: "Jours offerts", label_en: "Offered days" },
];

const DEFAULT_CODES = [
  { code: "ANNUAL", label_fr: "Congé annuel", label_en: "Annual leave" },
  { code: "OFFERED", label_fr: "Jours offerts", label_en: "Offered days" },
  { code: "SICK", label_fr: "Maladie", label_en: "Sick leave" },
  { code: "UNPAID", label_fr: "Sans solde", label_en: "Unpaid leave" },
  { code: "MATERNITY", label_fr: "Maternité", label_en: "Maternity leave" },
  { code: "PATERNITY", label_fr: "Paternité", label_en: "Paternity leave" },
  { code: "EXCEPTIONAL", label_fr: "Congé exceptionnel", label_en: "Exceptional leave" },
  { code: "TELEWORK", label_fr: "Télétravail", label_en: "Telework" },
];

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

export default function AdminLeaveTypesPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = (session?.user?.language ?? "fr") as "fr" | "en";

  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOffice, setFilterOffice] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    officeId: "",
    code: "",
    label_fr: "",
    label_en: "",
    requiresAttachment: false,
    attachmentFromDay: "",
    deductsFromBalance: true,
    balanceType: "",
    color: "#3B82F6",
    isActive: true,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterOffice
        ? `/api/admin/leave-types?officeId=${filterOffice}`
        : "/api/admin/leave-types";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLeaveTypes(data.leaveTypes);
        setOffices(data.offices);
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Loading error" : "Erreur de chargement" });
    } finally {
      setLoading(false);
    }
  }, [addToast, lang, filterOffice]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      officeId: filterOffice || "",
      code: "",
      label_fr: "",
      label_en: "",
      requiresAttachment: false,
      attachmentFromDay: "",
      deductsFromBalance: true,
      balanceType: "",
      color: "#3B82F6",
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (lt: LeaveTypeRow) => {
    setEditing(lt);
    setForm({
      officeId: lt.officeId,
      code: lt.code,
      label_fr: lt.label_fr,
      label_en: lt.label_en,
      requiresAttachment: lt.requiresAttachment,
      attachmentFromDay: lt.attachmentFromDay?.toString() ?? "",
      deductsFromBalance: lt.deductsFromBalance,
      balanceType: lt.balanceType ?? "",
      color: lt.color,
      isActive: lt.isActive,
    });
    setModalOpen(true);
  };

  const handleCodeSelect = (code: string) => {
    const preset = DEFAULT_CODES.find((c) => c.code === code);
    if (preset) {
      setForm({ ...form, code, label_fr: preset.label_fr, label_en: preset.label_en });
    } else {
      setForm({ ...form, code });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.officeId || !form.code.trim() || !form.label_fr.trim() || !form.label_en.trim()) {
      addToast({ type: "error", title: lang === "en" ? "Fill all required fields" : "Remplissez les champs obligatoires" });
      return;
    }

    setSaving(true);
    try {
      const body = editing
        ? {
            leaveTypeId: editing.id,
            label_fr: form.label_fr,
            label_en: form.label_en,
            requiresAttachment: form.requiresAttachment,
            attachmentFromDay: form.attachmentFromDay ? Number(form.attachmentFromDay) : null,
            deductsFromBalance: form.deductsFromBalance,
            balanceType: form.balanceType || null,
            color: form.color,
            isActive: form.isActive,
          }
        : {
            officeId: form.officeId,
            code: form.code.trim().toUpperCase(),
            label_fr: form.label_fr,
            label_en: form.label_en,
            requiresAttachment: form.requiresAttachment,
            attachmentFromDay: form.attachmentFromDay ? Number(form.attachmentFromDay) : null,
            deductsFromBalance: form.deductsFromBalance,
            balanceType: form.balanceType || null,
            color: form.color,
            isActive: form.isActive,
          };

      const res = await fetch("/api/admin/leave-types", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addToast({
          type: "success",
          title: lang === "en"
            ? (editing ? "Leave type updated" : "Leave type created")
            : (editing ? "Type de congé mis à jour" : "Type de congé créé"),
        });
        setModalOpen(false);
        fetchData();
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

  const handleDelete = async (lt: LeaveTypeRow) => {
    if (!confirm(lang === "en" ? "Delete this leave type?" : "Supprimer ce type de congé ?")) return;
    try {
      const res = await fetch(`/api/admin/leave-types?leaveTypeId=${lt.id}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        addToast({
          type: "success",
          title: data.softDeleted
            ? (lang === "en" ? "Leave type deactivated (in use)" : "Type désactivé (en usage)")
            : (lang === "en" ? "Leave type deleted" : "Type de congé supprimé"),
        });
        fetchData();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    }
  };

  const toggleActive = async (lt: LeaveTypeRow) => {
    try {
      const res = await fetch("/api/admin/leave-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveTypeId: lt.id, isActive: !lt.isActive }),
      });
      if (res.ok) {
        addToast({
          type: "success",
          title: !lt.isActive
            ? (lang === "en" ? "Activated" : "Activé")
            : (lang === "en" ? "Deactivated" : "Désactivé"),
        });
        fetchData();
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    }
  };

  // Group by office
  const grouped = leaveTypes.reduce<Record<string, { office: OfficeOption; types: LeaveTypeRow[] }>>((acc, lt) => {
    if (!acc[lt.officeId]) {
      acc[lt.officeId] = { office: lt.office, types: [] };
    }
    acc[lt.officeId].types.push(lt);
    return acc;
  }, {});

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
            {lang === "en" ? "Leave Types" : "Types de congé"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? `${leaveTypes.length} type${leaveTypes.length > 1 ? "s" : ""} configured`
              : `${leaveTypes.length} type${leaveTypes.length > 1 ? "s" : ""} configuré${leaveTypes.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterOffice}
            onChange={(e) => setFilterOffice(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          >
            <option value="">{lang === "en" ? "All offices" : "Tous les bureaux"}</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#15304D] transition-colors"
          >
            <Plus className="h-4 w-4" />
            {lang === "en" ? "New type" : "Nouveau type"}
          </button>
        </div>
      </div>

      {/* Tables grouped by office */}
      {Object.entries(grouped).map(([officeId, { office, types }]) => (
        <div key={officeId} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-3">
            <h2 className="font-semibold text-gray-900">{office.name}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-3">{lang === "en" ? "Color" : "Couleur"}</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">{lang === "en" ? "Label FR" : "Libellé FR"}</th>
                  <th className="px-6 py-3">{lang === "en" ? "Label EN" : "Libellé EN"}</th>
                  <th className="px-6 py-3 text-center">
                    <Paperclip className="mx-auto h-3.5 w-3.5" />
                  </th>
                  <th className="px-6 py-3 text-center">
                    <Wallet className="mx-auto h-3.5 w-3.5" />
                  </th>
                  <th className="px-6 py-3">{lang === "en" ? "Balance" : "Solde"}</th>
                  <th className="px-6 py-3 text-center">{lang === "en" ? "Status" : "Statut"}</th>
                  <th className="px-6 py-3 text-right">{lang === "en" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {types.map((lt) => (
                  <tr key={lt.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="h-5 w-5 rounded-full border border-gray-200" style={{ backgroundColor: lt.color }} />
                    </td>
                    <td className="px-6 py-3">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-700">
                        {lt.code}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900">{lt.label_fr}</td>
                    <td className="px-6 py-3 text-gray-600">{lt.label_en}</td>
                    <td className="px-6 py-3 text-center">
                      {lt.requiresAttachment ? (
                        <span className="text-amber-500" title={lt.attachmentFromDay ? `${lang === "en" ? "From day" : "À partir de"} ${lt.attachmentFromDay}` : ""}>
                          {lt.attachmentFromDay ? `J${lt.attachmentFromDay}+` : "Yes" }
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {lt.deductsFromBalance ? (
                        <span className="text-green-600">
                          {lang === "en" ? "Yes" : "Oui"}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-500 text-xs">
                      {lt.balanceType
                        ? BALANCE_TYPES.find((b) => b.value === lt.balanceType)?.[`label_${lang}`] ?? lt.balanceType
                        : "—"}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => toggleActive(lt)}
                        title={lt.isActive ? (lang === "en" ? "Active" : "Actif") : (lang === "en" ? "Inactive" : "Inactif")}
                      >
                        {lt.isActive ? (
                          <ToggleRight className="mx-auto h-5 w-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="mx-auto h-5 w-5 text-gray-300" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(lt)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B3A5C] transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(lt)}
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
        </div>
      ))}

      {leaveTypes.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Tags className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-gray-500">
            {lang === "en" ? "No leave types configured" : "Aucun type de congé configuré"}
          </p>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing
                  ? (lang === "en" ? "Edit leave type" : "Modifier le type de congé")
                  : (lang === "en" ? "New leave type" : "Nouveau type de congé")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 px-6 py-5">
              {/* Office */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Office *" : "Bureau *"}
                </label>
                <select
                  value={form.officeId}
                  onChange={(e) => setForm({ ...form, officeId: e.target.value })}
                  disabled={!!editing}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C] disabled:bg-gray-50"
                  required
                >
                  <option value="">{lang === "en" ? "Select…" : "Sélectionner…"}</option>
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              {/* Code */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Code *</label>
                {!editing ? (
                  <div>
                    <select
                      value={form.code}
                      onChange={(e) => handleCodeSelect(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                      required
                    >
                      <option value="">{lang === "en" ? "Select or type…" : "Sélectionner…"}</option>
                      {DEFAULT_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {lang === "en" ? c.label_en : c.label_fr}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      placeholder={lang === "en" ? "Or enter a custom code" : "Ou entrez un code personnalisé"}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={form.code}
                    disabled
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                  />
                )}
              </div>

              {/* Labels */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "Label FR *" : "Libellé FR *"}
                  </label>
                  <input
                    type="text"
                    value={form.label_fr}
                    onChange={(e) => setForm({ ...form, label_fr: e.target.value })}
                    placeholder="Congé annuel"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "Label EN *" : "Libellé EN *"}
                  </label>
                  <input
                    type="text"
                    value={form.label_en}
                    onChange={(e) => setForm({ ...form, label_en: e.target.value })}
                    placeholder="Annual leave"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    required
                  />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Color" : "Couleur"}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`h-7 w-7 rounded-full border-2 transition-transform ${
                        form.color === c ? "border-gray-800 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-7 w-7 cursor-pointer rounded border-0"
                  />
                </div>
              </div>

              {/* Attachment */}
              <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.requiresAttachment}
                    onChange={(e) => setForm({ ...form, requiresAttachment: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {lang === "en" ? "Requires attachment" : "Nécessite pièce jointe"}
                  </span>
                </label>
                {form.requiresAttachment && (
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">
                      {lang === "en" ? "Starting from day (optional)" : "À partir de X jours (optionnel)"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.attachmentFromDay}
                      onChange={(e) => setForm({ ...form, attachmentFromDay: e.target.value })}
                      placeholder="2"
                      className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1B3A5C] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Balance */}
              <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.deductsFromBalance}
                    onChange={(e) => setForm({ ...form, deductsFromBalance: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {lang === "en" ? "Deducts from balance" : "Déduit du solde"}
                  </span>
                </label>
                {form.deductsFromBalance && (
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">
                      {lang === "en" ? "Balance type" : "Type de solde"}
                    </label>
                    <select
                      value={form.balanceType}
                      onChange={(e) => setForm({ ...form, balanceType: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1B3A5C] focus:outline-none"
                    >
                      {BALANCE_TYPES.map((bt) => (
                        <option key={bt.value} value={bt.value}>
                          {lang === "en" ? bt.label_en : bt.label_fr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
