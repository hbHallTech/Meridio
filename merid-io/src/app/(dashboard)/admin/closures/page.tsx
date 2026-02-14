"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";

interface OfficeData {
  id: string;
  name: string;
}

interface ClosureData {
  id: string;
  officeId: string;
  startDate: string;
  endDate: string;
  reason_fr: string;
  reason_en: string | null;
  year: number;
  office: OfficeData | null;
}

interface FormData {
  officeId: string;
  reason_fr: string;
  reason_en: string;
  startDate: string;
  endDate: string;
}

const defaultForm: FormData = {
  officeId: "",
  reason_fr: "",
  reason_en: "",
  startDate: "",
  endDate: "",
};

export default function AdminClosuresPage() {
  const { addToast } = useToast();
  const [closures, setClosures] = useState<ClosureData[]>([]);
  const [offices, setOffices] = useState<OfficeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClosureData | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ClosureData | null>(null);

  const fetchClosures = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/closures");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setClosures(data);
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les fermetures" });
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
    Promise.all([fetchClosures(), fetchOffices()]).finally(() => setLoading(false));
  }, [fetchClosures, fetchOffices]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (item: ClosureData) => {
    setEditingItem(item);
    setForm({
      officeId: item.officeId,
      reason_fr: item.reason_fr,
      reason_en: item.reason_en || "",
      startDate: new Date(item.startDate).toISOString().split("T")[0],
      endDate: new Date(item.endDate).toISOString().split("T")[0],
    });
    setDialogOpen(true);
  };

  const openDelete = (item: ClosureData) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...(editingItem ? { id: editingItem.id } : {}),
        officeId: form.officeId,
        reason_fr: form.reason_fr,
        reason_en: form.reason_en || null,
        startDate: form.startDate,
        endDate: form.endDate,
      };

      const res = await fetch("/api/admin/closures", {
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
        title: editingItem ? "Fermeture modifiée" : "Fermeture créée",
        message: `La fermeture "${form.reason_fr}" a été ${editingItem ? "modifiée" : "créée"} avec succès`,
      });
      setDialogOpen(false);
      await fetchClosures();
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
      const res = await fetch("/api/admin/closures", {
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
        title: "Fermeture supprimée",
        message: `La fermeture "${deletingItem.reason_fr}" a été supprimée`,
      });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      await fetchClosures();
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
          <h1 className="text-2xl font-bold text-gray-900">Fermetures d&apos;entreprise</h1>
          <p className="mt-1 text-sm text-gray-500">
            {closures.length} fermeture{closures.length !== 1 ? "s" : ""} enregistrée{closures.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-[#1B3A5C] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#15304d] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvelle fermeture
        </button>
      </div>

      {/* Table */}
      {closures.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune fermeture enregistrée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Motif FR</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Date début</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Date fin</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Année</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {closures.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{c.office?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">{c.reason_fr}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(c.startDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(c.endDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: "rgba(0,188,212,0.1)", color: "#00BCD4" }}
                      >
                        {c.year}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDelete(c)}
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
        title={editingItem ? "Modifier la fermeture" : "Nouvelle fermeture"}
        maxWidth="md"
      >
        <div className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif FR *</label>
              <input
                type="text"
                value={form.reason_fr}
                onChange={(e) => setForm({ ...form, reason_fr: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
                placeholder="ex: Fermeture annuelle"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motif EN</label>
              <input
                type="text"
                value={form.reason_en}
                onChange={(e) => setForm({ ...form, reason_en: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
                placeholder="ex: Annual closure"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date début *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date fin *</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
              />
            </div>
          </div>

          {form.startDate && (
            <p className="text-xs text-gray-500">
              Année calculée automatiquement : <span className="font-semibold">{new Date(form.startDate).getFullYear()}</span>
            </p>
          )}

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
        title="Supprimer la fermeture"
        message={`Êtes-vous sûr de vouloir supprimer la fermeture "${deletingItem?.reason_fr}" (${deletingItem ? new Date(deletingItem.startDate).toLocaleDateString("fr-FR") : ""} - ${deletingItem ? new Date(deletingItem.endDate).toLocaleDateString("fr-FR") : ""}) ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}
