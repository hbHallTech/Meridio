"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, GitBranch, Plus, Pencil, Trash2, X, Copy, Users } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";

interface TeamOption {
  id: string;
  name: string;
  office?: { id: string; name: string };
}

interface WorkflowStep {
  id?: string;
  stepOrder: number;
  stepType: "MANAGER" | "HR";
  isRequired: boolean;
}

interface WorkflowData {
  id: string;
  mode: string;
  isActive: boolean;
  officeId: string | null;
  createdAt: string;
  office: { id: string; name: string } | null;
  steps: WorkflowStep[];
  teams: TeamOption[];
}

interface StepDraft {
  stepOrder: number;
  stepType: "MANAGER" | "HR";
  isRequired: boolean;
}

interface StepDraft {
  stepOrder: number;
  stepType: "MANAGER" | "HR";
  isRequired: boolean;
}

const stepTypeLabels: Record<string, string> = {
  MANAGER: "Manager",
  HR: "Ressources Humaines",
};

const modeLabels: Record<string, string> = {
  SEQUENTIAL: "S\u00e9quentiel",
  PARALLEL: "Parall\u00e8le",
};

export default function AdminWorkflowsPage() {
  const { addToast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [allTeams, setAllTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Filter state
  const [filterTeamId, setFilterTeamId] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowData | null>(null);

  // Team association dialog
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamDialogWorkflow, setTeamDialogWorkflow] = useState<WorkflowData | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [savingTeams, setSavingTeams] = useState(false);

  // Form state
  const [formMode, setFormMode] = useState<"SEQUENTIAL" | "PARALLEL">("SEQUENTIAL");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formTeamIds, setFormTeamIds] = useState<string[]>([]);
  const [formSteps, setFormSteps] = useState<StepDraft[]>([
    { stepOrder: 1, stepType: "MANAGER", isRequired: true },
  ]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/workflows");
      if (!res.ok) throw new Error("Erreur de chargement des workflows");
      const data = await res.json();
      setWorkflows(data);
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les workflows" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/teams");
      if (!res.ok) throw new Error("Erreur de chargement des \u00e9quipes");
      const data = await res.json();
      setAllTeams(data.map((t: TeamOption & { office?: { id: string; name: string } }) => ({
        id: t.id,
        name: t.name,
        office: t.office,
      })));
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les \u00e9quipes" });
    }
  }, [addToast]);

  useEffect(() => {
    fetchWorkflows();
    fetchTeams();
  }, [fetchWorkflows, fetchTeams]);

  function resetForm() {
    setFormMode("SEQUENTIAL");
    setFormIsActive(true);
    setFormTeamIds([]);
    setFormSteps([{ stepOrder: 1, stepType: "MANAGER", isRequired: true }]);
    setFormErrors({});
  }

  function openCreateDialog() {
    setEditingWorkflow(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(wf: WorkflowData) {
    setEditingWorkflow(wf);
    setFormMode(wf.mode as "SEQUENTIAL" | "PARALLEL");
    setFormIsActive(wf.isActive);
    setFormTeamIds(wf.teams.map((t) => t.id));
    setFormSteps(
      wf.steps.map((s) => ({
        stepOrder: s.stepOrder,
        stepType: s.stepType,
        isRequired: s.isRequired,
      }))
    );
    setFormErrors({});
    setDialogOpen(true);
  }

  function openDeleteDialog(wf: WorkflowData) {
    setDeletingWorkflow(wf);
    setConfirmOpen(true);
  }

  function openTeamDialog(wf: WorkflowData) {
    setTeamDialogWorkflow(wf);
    setSelectedTeamIds(wf.teams.map((t) => t.id));
    setTeamDialogOpen(true);
  }

  function addStep() {
    setFormSteps((prev) => [
      ...prev,
      {
        stepOrder: prev.length + 1,
        stepType: "HR",
        isRequired: true,
      },
    ]);
  }

  function removeStep(index: number) {
    setFormSteps((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, stepOrder: i + 1 }));
    });
  }

  function updateStep(index: number, field: keyof StepDraft, value: string | boolean | number) {
    setFormSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (formSteps.length === 0) errs.steps = "Au moins une \u00e9tape est requise";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const isEdit = !!editingWorkflow;
      const payload = {
        mode: formMode,
        isActive: formIsActive,
        teamIds: formTeamIds,
        steps: formSteps.map((s) => ({
          stepOrder: s.stepOrder,
          stepType: s.stepType,
          isRequired: s.isRequired,
        })),
      };

      const res = await fetch("/api/admin/workflows", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: editingWorkflow.id, ...payload } : payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        throw new Error(err.error || "Erreur inconnue");
      }

      addToast({
        type: "success",
        title: isEdit ? "Workflow mis \u00e0 jour" : "Workflow cr\u00e9\u00e9",
        message: `Le workflow a \u00e9t\u00e9 ${isEdit ? "mis \u00e0 jour" : "cr\u00e9\u00e9"} avec succ\u00e8s.`,
      });
      setDialogOpen(false);
      await fetchWorkflows();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(wf: WorkflowData) {
    setDuplicating(true);
    try {
      const res = await fetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", sourceId: wf.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        throw new Error(err.error || "Erreur inconnue");
      }

      addToast({
        type: "success",
        title: "Workflow dupliqu\u00e9",
        message: "Le workflow a \u00e9t\u00e9 dupliqu\u00e9 avec succ\u00e8s (inactif).",
      });
      await fetchWorkflows();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Impossible de dupliquer le workflow",
      });
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDelete() {
    if (!deletingWorkflow) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/workflows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingWorkflow.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        throw new Error(err.error || "Erreur inconnue");
      }

      addToast({
        type: "success",
        title: "Workflow supprim\u00e9",
        message: "Le workflow a \u00e9t\u00e9 supprim\u00e9 avec succ\u00e8s.",
      });
      setConfirmOpen(false);
      setDeletingWorkflow(null);
      await fetchWorkflows();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Impossible de supprimer le workflow",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveTeams() {
    if (!teamDialogWorkflow) return;
    setSavingTeams(true);
    try {
      const res = await fetch("/api/admin/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: teamDialogWorkflow.id,
          action: "updateTeams",
          teamIds: selectedTeamIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        throw new Error(err.error || "Erreur inconnue");
      }

      addToast({
        type: "success",
        title: "\u00c9quipes mises \u00e0 jour",
        message: "Les \u00e9quipes associ\u00e9es ont \u00e9t\u00e9 mises \u00e0 jour.",
      });
      setTeamDialogOpen(false);
      setTeamDialogWorkflow(null);
      await fetchWorkflows();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Impossible de mettre \u00e0 jour les \u00e9quipes",
      });
    } finally {
      setSavingTeams(false);
    }
  }

  // Filter workflows by team
  const filteredWorkflows = filterTeamId
    ? workflows.filter((wf) => wf.teams.some((t) => t.id === filterTeamId))
    : workflows;

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
          <h1 className="text-2xl font-bold text-gray-900">Workflows d&apos;approbation</h1>
          <p className="mt-1 text-sm text-gray-500">
            {filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? "s" : ""} configur&eacute;{filteredWorkflows.length !== 1 ? "s" : ""}
            {filterTeamId && ` (filtr\u00e9)`}
          </p>
        </div>
        <button
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau workflow
        </button>
      </div>

      {/* Team filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filtrer par &eacute;quipe :</label>
        <select
          value={filterTeamId}
          onChange={(e) => setFilterTeamId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
        >
          <option value="">Toutes les &eacute;quipes</option>
          {allTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}{t.office ? ` (${t.office.name})` : ""}
            </option>
          ))}
        </select>
        {filterTeamId && (
          <button
            onClick={() => setFilterTeamId("")}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            R&eacute;initialiser
          </button>
        )}
      </div>

      {/* Cards */}
      {filteredWorkflows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          {filterTeamId ? "Aucun workflow pour cette \u00e9quipe." : "Aucun workflow configur\u00e9."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {filteredWorkflows.map((wf) => (
            <div
              key={wf.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
              onClick={() => openEditDialog(wf)}
            >
              {/* Workflow header */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Workflow
                    {wf.office ? ` — ${wf.office.name}` : ""}
                  </h2>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: "rgba(0,188,212,0.1)", color: "#00BCD4" }}
                    >
                      {modeLabels[wf.mode] ?? wf.mode}
                    </span>
                    {wf.isActive ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                        Actif
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                        Inactif
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openTeamDialog(wf);
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    title="\u00c9quipes associ\u00e9es"
                  >
                    <Users className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(wf);
                    }}
                    disabled={duplicating}
                    className="rounded-lg p-2 text-gray-400 hover:bg-purple-50 hover:text-purple-600 transition-colors disabled:opacity-30"
                    title="Dupliquer"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(wf);
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(wf);
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
                  >
                    <GitBranch className="h-5 w-5" style={{ color: "#00BCD4" }} />
                  </div>
                </div>
              </div>

              {/* Team badges */}
              {wf.teams.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {wf.teams.map((team) => (
                    <span
                      key={team.id}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                    >
                      <Users className="h-3 w-3" />
                      {team.name}
                    </span>
                  ))}
                </div>
              )}
              {wf.teams.length === 0 && (
                <p className="mt-3 text-xs text-amber-600">Aucune &eacute;quipe associ&eacute;e</p>
              )}

              {/* Steps */}
              {wf.steps.length > 0 && (
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    &Eacute;tapes
                  </p>
                  {wf.steps.map((step) => (
                    <div
                      key={step.id ?? step.stepOrder}
                      className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
                    >
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: "#1B3A5C" }}
                      >
                        {step.stepOrder}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {stepTypeLabels[step.stepType] ?? step.stepType}
                        </p>
                      </div>
                      {step.isRequired ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          Requis
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                          Optionnel
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingWorkflow ? "Modifier le workflow" : "Nouveau workflow"}
        maxWidth="lg"
      >
        <div className="space-y-5">
          {/* Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
            <select
              value={formMode}
              onChange={(e) => setFormMode(e.target.value as "SEQUENTIAL" | "PARALLEL")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            >
              <option value="SEQUENTIAL">S&eacute;quentiel</option>
              <option value="PARALLEL">Parall&egrave;le</option>
            </select>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Actif</label>
            <button
              type="button"
              onClick={() => setFormIsActive((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                formIsActive ? "bg-[#00BCD4]" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  formIsActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-sm text-gray-500">
              {formIsActive ? "Actif" : "Inactif"}
            </span>
          </div>

          {/* Team selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              &Eacute;quipes associ&eacute;es
            </label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-300 p-2 space-y-1">
              {allTeams.length === 0 ? (
                <p className="text-sm text-gray-400 px-2 py-1">Aucune &eacute;quipe disponible</p>
              ) : (
                allTeams.map((team) => (
                  <label
                    key={team.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formTeamIds.includes(team.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormTeamIds((prev) => [...prev, team.id]);
                        } else {
                          setFormTeamIds((prev) => prev.filter((id) => id !== team.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
                    />
                    <span className="text-gray-900">{team.name}</span>
                    {team.office && (
                      <span className="text-gray-400 text-xs">({team.office.name})</span>
                    )}
                  </label>
                ))
              )}
            </div>
            {formTeamIds.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {formTeamIds.length} &eacute;quipe{formTeamIds.length > 1 ? "s" : ""} s&eacute;lectionn&eacute;e{formTeamIds.length > 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">&Eacute;tapes du workflow</label>
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1 rounded-lg border border-[#1B3A5C] px-3 py-1.5 text-xs font-medium text-[#1B3A5C] hover:bg-[#1B3A5C]/5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter une &eacute;tape
              </button>
            </div>
            {formErrors.steps && <p className="mb-2 text-xs text-red-600">{formErrors.steps}</p>}

            <div className="space-y-3">
              {formSteps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "#1B3A5C" }}
                  >
                    {step.stepOrder}
                  </div>
                  <div className="flex-1">
                    <select
                      value={step.stepType}
                      onChange={(e) => updateStep(index, "stepType", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    >
                      <option value="MANAGER">Manager</option>
                      <option value="HR">Ressources Humaines</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={step.isRequired}
                      onChange={(e) => updateStep(index, "isRequired", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
                    />
                    Requis
                  </label>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    disabled={formSteps.length <= 1}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Supprimer l'&eacute;tape"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingWorkflow ? "Enregistrer" : "Cr\u00e9er"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Team Association Dialog */}
      <Dialog
        open={teamDialogOpen}
        onClose={() => {
          setTeamDialogOpen(false);
          setTeamDialogWorkflow(null);
        }}
        title={`\u00c9quipes associ\u00e9es${teamDialogWorkflow?.office ? ` — ${teamDialogWorkflow.office.name}` : ""}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            S&eacute;lectionnez les &eacute;quipes qui utilisent ce workflow d&apos;approbation.
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 p-2 space-y-1">
            {allTeams.length === 0 ? (
              <p className="text-sm text-gray-400 px-2 py-2">Aucune &eacute;quipe disponible</p>
            ) : (
              allTeams.map((team) => (
                <label
                  key={team.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTeamIds.includes(team.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTeamIds((prev) => [...prev, team.id]);
                      } else {
                        setSelectedTeamIds((prev) => prev.filter((id) => id !== team.id));
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
                  />
                  <div>
                    <span className="text-gray-900 font-medium">{team.name}</span>
                    {team.office && (
                      <span className="ml-2 text-gray-400 text-xs">({team.office.name})</span>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>
          <p className="text-xs text-gray-500">
            {selectedTeamIds.length} &eacute;quipe{selectedTeamIds.length !== 1 ? "s" : ""} s&eacute;lectionn&eacute;e{selectedTeamIds.length !== 1 ? "s" : ""}
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setTeamDialogOpen(false);
                setTeamDialogWorkflow(null);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveTeams}
              disabled={savingTeams}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {savingTeams && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDeletingWorkflow(null);
        }}
        onConfirm={handleDelete}
        title="Supprimer le workflow"
        message={`\u00cates-vous s\u00fbr de vouloir supprimer ce workflow${deletingWorkflow?.teams?.length ? ` (${deletingWorkflow.teams.length} \u00e9quipe${deletingWorkflow.teams.length > 1 ? "s" : ""} associ\u00e9e${deletingWorkflow.teams.length > 1 ? "s" : ""})` : ""} ? Cette action est irr\u00e9versible.`}
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}
