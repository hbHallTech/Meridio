"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UsersRound, Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { teamSchema, type TeamInput } from "@/lib/validators";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MemberData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface TeamData {
  id: string;
  name: string;
  createdAt: string;
  manager: { id: string; firstName: string; lastName: string; email: string } | null;
  office: { id: string; name: string } | null;
  members: MemberData[];
  _count: { members: number };
}

interface OfficeOption {
  id: string;
  name: string;
}

interface ManagerOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AdminTeamsPage() {
  const { addToast } = useToast();

  // Data state
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch helpers
  // -------------------------------------------------------------------------
  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teams");
      if (!res.ok) throw new Error("Erreur lors du chargement des équipes");
      const data = await res.json();
      setTeams(data);
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  const fetchOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/offices");
      if (!res.ok) throw new Error("Erreur lors du chargement des bureaux");
      const data = await res.json();
      setOffices(data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  const fetchManagers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Erreur lors du chargement des utilisateurs");
      const data = await res.json();
      // Filter users that have the MANAGER role
      const managerUsers = data.filter(
        (u: { roles: string[]; isActive: boolean }) =>
          u.roles.includes("MANAGER") && u.isActive
      );
      setManagers(
        managerUsers.map((u: { id: string; firstName: string; lastName: string; email: string }) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
        }))
      );
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  useEffect(() => {
    Promise.all([fetchTeams(), fetchOffices(), fetchManagers()]).finally(() => setLoading(false));
  }, [fetchTeams, fetchOffices, fetchManagers]);

  // -------------------------------------------------------------------------
  // Create form
  // -------------------------------------------------------------------------
  const createForm = useForm<TeamInput>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      managerId: "",
      officeId: "",
    },
  });

  const handleCreate = async (data: TeamInput) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la création");
      }
      addToast({ type: "success", title: "Succès", message: "Équipe créée avec succès" });
      setCreateOpen(false);
      createForm.reset();
      await fetchTeams();
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Edit form
  // -------------------------------------------------------------------------
  const editForm = useForm<TeamInput>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      managerId: "",
      officeId: "",
    },
  });

  const openEdit = (team: TeamData) => {
    setSelectedTeam(team);
    editForm.reset({
      name: team.name,
      managerId: team.manager?.id || "",
      officeId: team.office?.id || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async (data: TeamInput) => {
    if (!selectedTeam) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTeam.id, ...data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la mise à jour");
      }
      addToast({ type: "success", title: "Succès", message: "Équipe mise à jour avec succès" });
      setEditOpen(false);
      setSelectedTeam(null);
      await fetchTeams();
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------
  const openDelete = (team: TeamData) => {
    setSelectedTeam(team);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedTeam) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTeam.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la suppression");
      }
      addToast({ type: "success", title: "Succès", message: "Équipe supprimée avec succès" });
      setDeleteOpen(false);
      setSelectedTeam(null);
      await fetchTeams();
    } catch (err) {
      addToast({
        type: "error",
        title: "Erreur",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Shared form fields renderer
  // -------------------------------------------------------------------------
  function TeamFormFields({ form }: { form: ReturnType<typeof useForm<TeamInput>> }) {
    return (
      <div className="space-y-4">
        {/* Nom */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nom de l&apos;équipe</label>
          <input
            {...form.register("name")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
          />
          {form.formState.errors.name && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
          )}
        </div>

        {/* Bureau */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Bureau</label>
          <select
            {...form.register("officeId")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
          >
            <option value="">-- Sélectionner --</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {form.formState.errors.officeId && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.officeId.message}</p>
          )}
        </div>

        {/* Manager */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Manager</label>
          <select
            {...form.register("managerId")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
          >
            <option value="">-- Sélectionner --</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName} ({m.email})
              </option>
            ))}
          </select>
          {form.formState.errors.managerId && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.managerId.message}</p>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
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
          <h1 className="text-2xl font-bold text-gray-900">Gestion des équipes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {teams.length} équipe{teams.length !== 1 ? "s" : ""} enregistrée
            {teams.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              createForm.reset();
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouvelle équipe
          </button>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
          >
            <UsersRound className="h-5 w-5" style={{ color: "#00BCD4" }} />
          </div>
        </div>
      </div>

      {/* Table */}
      {teams.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune équipe trouvée.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Nom</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Manager</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Membres</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teams.map((team) => (
                  <tr
                    key={team.id}
                    className="hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => openEdit(team)}
                  >
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900">
                      {team.name}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {team.manager
                        ? `${team.manager.firstName} ${team.manager.lastName}`
                        : "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {team.office?.name ?? "\u2014"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{ backgroundColor: "rgba(27,58,92,0.1)", color: "#1B3A5C" }}
                      >
                        {team._count.members}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(team);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#00BCD4] transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDelete(team);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle équipe"
        description="Remplissez les informations de la nouvelle équipe"
        maxWidth="md"
      >
        <form onSubmit={createForm.handleSubmit(handleCreate)}>
          <TeamFormFields form={createForm} />
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Créer
            </button>
          </div>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedTeam(null);
        }}
        title="Modifier l'équipe"
        description={selectedTeam ? selectedTeam.name : undefined}
        maxWidth="md"
      >
        <form onSubmit={editForm.handleSubmit(handleEdit)}>
          <TeamFormFields form={editForm} />

          {/* Read-only member list */}
          {selectedTeam && selectedTeam.members.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Membres ({selectedTeam.members.length})
              </h3>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
                <ul className="divide-y divide-gray-200">
                  {selectedTeam.members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {selectedTeam && selectedTeam.members.length === 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Membres</h3>
              <p className="text-sm text-gray-400">Aucun membre dans cette équipe.</p>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEditOpen(false);
                setSelectedTeam(null);
              }}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete ConfirmDialog */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedTeam(null);
        }}
        onConfirm={handleDelete}
        title="Supprimer l'équipe"
        message={
          selectedTeam
            ? `Êtes-vous sûr de vouloir supprimer l'équipe "${selectedTeam.name}" ? Les ${selectedTeam._count.members} membre(s) seront dissociés de l'équipe.`
            : ""
        }
        confirmLabel="Supprimer"
        loading={submitting}
      />
    </div>
  );
}
