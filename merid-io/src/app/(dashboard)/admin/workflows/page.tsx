"use client";

import { useEffect, useState } from "react";
import { Loader2, GitBranch } from "lucide-react";

interface WorkflowStep {
  id: string;
  stepOrder: number;
  stepType: string;
  isRequired: boolean;
}

interface WorkflowData {
  id: string;
  mode: string;
  isActive: boolean;
  createdAt: string;
  office: { id: string; name: string } | null;
  steps: WorkflowStep[];
}

const stepTypeLabels: Record<string, string> = {
  MANAGER: "Manager",
  HR: "Ressources Humaines",
};

export default function AdminWorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/workflows")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setWorkflows(d))
      .catch(() => setWorkflows([]))
      .finally(() => setLoading(false));
  }, []);

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
            {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} configuré{workflows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
        >
          <GitBranch className="h-5 w-5" style={{ color: "#1B3A5C" }} />
        </div>
      </div>

      {/* Cards */}
      {workflows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun workflow configuré.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
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
                      {wf.mode === "SEQUENTIAL" ? "Séquentiel" : "Parallèle"}
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
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
                >
                  <GitBranch className="h-5 w-5" style={{ color: "#00BCD4" }} />
                </div>
              </div>

              {/* Steps */}
              {wf.steps.length > 0 && (
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Étapes
                  </p>
                  {wf.steps.map((step) => (
                    <div
                      key={step.id}
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
    </div>
  );
}
