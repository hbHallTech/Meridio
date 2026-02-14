"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  Plus,
  X,
  Trash2,
  ArrowUp,
  ArrowDown,
  Workflow,
  ChevronRight,
  CheckCircle2,
  Save,
  Pencil,
} from "lucide-react";

interface WorkflowStep {
  id?: string;
  stepOrder: number;
  stepType: "MANAGER" | "HR";
  isRequired: boolean;
}

interface WorkflowRow {
  id: string;
  officeId: string;
  mode: "SEQUENTIAL" | "PARALLEL";
  isActive: boolean;
  createdAt: string;
  office: { id: string; name: string; city: string };
  steps: WorkflowStep[];
}

interface OfficeOption {
  id: string;
  name: string;
  city: string;
}

const STEP_LABELS: Record<string, { fr: string; en: string }> = {
  MANAGER: { fr: "Manager", en: "Manager" },
  HR: { fr: "Ressources Humaines", en: "Human Resources" },
};

const MODE_LABELS: Record<string, { fr: string; en: string }> = {
  SEQUENTIAL: { fr: "Séquentiel", en: "Sequential" },
  PARALLEL: { fr: "Parallèle", en: "Parallel" },
};

export default function AdminWorkflowsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = (session?.user?.language ?? "fr") as "fr" | "en";

  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOffice, setFilterOffice] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formOffice, setFormOffice] = useState("");
  const [formMode, setFormMode] = useState<"SEQUENTIAL" | "PARALLEL">("SEQUENTIAL");
  const [formSteps, setFormSteps] = useState<{ stepType: "MANAGER" | "HR"; isRequired: boolean }[]>([
    { stepType: "MANAGER", isRequired: true },
    { stepType: "HR", isRequired: true },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterOffice
        ? `/api/admin/workflows?officeId=${filterOffice}`
        : "/api/admin/workflows";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows);
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
    setFormOffice("");
    setFormMode("SEQUENTIAL");
    setFormSteps([
      { stepType: "MANAGER", isRequired: true },
      { stepType: "HR", isRequired: true },
    ]);
    setModalOpen(true);
  };

  const openEdit = (wf: WorkflowRow) => {
    setEditing(wf);
    setFormOffice(wf.officeId);
    setFormMode(wf.mode);
    setFormSteps(wf.steps.map((s) => ({ stepType: s.stepType as "MANAGER" | "HR", isRequired: s.isRequired })));
    setModalOpen(true);
  };

  const addStep = () => {
    setFormSteps([...formSteps, { stepType: "MANAGER", isRequired: true }]);
  };

  const removeStep = (idx: number) => {
    if (formSteps.length <= 1) return;
    setFormSteps(formSteps.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= formSteps.length) return;
    const copy = [...formSteps];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setFormSteps(copy);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOffice) {
      addToast({ type: "error", title: lang === "en" ? "Select an office" : "Sélectionnez un bureau" });
      return;
    }
    if (formSteps.length === 0) {
      addToast({ type: "error", title: lang === "en" ? "Add at least one step" : "Ajoutez au moins une étape" });
      return;
    }

    setSaving(true);
    try {
      const body = editing
        ? { workflowId: editing.id, mode: formMode, steps: formSteps }
        : { officeId: formOffice, mode: formMode, steps: formSteps };

      const res = await fetch("/api/admin/workflows", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addToast({
          type: "success",
          title: lang === "en"
            ? (editing ? "Workflow updated" : "Workflow created")
            : (editing ? "Workflow mis à jour" : "Workflow créé"),
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

  const handleDelete = async (wf: WorkflowRow) => {
    if (!confirm(lang === "en" ? "Delete this workflow?" : "Supprimer ce workflow ?")) return;
    try {
      const res = await fetch(`/api/admin/workflows?workflowId=${wf.id}`, { method: "DELETE" });
      if (res.ok) {
        addToast({ type: "success", title: lang === "en" ? "Workflow deleted" : "Workflow supprimé" });
        fetchData();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
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
            {lang === "en" ? "Approval Workflows" : "Workflows d'approbation"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? `${workflows.length} workflow${workflows.length > 1 ? "s" : ""} configured`
              : `${workflows.length} workflow${workflows.length > 1 ? "s" : ""} configuré${workflows.length > 1 ? "s" : ""}`}
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
            {lang === "en" ? "New workflow" : "Nouveau workflow"}
          </button>
        </div>
      </div>

      {/* Workflow cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className={`rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
              wf.isActive ? "border-green-200" : "border-gray-200 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{wf.office.name}</h3>
                  {wf.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {lang === "en" ? "Active" : "Actif"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      {lang === "en" ? "Inactive" : "Inactif"}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                  {lang === "en" ? "Mode:" : "Mode :"}{" "}
                  <span className="font-medium text-gray-700">{MODE_LABELS[wf.mode][lang]}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(wf)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B3A5C] transition-colors"
                  title={lang === "en" ? "Edit" : "Modifier"}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(wf)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title={lang === "en" ? "Delete" : "Supprimer"}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Workflow diagram */}
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                {lang === "en" ? "Approval flow" : "Flux d'approbation"}
              </p>
              {wf.mode === "SEQUENTIAL" ? (
                <div className="flex items-center gap-1 flex-wrap">
                  <div className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                    <Workflow className="h-3.5 w-3.5" />
                    {lang === "en" ? "Request" : "Demande"}
                  </div>
                  {wf.steps.map((step, idx) => (
                    <div key={step.id || idx} className="flex items-center gap-1">
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                      <div
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          step.stepType === "MANAGER"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {STEP_LABELS[step.stepType][lang]}
                        {!step.isRequired && (
                          <span className="ml-1 text-[10px] opacity-60">
                            ({lang === "en" ? "optional" : "optionnel"})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                  <div className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {lang === "en" ? "Approved" : "Approuvé"}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 w-fit">
                    <Workflow className="h-3.5 w-3.5" />
                    {lang === "en" ? "Request" : "Demande"}
                  </div>
                  <div className="ml-4 flex flex-col gap-1 border-l-2 border-gray-200 pl-4">
                    {wf.steps.map((step, idx) => (
                      <div
                        key={step.id || idx}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium w-fit ${
                          step.stepType === "MANAGER"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-purple-50 text-purple-700"
                        }`}
                      >
                        {STEP_LABELS[step.stepType][lang]}
                        {!step.isRequired && (
                          <span className="ml-1 text-[10px] opacity-60">
                            ({lang === "en" ? "optional" : "optionnel"})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 w-fit">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {lang === "en" ? "All approved → Done" : "Tous approuvés → Fait"}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {workflows.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Workflow className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-gray-500">
            {lang === "en" ? "No workflows configured" : "Aucun workflow configuré"}
          </p>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing
                  ? (lang === "en" ? "Edit workflow" : "Modifier le workflow")
                  : (lang === "en" ? "New workflow" : "Nouveau workflow")}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-5 px-6 py-5">
              {/* Office */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Office *" : "Bureau *"}
                </label>
                <select
                  value={formOffice}
                  onChange={(e) => setFormOffice(e.target.value)}
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

              {/* Mode */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Approval mode *" : "Mode d'approbation *"}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["SEQUENTIAL", "PARALLEL"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFormMode(m)}
                      className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                        formMode === m
                          ? "border-[#1B3A5C] bg-[#1B3A5C]/5 text-[#1B3A5C]"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <div className="text-left">
                        <div>{MODE_LABELS[m][lang]}</div>
                        <div className="mt-0.5 text-[11px] font-normal opacity-60">
                          {m === "SEQUENTIAL"
                            ? (lang === "en" ? "Step by step" : "Étape par étape")
                            : (lang === "en" ? "All at once" : "Toutes en même temps")}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Steps */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">
                    {lang === "en" ? "Approval steps *" : "Étapes d'approbation *"}
                  </label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    {lang === "en" ? "Add step" : "Ajouter"}
                  </button>
                </div>
                <div className="space-y-2">
                  {formSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1B3A5C] text-[11px] font-bold text-white">
                        {idx + 1}
                      </span>
                      <select
                        value={step.stepType}
                        onChange={(e) => {
                          const copy = [...formSteps];
                          copy[idx].stepType = e.target.value as "MANAGER" | "HR";
                          setFormSteps(copy);
                        }}
                        className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-[#1B3A5C] focus:outline-none"
                      >
                        <option value="MANAGER">{STEP_LABELS.MANAGER[lang]}</option>
                        <option value="HR">{STEP_LABELS.HR[lang]}</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={step.isRequired}
                          onChange={(e) => {
                            const copy = [...formSteps];
                            copy[idx].isRequired = e.target.checked;
                            setFormSteps(copy);
                          }}
                          className="rounded"
                        />
                        {lang === "en" ? "Required" : "Requis"}
                      </label>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveStep(idx, -1)}
                          disabled={idx === 0}
                          className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(idx, 1)}
                          disabled={idx === formSteps.length - 1}
                          className="rounded p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          disabled={formSteps.length <= 1}
                          className="rounded p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Preview" : "Prévisualisation"}
                </label>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                  {formMode === "SEQUENTIAL" ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      <div className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                        {lang === "en" ? "Request" : "Demande"}
                      </div>
                      {formSteps.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                          <div
                            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                              step.stepType === "MANAGER"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-purple-50 text-purple-700"
                            }`}
                          >
                            {STEP_LABELS[step.stepType][lang]}
                          </div>
                        </div>
                      ))}
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                      <div className="rounded-md bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700">
                        {lang === "en" ? "Done" : "Fait"}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 w-fit">
                        {lang === "en" ? "Request" : "Demande"}
                      </div>
                      <div className="ml-3 flex flex-col gap-1 border-l-2 border-gray-200 pl-3">
                        {formSteps.map((step, idx) => (
                          <div
                            key={idx}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium w-fit ${
                              step.stepType === "MANAGER"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-purple-50 text-purple-700"
                            }`}
                          >
                            {STEP_LABELS[step.stepType][lang]}
                          </div>
                        ))}
                      </div>
                      <div className="rounded-md bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 w-fit">
                        {lang === "en" ? "All approved → Done" : "Tous approuvés → Fait"}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
