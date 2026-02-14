"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, GitBranch, Plus, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";

interface OfficeOption {
  id: string;
  name: string;
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
  officeId: string;
  createdAt: string;
  office: { id: string; name: string } | null;
  steps: WorkflowStep[];
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
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingWorkflow, setDeletingWorkflow] = useState<WorkflowData | null>(null);

  // Form state (managed with useState, not react-hook-form, for dynamic steps)
  const [formOfficeId, setFormOfficeId] = useState("");
  const [formMode, setFormMode] = useState<"SEQUENTIAL" | "PARALLEL">("SEQUENTIAL");
  const [formIsActive, setFormIsActive] = useState(true);
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

  const fetchOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/offices");
      if (!res.ok) throw new Error("Erreur de chargement des bureaux");
      const data = await res.json();
      setOffices(data.map((o: OfficeOption) => ({ id: o.id, name: o.name })));
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les bureaux" });
    }
  }, [addToast]);

  useEffect(() => {
    fetchWorkflows();
    fetchOffices();
  }, [fetchWorkflows, fetchOffices]);

  function resetForm() {
    setFormOfficeId("");
    setFormMode("SEQUENTIAL");
    setFormIsActive(true);
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
    setFormOfficeId(wf.officeId);
    setFormMode(wf.mode as "SEQUENTIAL" | "PARALLEL");
    setFormIsActive(wf.isActive);
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
      // Renumber step orders
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
    if (!formOfficeId) errs.officeId = "Le bureau est requis";
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
        officeId: formOfficeId,
        mode: formMode,
        isActive: formIsActive,
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
            {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} configur&eacute;{workflows.length !== 1 ? "s" : ""}
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

      {/* Cards */}
      {workflows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun workflow configur&eacute;.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
              onClick={() => openEditDialog(wf)}
            >
              {/* Workflow header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {wf.office?.name ?? "Bureau inconnu"}
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
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
                <div className="flex items-center gap-1">
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
          {/* Bureau */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bureau</label>
            <select
              value={formOfficeId}
              onChange={(e) => setFormOfficeId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            >
              <option value="">S&eacute;lectionner un bureau</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {formErrors.officeId && <p className="mt-1 text-xs text-red-600">{formErrors.officeId}</p>}
          </div>

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

          {/* Actif toggle */}
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
                  {/* Step order badge */}
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "#1B3A5C" }}
                  >
                    {step.stepOrder}
                  </div>

                  {/* Type select */}
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

                  {/* Required checkbox */}
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={step.isRequired}
                      onChange={(e) => updateStep(index, "isRequired", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
                    />
                    Requis
                  </label>

                  {/* Remove button */}
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

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDeletingWorkflow(null);
        }}
        onConfirm={handleDelete}
        title="Supprimer le workflow"
        message={`\u00cates-vous s\u00fbr de vouloir supprimer ce workflow${deletingWorkflow?.office?.name ? ` pour "${deletingWorkflow.office.name}"` : ""} ? Cette action est irr\u00e9versible.`}
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}
