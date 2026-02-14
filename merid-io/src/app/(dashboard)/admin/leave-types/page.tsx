"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";

interface OfficeData {
  id: string;
  name: string;
}

interface LeaveTypeData {
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
  office: OfficeData | null;
}

interface FormData {
  code: string;
  label_fr: string;
  label_en: string;
  officeId: string;
  color: string;
  deductsFromBalance: boolean;
  balanceType: string;
  requiresAttachment: boolean;
  attachmentFromDay: string;
  isActive: boolean;
}

const defaultForm: FormData = {
  code: "",
  label_fr: "",
  label_en: "",
  officeId: "",
  color: "#3B82F6",
  deductsFromBalance: true,
  balanceType: "ANNUAL",
  requiresAttachment: false,
  attachmentFromDay: "",
  isActive: true,
};

export default function AdminLeaveTypesPage() {
  const { addToast } = useToast();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeData[]>([]);
  const [offices, setOffices] = useState<OfficeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LeaveTypeData | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<LeaveTypeData | null>(null);

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/leave-types");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setLeaveTypes(data);
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les types de congé" });
    }
  }, [addToast]);

  const fetchOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/offices");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setOffices(data.map((o: OfficeData & Record<string, unknown>) => ({ id: o.id, name: o.name })));
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les bureaux" });
    }
  }, [addToast]);

  useEffect(() => {
    Promise.all([fetchLeaveTypes(), fetchOffices()]).finally(() => setLoading(false));
  }, [fetchLeaveTypes, fetchOffices]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (item: LeaveTypeData) => {
    setEditingItem(item);
    setForm({
      code: item.code,
      label_fr: item.label_fr,
      label_en: item.label_en,
      officeId: item.officeId,
      color: item.color,
      deductsFromBalance: item.deductsFromBalance,
      balanceType: item.balanceType || "",
      requiresAttachment: item.requiresAttachment,
      attachmentFromDay: item.attachmentFromDay?.toString() || "",
      isActive: item.isActive,
    });
    setDialogOpen(true);
  };

  const openDelete = (item: LeaveTypeData) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...(editingItem ? { id: editingItem.id } : {}),
        code: form.code,
        label_fr: form.label_fr,
        label_en: form.label_en,
        officeId: form.officeId,
        color: form.color,
        deductsFromBalance: form.deductsFromBalance,
        balanceType: form.deductsFromBalance ? form.balanceType : null,
        requiresAttachment: form.requiresAttachment,
        attachmentFromDay: form.requiresAttachment && form.attachmentFromDay ? Number(form.attachmentFromDay) : null,
        isActive: form.isActive,
      };

      const res = await fetch("/api/admin/leave-types", {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(err.error || "Erreur serveur");
      }

      addToast({
        type: "success",
        title: editingItem ? "Type de congé modifié" : "Type de congé créé",
        message: `Le type "${form.code}" a été ${editingItem ? "modifié" : "créé"} avec succès`,
      });
      setDialogOpen(false);
      await fetchLeaveTypes();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/leave-types", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingItem.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(err.error || "Erreur serveur");
      }

      addToast({
        type: "success",
        title: "Type de congé supprimé",
        message: `Le type "${deletingItem.code}" a été supprimé`,
      });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      await fetchLeaveTypes();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Types de congé</h1>
          <p className="mt-1 text-sm text-gray-500">
            {leaveTypes.length} type{leaveTypes.length !== 1 ? "s" : ""} configuré{leaveTypes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-[#1B3A5C] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#15304d] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau type de congé
        </button>
      </div>

      {/* Table */}
      {leaveTypes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun type de congé configuré.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Code</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Libellé FR</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Couleur</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Déduit solde</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Justificatif</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Statut</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaveTypes.map((lt) => (
                  <tr key={lt.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{lt.code}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{lt.label_fr}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{lt.office?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-full border border-gray-200"
                          style={{ backgroundColor: lt.color }}
                        />
                        <span className="text-xs text-gray-500">{lt.color}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {lt.deductsFromBalance ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          Oui
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                          Non
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {lt.requiresAttachment ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          Requis
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                          Non
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {lt.isActive ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(lt)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDelete(lt)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Supprimer"
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
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingItem ? "Modifier le type de congé" : "Nouveau type de congé"}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
                placeholder="ex: ANNUAL, SICK..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bureau *</label>
              <select
                value={form.officeId}
                onChange={(e) => setForm({ ...form, officeId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
              >
                <option value="">Sélectionner un bureau</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Libellé FR *</label>
              <input
                type="text"
                value={form.label_fr}
                onChange={(e) => setForm({ ...form, label_fr: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
                placeholder="ex: Congé annuel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Libellé EN *</label>
              <input
                type="text"
                value={form.label_en}
                onChange={(e) => setForm({ ...form, label_en: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
                placeholder="ex: Annual leave"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded border border-gray-300"
              />
              <span className="text-sm text-gray-500">{form.color}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.deductsFromBalance}
                onChange={(e) => setForm({ ...form, deductsFromBalance: e.target.checked, balanceType: e.target.checked ? form.balanceType || "ANNUAL" : "" })}
                className="h-4 w-4 rounded border-gray-300 text-[#00BCD4] focus:ring-[#00BCD4]"
              />
              <span className="text-sm text-gray-700">Déduit du solde</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requiresAttachment}
                onChange={(e) => setForm({ ...form, requiresAttachment: e.target.checked, attachmentFromDay: e.target.checked ? form.attachmentFromDay : "" })}
                className="h-4 w-4 rounded border-gray-300 text-[#00BCD4] focus:ring-[#00BCD4]"
              />
              <span className="text-sm text-gray-700">Justificatif requis</span>
            </label>
          </div>

          {form.deductsFromBalance && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de solde</label>
              <select
                value={form.balanceType}
                onChange={(e) => setForm({ ...form, balanceType: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
              >
                <option value="ANNUAL">Annuel</option>
                <option value="OFFERED">Offert</option>
              </select>
            </div>
          )}

          {form.requiresAttachment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Justificatif à partir du jour</label>
              <input
                type="number"
                min="1"
                value={form.attachmentFromDay}
                onChange={(e) => setForm({ ...form, attachmentFromDay: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
                placeholder="ex: 2"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  form.isActive ? "bg-[#00BCD4]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </div>
              <span className="text-sm text-gray-700">Actif</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingItem ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingItem(null); }}
        onConfirm={handleDelete}
        title="Supprimer le type de congé"
        message={`Êtes-vous sûr de vouloir supprimer le type "${deletingItem?.code}" (${deletingItem?.label_fr}) ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}
