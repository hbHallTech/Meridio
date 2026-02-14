"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, ArrowRightLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

interface DelegationData {
  id: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  fromUser: { id: string; firstName: string; lastName: string; email: string };
  toUser: { id: string; firstName: string; lastName: string; email: string };
}

interface DelegationFormData {
  fromUserId: string;
  toUserId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const defaultFormData: DelegationFormData = {
  fromUserId: "",
  toUserId: "",
  startDate: "",
  endDate: "",
  isActive: true,
};

export default function AdminDelegationsPage() {
  const { addToast } = useToast();
  const [delegations, setDelegations] = useState<DelegationData[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDelegation, setEditingDelegation] = useState<DelegationData | null>(null);
  const [formData, setFormData] = useState<DelegationFormData>(defaultFormData);

  // Delete confirm state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDelegation, setDeletingDelegation] = useState<DelegationData | null>(null);

  const fetchDelegations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/delegations");
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setDelegations(data);
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur de chargement",
        message: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Impossible de charger les utilisateurs");
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur",
        message: e instanceof Error ? e.message : "Impossible de charger les utilisateurs",
      });
    }
  }, [addToast]);

  useEffect(() => {
    Promise.all([fetchDelegations(), fetchUsers()]).finally(() => setLoading(false));
  }, [fetchDelegations, fetchUsers]);

  const managers = users.filter((u) => u.roles.includes("MANAGER"));

  const openCreateDialog = () => {
    setEditingDelegation(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (delegation: DelegationData) => {
    setEditingDelegation(delegation);
    setFormData({
      fromUserId: delegation.fromUser.id,
      toUserId: delegation.toUser.id,
      startDate: delegation.startDate.slice(0, 10),
      endDate: delegation.endDate.slice(0, 10),
      isActive: delegation.isActive,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (delegation: DelegationData) => {
    setDeletingDelegation(delegation);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    const isEdit = !!editingDelegation;

    if (!isEdit) {
      if (!formData.fromUserId || !formData.toUserId || !formData.startDate || !formData.endDate) {
        addToast({ type: "error", title: "Erreur", message: "Veuillez remplir tous les champs obligatoires" });
        return;
      }
      if (formData.fromUserId === formData.toUserId) {
        addToast({ type: "error", title: "Erreur", message: "Le délégant et le délégataire doivent être différents" });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = isEdit
        ? {
            id: editingDelegation.id,
            startDate: formData.startDate,
            endDate: formData.endDate,
            isActive: formData.isActive,
          }
        : {
            fromUserId: formData.fromUserId,
            toUserId: formData.toUserId,
            startDate: formData.startDate,
            endDate: formData.endDate,
          };

      const res = await fetch("/api/admin/delegations", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      addToast({
        type: "success",
        title: isEdit ? "Délégation modifiée" : "Délégation créée",
        message: isEdit
          ? "La délégation a été mise à jour avec succès"
          : "La nouvelle délégation a été créée avec succès",
      });

      setDialogOpen(false);
      await fetchDelegations();
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
    if (!deletingDelegation) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delegations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingDelegation.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      addToast({
        type: "success",
        title: "Délégation supprimée",
        message: "La délégation a été supprimée avec succès",
      });

      setDeleteDialogOpen(false);
      setDeletingDelegation(null);
      await fetchDelegations();
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
          <h1 className="text-2xl font-bold text-gray-900">Délégations</h1>
          <p className="mt-1 text-sm text-gray-500">
            {delegations.length} délégation{delegations.length !== 1 ? "s" : ""} enregistrée{delegations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateDialog}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle délégation
          </button>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
          >
            <ArrowRightLeft className="h-5 w-5" style={{ color: "#00BCD4" }} />
          </div>
        </div>
      </div>

      {/* Table */}
      {delegations.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune délégation enregistrée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">De</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Vers</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Date début</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Date fin</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Statut</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {delegations.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {d.fromUser.firstName} {d.fromUser.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{d.fromUser.email}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {d.toUser.firstName} {d.toUser.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{d.toUser.email}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(d.startDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(d.endDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {d.isActive ? (
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
                          onClick={() => openEditDialog(d)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(d)}
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
        title={editingDelegation ? "Modifier la délégation" : "Nouvelle délégation"}
        description={editingDelegation ? "Modifier les informations de la délégation" : "Créer une nouvelle délégation de responsabilité"}
      >
        <div className="space-y-4">
          {/* Manager source (fromUser) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Manager source</label>
            <select
              value={formData.fromUserId}
              onChange={(e) => setFormData({ ...formData, fromUserId: e.target.value })}
              disabled={!!editingDelegation}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4] disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">Sélectionner un manager</option>
              {managers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Délégataire (toUser) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Délégataire</label>
            <select
              value={formData.toUserId}
              onChange={(e) => setFormData({ ...formData, toUserId: e.target.value })}
              disabled={!!editingDelegation}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4] disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">Sélectionner un utilisateur</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Date début */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Date début</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          {/* Date fin */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Date fin</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          {/* Actif toggle (edit only) */}
          {editingDelegation && (
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
          )}

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
              {editingDelegation ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingDelegation(null);
        }}
        onConfirm={handleDelete}
        title="Supprimer la délégation"
        message={`Voulez-vous vraiment supprimer la délégation de ${deletingDelegation?.fromUser.firstName} ${deletingDelegation?.fromUser.lastName} vers ${deletingDelegation?.toUser.firstName} ${deletingDelegation?.toUser.lastName} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}
