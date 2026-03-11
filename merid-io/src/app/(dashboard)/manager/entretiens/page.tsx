"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Star, Target, Save, Send, CheckCircle2, Clock,
  ChevronDown, ChevronUp, FileText, PlusCircle, Users,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

// ─── Types ───

interface SkillEntry {
  skillId: string;
  skillName: string;
  type: string;
  selfLevel: string | null;
  managerLevel?: string | null;
  comment: string;
}

interface ObjectiveEntry {
  objectiveId: string;
  title: string;
  status: string;
  selfProgress: number;
  selfComment: string;
  managerProgress?: number;
  managerComment?: string;
}

interface EntretienData {
  id: string;
  userId: string;
  year: number;
  status: "DRAFT_EMPLOYEE" | "DRAFT_MANAGER" | "COMPLETED" | "ARCHIVED";
  selfSkills: SkillEntry[] | null;
  selfObjectives: ObjectiveEntry[] | null;
  selfStrengths: string | null;
  selfImprovements: string | null;
  managerSkills: SkillEntry[] | null;
  managerObjectives: ObjectiveEntry[] | null;
  managerStrengths: string | null;
  managerImprovements: string | null;
  summaryReport: string | null;
  finalComment: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePictureUrl: string | null;
  };
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

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT_EMPLOYEE: { label: "En attente (employé)", color: "text-gray-500", bg: "bg-gray-100" },
  DRAFT_MANAGER: { label: "À évaluer", color: "text-amber-700", bg: "bg-amber-100" },
  COMPLETED: { label: "Complété", color: "text-green-700", bg: "bg-green-100" },
  ARCHIVED: { label: "Archivé", color: "text-gray-500", bg: "bg-gray-100" },
};

// ─── Main Component ───

