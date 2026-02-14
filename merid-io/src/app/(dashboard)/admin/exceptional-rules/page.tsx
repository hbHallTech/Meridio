"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Scale, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";

interface OfficeOption {
  id: string;
  name: string;
}

interface ExceptionalRuleData {
  id: string;
  reason_fr: string;
  reason_en: string;
  maxDays: number;
  isActive: boolean;
  officeId: string;
  createdAt: string;
  office: { id: string; name: string } | null;
}

interface RuleFormData {
  officeId: string;
  reason_fr: string;
  reason_en: string;
  maxDays: number;
  isActive: boolean;
}

const defaultFormData: RuleFormData = {
  officeId: "",
  reason_fr: "",
  reason_en: "",
  maxDays: 1,
  isActive: true,
};

export default function AdminExceptionalRulesPage() {
  const { addToast } = useToast();
  const [rules, setRules] = useState<ExceptionalRuleData[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ExceptionalRuleData | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(defaultFormData);

  // Delete confirm state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<ExceptionalRuleData | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/exceptional-rules");
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setRules(data);
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur de chargement",
        message: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  const fetchOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/offices");
      if (!res.ok) throw new Error("Impossible de charger les bureaux");
      const data = await res.json();
      setOffices(data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur",
        message: e instanceof Error ? e.message : "Impossible de charger les bureaux",
      });
    }
  }, [addToast]);

  useEffect(() => {
    Promise.all([fetchRules(), fetchOffices()]).finally(() => setLoading(false));
  }, [fetchRules, fetchOffices]);

  const openCreateDialog = () => {
    setEditingRule(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: ExceptionalRuleData) => {
    setEditingRule(rule);
    setFormData({
      officeId: rule.officeId,
      reason_fr: rule.reason_fr,
      reason_en: rule.reason_en,
      maxDays: rule.maxDays,
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (rule: ExceptionalRuleData) => {
    setDeletingRule(rule);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.officeId || !formData.reason_fr || !formData.reason_en) {
      addToast({ type: "error", title: "Erreur", message: "Veuillez remplir tous les champs obligatoires" });
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!editingRule;
      const res = await fetch("/api/admin/exceptional-rules", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit ? { id: editingRule.id, ...formData } : formData
        ),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      addToast({
        type: "success",
        title: isEdit ? "Règle modifiée" : "Règle créée",
        message: isEdit
          ? "La règle a été mise à jour avec succès"
          : "La nouvelle règle a été créée avec succès",
      });

      setDialogOpen(false);
      await fetchRules();
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur",
        message: e instanceof Error ? e.message : "Erreur lors de la sauvegarde",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRule) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/exceptional-rules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingRule.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      addToast({
        type: "success",
        title: "Règle supprimée",
        message: "La règle a été supprimée avec succès",
      });

      setDeleteDialogOpen(false);
      setDeletingRule(null);
      await fetchRules();
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur",
        message: e instanceof Error ? e.message : "Erreur lors de la suppression",
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
          <h1 className="text-2xl font-bold text-gray-900">Règles exceptionnelles</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rules.length} règle{rules.length !== 1 ? "s" : ""} configurée{rules.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateDialog}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle règle
          </button>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
          >
            <Scale className="h-5 w-5" style={{ color: "#00BCD4" }} />
          </div>
        </div>
      </div>

      {/* Table */}
      {rules.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune règle exceptionnelle configurée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Motif FR</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Motif EN</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Jours max</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Statut</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {rule.reason_fr}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">{rule.reason_en}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: "rgba(27,58,92,0.1)", color: "#1B3A5C" }}
                      >
                        {rule.maxDays}j
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {rule.office?.name ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {rule.isActive ? (
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
                          onClick={() => openEditDialog(rule)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(rule)}
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
        title={editingRule ? "Modifier la règle" : "Nouvelle règle"}
        description={editingRule ? "Modifier les informations de la règle exceptionnelle" : "Créer une nouvelle règle de congé exceptionnel"}
      >
        <div className="space-y-4">
          {/* Bureau */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Bureau</label>
            <select
              value={formData.officeId}
              onChange={(e) => setFormData({ ...formData, officeId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            >
              <option value="">Sélectionner un bureau</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
          </div>

          {/* Motif FR */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Motif FR</label>
            <input
              type="text"
              value={formData.reason_fr}
              onChange={(e) => setFormData({ ...formData, reason_fr: e.target.value })}
              placeholder="Ex: Mariage"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          {/* Motif EN */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Motif EN</label>
            <input
              type="text"
              value={formData.reason_en}
              onChange={(e) => setFormData({ ...formData, reason_en: e.target.value })}
              placeholder="Ex: Wedding"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          {/* Jours max */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Jours max</label>
            <input
              type="number"
              min={1}
              value={formData.maxDays}
              onChange={(e) => setFormData({ ...formData, maxDays: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          {/* Actif toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#00BCD4] peer-checked:after:translate-x-full peer-checked:after:border-white" />
            </label>
            <span className="text-sm font-medium text-gray-700">Actif</span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
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
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingRule ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingRule(null);
        }}
        onConfirm={handleDelete}
        title="Supprimer la règle"
        message={`Voulez-vous vraiment supprimer la règle "${deletingRule?.reason_fr}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}
