"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import { Loader2, ArrowRightLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
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
  toUserId: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const defaultFormData: DelegationFormData = {
  toUserId: "",
  startDate: "",
  endDate: "",
  isActive: true,
};

export default function ManagerDelegationPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

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
      const res = await fetch("/api/manager/delegations");
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setDelegations(data.delegations);
      setUsers(data.users);
    } catch (e) {
      addToast({
        type: "error",
        title: lang === "en" ? "Load error" : "Erreur de chargement",
        message: e instanceof Error ? e.message : "",
      });
    }
  }, [addToast, lang]);

  useEffect(() => {
    fetchDelegations().finally(() => setLoading(false));
  }, [fetchDelegations]);

  const openCreateDialog = () => {
    setEditingDelegation(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (delegation: DelegationData) => {
    setEditingDelegation(delegation);
    setFormData({
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
      if (!formData.toUserId || !formData.startDate || !formData.endDate) {
        addToast({
          type: "error",
          title: lang === "en" ? "Error" : "Erreur",
          message: lang === "en" ? "Please fill all required fields" : "Veuillez remplir tous les champs obligatoires",
        });
        return;
      }
    }

    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      addToast({
        type: "error",
        title: lang === "en" ? "Error" : "Erreur",
        message: lang === "en" ? "End date must be after start date" : "La date de fin doit etre apres la date de debut",
      });
      return;
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
            toUserId: formData.toUserId,
            startDate: formData.startDate,
            endDate: formData.endDate,
          };

      const res = await fetch("/api/manager/delegations", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || (lang === "en" ? "Save error" : "Erreur lors de la sauvegarde"));
      }

      addToast({
        type: "success",
        title: isEdit
          ? (lang === "en" ? "Delegation updated" : "Delegation modifiee")
          : (lang === "en" ? "Delegation created" : "Delegation creee"),
      });

      setDialogOpen(false);
      await fetchDelegations();
    } catch (e) {
      addToast({
        type: "error",
        title: lang === "en" ? "Error" : "Erreur",
        message: e instanceof Error ? e.message : "",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDelegation) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/manager/delegations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingDelegation.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || (lang === "en" ? "Delete error" : "Erreur lors de la suppression"));
      }

      addToast({
        type: "success",
        title: lang === "en" ? "Delegation deleted" : "Delegation supprimee",
      });

      setDeleteDialogOpen(false);
      setDeletingDelegation(null);
      await fetchDelegations();
    } catch (e) {
      addToast({
        type: "error",
        title: lang === "en" ? "Error" : "Erreur",
        message: e instanceof Error ? e.message : "",
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

  const currentUser = session?.user;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "My Delegations" : "Mes Delegations"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {delegations.length} {lang === "en" ? `delegation${delegations.length !== 1 ? "s" : ""}` : `delegation${delegations.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openCreateDialog}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            <Plus className="h-4 w-4" />
            {lang === "en" ? "New delegation" : "Nouvelle delegation"}
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
          {lang === "en" ? "No delegations yet." : "Aucune delegation enregistree."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Delegate" : "Delegataire"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Start date" : "Date debut"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "End date" : "Date fin"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Status" : "Statut"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {delegations.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {d.toUser.firstName} {d.toUser.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{d.toUser.email}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(d.startDate).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {new Date(d.endDate).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {d.isActive ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          {lang === "en" ? "Active" : "Actif"}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          {lang === "en" ? "Inactive" : "Inactif"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditDialog(d)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title={lang === "en" ? "Edit" : "Modifier"}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(d)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title={lang === "en" ? "Delete" : "Supprimer"}
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
        title={editingDelegation
          ? (lang === "en" ? "Edit delegation" : "Modifier la delegation")
          : (lang === "en" ? "New delegation" : "Nouvelle delegation")}
        description={editingDelegation
          ? (lang === "en" ? "Update delegation details" : "Modifier les informations de la delegation")
          : (lang === "en" ? "Create a new delegation of responsibility" : "Creer une nouvelle delegation de responsabilite")}
      >
        <div className="space-y-4">
          {/* Manager source (fromUser) - pre-filled, non-modifiable */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Manager (you)" : "Manager (vous)"}
            </label>
            <input
              type="text"
              value={currentUser ? `${currentUser.name ?? ""} (${currentUser.email ?? ""})` : ""}
              disabled
              className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
            />
          </div>

          {/* Delegate (toUser) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Delegate" : "Delegataire"}
            </label>
            <select
              value={formData.toUserId}
              onChange={(e) => setFormData({ ...formData, toUserId: e.target.value })}
              disabled={!!editingDelegation}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4] disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="">{lang === "en" ? "Select a user" : "Selectionner un utilisateur"}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Start date" : "Date debut"}
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          {/* End date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "End date" : "Date fin"}
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          {/* Active toggle (edit only) */}
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
              <span className="text-sm font-medium text-gray-700">
                {lang === "en" ? "Active" : "Actif"}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {lang === "en" ? "Cancel" : "Annuler"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingDelegation
                ? (lang === "en" ? "Save" : "Enregistrer")
                : (lang === "en" ? "Create" : "Creer")}
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
        title={lang === "en" ? "Delete delegation" : "Supprimer la delegation"}
        message={lang === "en"
          ? `Are you sure you want to delete the delegation to ${deletingDelegation?.toUser.firstName} ${deletingDelegation?.toUser.lastName}? This action is irreversible.`
          : `Voulez-vous vraiment supprimer la delegation vers ${deletingDelegation?.toUser.firstName} ${deletingDelegation?.toUser.lastName} ? Cette action est irreversible.`}
        confirmLabel={lang === "en" ? "Delete" : "Supprimer"}
        loading={deleting}
      />
    </div>
  );
}