export default function ManagerEntretiensPage() {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [entretiens, setEntretiens] = useState<EntretienData[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; firstName: string; lastName: string }[]>([]);

  // Manager evaluation state (per expanded entretien)
  const [mgrSkills, setMgrSkills] = useState<SkillEntry[]>([]);
  const [mgrObjectives, setMgrObjectives] = useState<ObjectiveEntry[]>([]);
  const [mgrStrengths, setMgrStrengths] = useState("");
  const [mgrImprovements, setMgrImprovements] = useState("");
  const [finalComment, setFinalComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  const fetchData = useCallback(async () => {
    try {
      const [entretiensRes, teamRes] = await Promise.all([
        fetch(`/api/manager/entretiens?year=${currentYear}`),
        fetch("/api/manager/team"),
      ]);

      if (entretiensRes.ok) {
        setEntretiens(await entretiensRes.json());
      }
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        // Extract members from teams
        const members: { id: string; firstName: string; lastName: string }[] = [];
        for (const team of teamData) {
          for (const member of team.members || []) {
            members.push({ id: member.id, firstName: member.firstName, lastName: member.lastName });
          }
        }
        setTeamMembers(members);
      }
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les données" });
    } finally {
      setLoading(false);
    }
  }, [addToast, currentYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load manager form when expanding
  function expandEntretien(e: EntretienData) {
    if (expandedId === e.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(e.id);

    // Init manager skills from self skills (pre-fill structure)
    const selfSkills = (e.selfSkills || []) as SkillEntry[];
    const existingMgrSkills = (e.managerSkills || []) as SkillEntry[];
    const mgrSkillMap = new Map(existingMgrSkills.map((s) => [s.skillId, s]));

    setMgrSkills(
      selfSkills.map((s) => ({
        skillId: s.skillId,
        skillName: s.skillName,
        type: s.type,
        selfLevel: s.selfLevel,
        managerLevel: mgrSkillMap.get(s.skillId)?.managerLevel || null,
        comment: mgrSkillMap.get(s.skillId)?.comment || "",
      }))
    );

    const selfObjectives = (e.selfObjectives || []) as ObjectiveEntry[];
    const existingMgrObjs = (e.managerObjectives || []) as ObjectiveEntry[];
    const mgrObjMap = new Map(existingMgrObjs.map((o) => [o.objectiveId, o]));

    setMgrObjectives(
      selfObjectives.map((o) => ({
        objectiveId: o.objectiveId,
        title: o.title,
        status: o.status,
        selfProgress: o.selfProgress,
        selfComment: o.selfComment,
        managerProgress: mgrObjMap.get(o.objectiveId)?.managerProgress ?? o.selfProgress,
        managerComment: mgrObjMap.get(o.objectiveId)?.managerComment || "",
      }))
    );

    setMgrStrengths(e.managerStrengths || "");
    setMgrImprovements(e.managerImprovements || "");
    setFinalComment(e.finalComment || "");
  }

  // Create entretien for a team member
  const createForMember = async (userId: string) => {
    setCreatingFor(userId);
    try {
      const res = await fetch("/api/manager/entretiens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) throw new Error(data.error || "Erreur");
      addToast({ type: "success", title: res.status === 409 ? "Entretien existant" : "Entretien créé" });
      await fetchData();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setCreatingFor(null);
    }
  };

  // Save manager evaluation
  const saveEvaluation = async (entretienId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/manager/entretiens/${entretienId}/evaluate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          managerSkills: mgrSkills.map((s) => ({
            skillId: s.skillId,
            skillName: s.skillName,
            type: s.type,
            managerLevel: s.managerLevel,
            comment: s.comment,
          })),
          managerObjectives: mgrObjectives.map((o) => ({
            objectiveId: o.objectiveId,
            title: o.title,
            managerProgress: o.managerProgress,
            managerComment: o.managerComment,
          })),
          managerStrengths: mgrStrengths,
          managerImprovements: mgrImprovements,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      addToast({ type: "success", title: "Évaluation enregistrée" });
      await fetchData();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  // Generate report
  const generateReport = async (entretienId: string) => {
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/manager/entretiens/${entretienId}/report`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      addToast({ type: "success", title: "Rapport généré" });
      await fetchData();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setGeneratingReport(false);
    }
  };

  // Complete entretien
  const completeEntretien = async (entretienId: string) => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/manager/entretiens/${entretienId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalComment }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      addToast({ type: "success", title: "Entretien complété" });
      setExpandedId(null);
      await fetchData();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B3A5C]" />
      </div>
    );
  }

  // Find team members without entretien this year
  const entretienUserIds = new Set(entretiens.map((e) => e.userId));
  const membersWithout = teamMembers.filter((m) => !entretienUserIds.has(m.id));

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Entretiens annuels — Mon équipe</h1>
        <p className="mt-1 text-sm text-gray-500">
          Évaluez les compétences et objectifs de vos collaborateurs ({currentYear})
        </p>
      </div>

      {/* Members without entretien */}
      {membersWithout.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-700">
              {membersWithout.length} collaborateur(s) sans entretien cette année
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {membersWithout.map((m) => (
              <button
                key={m.id}
                onClick={() => createForMember(m.id)}
                disabled={creatingFor === m.id}
                className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                {creatingFor === m.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlusCircle className="h-3.5 w-3.5" />
                )}
                {m.firstName} {m.lastName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-[#1B3A5C]">{entretiens.length}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-500">{entretiens.filter((e) => e.status === "DRAFT_EMPLOYEE").length}</p>
          <p className="text-xs text-gray-500">En attente employé</p>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{entretiens.filter((e) => e.status === "DRAFT_MANAGER").length}</p>
          <p className="text-xs text-gray-500">À évaluer</p>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{entretiens.filter((e) => e.status === "COMPLETED").length}</p>
          <p className="text-xs text-gray-500">Complétés</p>
        </div>
      </div>

      {entretiens.length === 0 && membersWithout.length === 0 && (
        <div className="rounded-lg border bg-white p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Aucun membre dans votre équipe.</p>
        </div>
      )}

      {/* Entretien list */}
      <div className="space-y-3">
        {entretiens.map((e) => {
          const statusCfg = STATUS_LABELS[e.status];
          const isExpanded = expandedId === e.id;
          const canEvaluate = e.status === "DRAFT_MANAGER";

          return (
            <div key={e.id} className="rounded-lg border bg-white">
              {/* Header */}
              <button
                onClick={() => expandEntretien(e)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B3A5C]/10 text-sm font-bold text-[#1B3A5C]">
                    {e.user.firstName[0]}{e.user.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{e.user.firstName} {e.user.lastName}</p>
                    <p className="text-xs text-gray-500">{e.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusCfg.color} ${statusCfg.bg}`}>
                    {statusCfg.label}
                  </span>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t p-4 sm:p-6 space-y-6">
                  {/* Employee self-evaluation (read-only for manager) */}
                  {e.selfSkills && (e.selfSkills as SkillEntry[]).length > 0 && (
                    <div>
                      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
                        <Star className="h-4 w-4 text-blue-500" />
                        Auto-évaluation — Compétences
                      </h3>
                      <div className="space-y-2">
                        {(e.selfSkills as SkillEntry[]).map((s) => (
                          <div key={s.skillId} className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
                            <div>
                              <span className="text-sm font-medium text-gray-900">{s.skillName}</span>
                              {s.comment && <p className="text-xs text-gray-500 mt-0.5">{s.comment}</p>}
                            </div>
                            <span className="rounded-full bg-blue-200 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              {s.selfLevel ? SKILL_LEVEL_LABELS[s.selfLevel] : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {e.selfObjectives && (e.selfObjectives as ObjectiveEntry[]).length > 0 && (
                    <div>
                      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
                        <Target className="h-4 w-4 text-blue-500" />
                        Auto-évaluation — Objectifs
                      </h3>
                      <div className="space-y-2">
                        {(e.selfObjectives as ObjectiveEntry[]).map((o) => (
                          <div key={o.objectiveId} className="rounded-lg bg-blue-50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">{o.title}</span>
                              <span className="text-sm font-medium text-blue-700">{o.selfProgress}%</span>
                            </div>
                            {o.selfComment && <p className="text-xs text-gray-500 mt-1">{o.selfComment}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {e.selfStrengths && (
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-xs font-medium text-blue-700">Points forts (employé)</p>
                      <p className="mt-1 text-sm text-gray-700">{e.selfStrengths}</p>
                    </div>
                  )}
                  {e.selfImprovements && (
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-xs font-medium text-blue-700">Axes d&apos;amélioration (employé)</p>
                      <p className="mt-1 text-sm text-gray-700">{e.selfImprovements}</p>
                    </div>
                  )}

                  {/* Manager evaluation form */}
                  {canEvaluate && (
                    <>
                      <hr />
                      <h3 className="text-lg font-semibold text-gray-900">Mon évaluation</h3>

                      {/* Manager skills */}
                      {mgrSkills.length > 0 && (
                        <div>
                          <h4 className="mb-3 flex items-center gap-2 text-base font-medium text-gray-900">
                            <Star className="h-4 w-4 text-green-500" />
                            Compétences
                          </h4>
                          <div className="space-y-3">
                            {mgrSkills.map((s, idx) => (
                              <div key={s.skillId} className="rounded-lg border p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium text-gray-900">{s.skillName}</span>
                                  <span className="text-xs text-gray-400">
                                    (employé : {s.selfLevel ? SKILL_LEVEL_LABELS[s.selfLevel] : "—"})
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {SKILL_LEVELS.map((lvl) => (
                                    <button
                                      key={lvl}
                                      onClick={() =>
                                        setMgrSkills((prev) =>
                                          prev.map((sk, i) => (i === idx ? { ...sk, managerLevel: lvl } : sk))
                                        )
                                      }
                                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                                        s.managerLevel === lvl
                                          ? "border-green-600 bg-green-600 text-white"
                                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                      }`}
                                    >
                                      {SKILL_LEVEL_LABELS[lvl]}
                                    </button>
                                  ))}
                                </div>
                                <textarea
                                  value={s.comment}
                                  onChange={(e) =>
                                    setMgrSkills((prev) =>
                                      prev.map((sk, i) => (i === idx ? { ...sk, comment: e.target.value } : sk))
                                    )
                                  }
                                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                                  rows={1}
                                  placeholder="Commentaire manager..."
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Manager objectives */}
                      {mgrObjectives.length > 0 && (
                        <div>
                          <h4 className="mb-3 flex items-center gap-2 text-base font-medium text-gray-900">
                            <Target className="h-4 w-4 text-green-500" />
                            Objectifs
                          </h4>
                          <div className="space-y-3">
                            {mgrObjectives.map((o, idx) => (
                              <div key={o.objectiveId} className="rounded-lg border p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-900">{o.title}</span>
                                  <span className="text-xs text-gray-400">employé : {o.selfProgress}%</span>
                                </div>
                                <div className="mb-2">
                                  <label className="text-xs text-gray-500">
                                    Mon évaluation : {o.managerProgress ?? 0}%
                                  </label>
                                  <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={o.managerProgress ?? 0}
                                    onChange={(ev) =>
                                      setMgrObjectives((prev) =>
                                        prev.map((ob, i) =>
                                          i === idx ? { ...ob, managerProgress: parseInt(ev.target.value) } : ob
                                        )
                                      )
                                    }
                                    className="w-full accent-green-600"
                                  />
                                </div>
                                <textarea
                                  value={o.managerComment || ""}
                                  onChange={(ev) =>
                                    setMgrObjectives((prev) =>
                                      prev.map((ob, i) =>
                                        i === idx ? { ...ob, managerComment: ev.target.value } : ob
                                      )
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                                  rows={1}
                                  placeholder="Commentaire manager..."
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Manager strengths/improvements */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">Points forts</label>
                          <textarea
                            value={mgrStrengths}
                            onChange={(ev) => setMgrStrengths(ev.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                            rows={3}
                            placeholder="Points forts identifiés..."
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">Axes d&apos;amélioration</label>
                          <textarea
                            value={mgrImprovements}
                            onChange={(ev) => setMgrImprovements(ev.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                            rows={3}
                            placeholder="Points à améliorer..."
                          />
                        </div>
                      </div>

                      {/* Final comment */}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Commentaire final (optionnel)</label>
                        <textarea
                          value={finalComment}
                          onChange={(ev) => setFinalComment(ev.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                          rows={2}
                          placeholder="Bilan global, recommandations pour l'année prochaine..."
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => saveEvaluation(e.id)}
                          disabled={saving}
                          className="flex items-center gap-2 rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Enregistrer
                        </button>
                        <button
                          onClick={() => generateReport(e.id)}
                          disabled={generatingReport}
                          className="flex items-center gap-2 rounded-lg border border-[#1B3A5C] px-4 py-2 text-sm font-semibold text-[#1B3A5C] hover:bg-[#1B3A5C]/5 disabled:opacity-50"
                        >
                          {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                          Générer le rapport
                        </button>
                        <button
                          onClick={() => completeEntretien(e.id)}
                          disabled={completing}
                          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Compléter l&apos;entretien
                        </button>
                      </div>
                    </>
                  )}

                  {/* Show report if exists */}
                  {e.summaryReport && (
                    <div className="rounded-lg border bg-gray-50 p-4">
                      <h4 className="mb-2 flex items-center gap-2 text-base font-medium text-gray-900">
                        <FileText className="h-4 w-4" /> Rapport comparatif
                      </h4>
                      <div className="whitespace-pre-wrap text-sm text-gray-700">
                        {e.summaryReport}
                      </div>
                    </div>
                  )}

                  {e.status === "COMPLETED" && e.finalComment && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                      <p className="text-sm font-medium text-green-700">Commentaire final</p>
                      <p className="mt-1 text-sm text-green-600">{e.finalComment}</p>
                    </div>
                  )}

                  {e.status === "DRAFT_EMPLOYEE" && (
                    <div className="rounded-lg bg-gray-50 border p-4 text-sm text-gray-500">
                      <Clock className="inline h-4 w-4 mr-1" />
                      {e.user.firstName} n&apos;a pas encore soumis son auto-évaluation.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
