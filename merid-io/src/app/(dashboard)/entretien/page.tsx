"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Loader2, Star, Target, Save, TrendingUp, PlusCircle, Send,
  CheckCircle2, Clock, AlertTriangle, XCircle,
  BarChart3, FileText,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

// ─── Types ───

interface SkillEntry {
  skillId: string;
  skillName: string;
  type: string;
  selfLevel: string | null;
  comment: string;
}

interface ObjectiveEntry {
  objectiveId: string;
  title: string;
  status: string;
  selfProgress: number;
  selfComment: string;
}

interface EntretienData {
  id: string;
  year: number;
  status: "DRAFT_EMPLOYEE" | "DRAFT_MANAGER" | "COMPLETED" | "ARCHIVED";
  selfSkills: SkillEntry[] | null;
  selfObjectives: ObjectiveEntry[] | null;
  selfStrengths: string | null;
  selfImprovements: string | null;
  managerSkills: unknown[] | null;
  managerObjectives: unknown[] | null;
  summaryReport: string | null;
  finalComment: string | null;
  manager: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ───

const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];
const SKILL_LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
  EXPERT: "Expert",
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  DRAFT_EMPLOYEE: { label: "En cours de rédaction", icon: Clock, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  DRAFT_MANAGER: { label: "Soumis — en attente du manager", icon: Send, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  COMPLETED: { label: "Complété", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  ARCHIVED: { label: "Archivé", icon: FileText, color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
};

const OBJ_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "En cours",
  ACHIEVED: "Atteint",
  PARTIALLY_ACHIEVED: "Partiel",
  NOT_ACHIEVED: "Non atteint",
  CANCELLED: "Annulé",
};

// ─── Main Component ───

export default function EntretienPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [entretiens, setEntretiens] = useState<EntretienData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Editable form state
  const [selfSkills, setSelfSkills] = useState<SkillEntry[]>([]);
  const [selfObjectives, setSelfObjectives] = useState<ObjectiveEntry[]>([]);
  const [selfStrengths, setSelfStrengths] = useState("");
  const [selfImprovements, setSelfImprovements] = useState("");

  const currentYear = new Date().getFullYear();

  // ─── Fetch ───
  const fetchEntretiens = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/entretiens");
      if (res.ok) {
        const data = await res.json();
        setEntretiens(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
          loadFormData(data[0]);
        }
      }
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les entretiens" });
    } finally {
      setLoading(false);
    }
  }, [addToast, selectedId]);

  useEffect(() => { fetchEntretiens(); }, [fetchEntretiens]);

  function loadFormData(e: EntretienData) {
    setSelfSkills((e.selfSkills as SkillEntry[]) || []);
    setSelfObjectives((e.selfObjectives as ObjectiveEntry[]) || []);
    setSelfStrengths(e.selfStrengths || "");
    setSelfImprovements(e.selfImprovements || "");
  }

  const selected = entretiens.find((e) => e.id === selectedId);

  // ─── Create entretien ───
  const createEntretien = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/profile/entretiens", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.entretien) {
          setSelectedId(data.entretien.id);
          addToast({ type: "info", title: "Entretien existant", message: `L'entretien ${currentYear} existe déjà.` });
        } else {
          throw new Error(data.error || "Erreur");
        }
      } else {
        addToast({ type: "success", title: "Entretien créé" });
        setSelectedId(data.id);
      }
      await fetchEntretiens();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setCreating(false);
    }
  };

  // ─── Save draft ───
  const saveDraft = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/profile/entretiens/${selectedId}/self`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfSkills,
          selfObjectives,
          selfStrengths,
          selfImprovements,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      addToast({ type: "success", title: "Brouillon enregistré" });
      await fetchEntretiens();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Submit to manager ───
  const submitToManager = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/profile/entretiens/${selectedId}/self`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selfSkills,
          selfObjectives,
          selfStrengths,
          selfImprovements,
          submit: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      addToast({ type: "success", title: "Auto-évaluation soumise", message: "Votre manager peut maintenant compléter sa partie." });
      await fetchEntretiens();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Skill change handlers ───
  const updateSkillLevel = (idx: number, level: string) => {
    setSelfSkills((prev) => prev.map((s, i) => (i === idx ? { ...s, selfLevel: level } : s)));
  };
  const updateSkillComment = (idx: number, comment: string) => {
    setSelfSkills((prev) => prev.map((s, i) => (i === idx ? { ...s, comment } : s)));
  };

  // ─── Objective change handlers ───
  const updateObjProgress = (idx: number, progress: number) => {
    setSelfObjectives((prev) => prev.map((o, i) => (i === idx ? { ...o, selfProgress: progress } : o)));
  };
  const updateObjComment = (idx: number, comment: string) => {
    setSelfObjectives((prev) => prev.map((o, i) => (i === idx ? { ...o, selfComment: comment } : o)));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B3A5C]" />
      </div>
    );
  }

  const isEditable = selected?.status === "DRAFT_EMPLOYEE";
  const statusCfg = selected ? STATUS_CONFIG[selected.status] : null;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon entretien annuel</h1>
          <p className="mt-1 text-sm text-gray-500">
            Préparez votre auto-évaluation et soumettez-la à votre manager
          </p>
        </div>
        {!entretiens.find((e) => e.year === currentYear) && (
          <button
            onClick={createEntretien}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Créer l&apos;entretien {currentYear}
          </button>
        )}
      </div>

      {/* Year selector if multiple entretiens */}
      {entretiens.length > 1 && (
        <div className="mb-6 flex gap-2 overflow-x-auto">
          {entretiens.map((e) => (
            <button
              key={e.id}
              onClick={() => { setSelectedId(e.id); loadFormData(e); }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                selectedId === e.id
                  ? "border-[#1B3A5C] bg-[#1B3A5C] text-white"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {e.year}
            </button>
          ))}
        </div>
      )}

      {!selected && entretiens.length === 0 && (
        <div className="rounded-lg border bg-white p-8 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Aucun entretien pour le moment.</p>
          <p className="mt-1 text-sm text-gray-400">
            Créez votre entretien annuel pour commencer votre auto-évaluation.
          </p>
        </div>
      )}

      {selected && (
        <div className="space-y-6">
          {/* Status banner */}
          {statusCfg && (
            <div className={`flex items-center gap-3 rounded-lg border p-4 ${statusCfg.bg}`}>
              <statusCfg.icon className={`h-5 w-5 ${statusCfg.color}`} />
              <div>
                <p className={`font-medium ${statusCfg.color}`}>{statusCfg.label}</p>
                <p className="text-sm text-gray-500">
                  Manager : {selected.manager.firstName} {selected.manager.lastName}
                  {" • "}Année : {selected.year}
                </p>
              </div>
            </div>
          )}

          {/* ═══ SKILLS SECTION ═══ */}
          <div className="rounded-lg border bg-white p-4 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Star className="h-5 w-5 text-[#1B3A5C]" />
              Compétences — Auto-évaluation
            </h2>

            {selfSkills.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Aucune compétence déclarée. Ajoutez des compétences dans votre profil.
              </p>
            ) : (
              <div className="space-y-4">
                {selfSkills.map((skill, idx) => (
                  <div key={skill.skillId} className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{skill.skillName}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {skill.type}
                      </span>
                    </div>

                    {/* Level selector */}
                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-medium text-gray-500">Mon niveau</label>
                      <div className="flex flex-wrap gap-2">
                        {SKILL_LEVELS.map((lvl) => (
                          <button
                            key={lvl}
                            disabled={!isEditable}
                            onClick={() => updateSkillLevel(idx, lvl)}
                            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                              skill.selfLevel === lvl
                                ? "border-[#1B3A5C] bg-[#1B3A5C] text-white"
                                : "border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            }`}
                          >
                            {SKILL_LEVEL_LABELS[lvl]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Comment */}
                    <div className="mt-3">
                      <label className="mb-1.5 block text-xs font-medium text-gray-500">Commentaire</label>
                      <textarea
                        value={skill.comment}
                        onChange={(e) => updateSkillComment(idx, e.target.value)}
                        disabled={!isEditable}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C] disabled:bg-gray-50"
                        rows={2}
                        placeholder="Exemples concrets, certifications, projets réalisés..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ═══ OBJECTIVES SECTION ═══ */}
          <div className="rounded-lg border bg-white p-4 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Target className="h-5 w-5 text-[#1B3A5C]" />
              Objectifs — Auto-évaluation
            </h2>

            {selfObjectives.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Aucun objectif assigné. Votre manager définira vos objectifs.
              </p>
            ) : (
              <div className="space-y-4">
                {selfObjectives.map((obj, idx) => {
                  const statusLabel = OBJ_STATUS_LABELS[obj.status] || obj.status;
                  return (
                    <div key={obj.objectiveId} className="rounded-lg border p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{obj.title}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {statusLabel}
                        </span>
                      </div>

                      {/* Progress slider */}
                      <div className="mt-3">
                        <label className="mb-1.5 block text-xs font-medium text-gray-500">
                          Ma progression : {obj.selfProgress}%
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={obj.selfProgress}
                          onChange={(e) => updateObjProgress(idx, parseInt(e.target.value))}
                          disabled={!isEditable}
                          className="w-full accent-[#1B3A5C]"
                        />
                      </div>

                      {/* Comment */}
                      <div className="mt-3">
                        <label className="mb-1.5 block text-xs font-medium text-gray-500">Mon commentaire</label>
                        <textarea
                          value={obj.selfComment}
                          onChange={(e) => updateObjComment(idx, e.target.value)}
                          disabled={!isEditable}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C] disabled:bg-gray-50"
                          rows={2}
                          placeholder="Décrivez votre progression, les résultats obtenus, les obstacles..."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══ STRENGTHS & IMPROVEMENTS ═══ */}
          <div className="rounded-lg border bg-white p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Bilan personnel</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Mes points forts</label>
                <textarea
                  value={selfStrengths}
                  onChange={(e) => setSelfStrengths(e.target.value)}
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C] disabled:bg-gray-50"
                  rows={4}
                  placeholder="Ce que je considère comme mes forces cette année..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Mes axes d&apos;amélioration</label>
                <textarea
                  value={selfImprovements}
                  onChange={(e) => setSelfImprovements(e.target.value)}
                  disabled={!isEditable}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C] disabled:bg-gray-50"
                  rows={4}
                  placeholder="Les domaines où je souhaite progresser..."
                />
              </div>
            </div>
          </div>

          {/* ═══ REPORT (read-only, shown when COMPLETED) ═══ */}
          {selected.summaryReport && (
            <div className="rounded-lg border bg-white p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <FileText className="h-5 w-5 text-[#1B3A5C]" />
                Rapport comparatif
              </h2>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                {selected.summaryReport}
              </div>
            </div>
          )}

          {selected.finalComment && (
            <div className="rounded-lg border bg-green-50 p-4">
              <p className="text-sm font-medium text-green-700">Commentaire final du manager</p>
              <p className="mt-1 text-sm text-green-600">{selected.finalComment}</p>
            </div>
          )}

          {/* ═══ ACTION BUTTONS ═══ */}
          {isEditable && (
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={saveDraft}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg border border-[#1B3A5C] px-4 py-2.5 text-sm font-semibold text-[#1B3A5C] hover:bg-[#1B3A5C]/5 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer le brouillon
              </button>
              <button
                onClick={submitToManager}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-[#00BCD4] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Soumettre au manager
              </button>
            </div>
          )}

          {selected.status === "DRAFT_MANAGER" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              <p className="font-medium">Auto-évaluation soumise</p>
              <p className="mt-1">
                Votre manager ({selected.manager.firstName} {selected.manager.lastName}) doit maintenant compléter sa partie.
                Vous serez notifié une fois l&apos;entretien complété.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
