"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Loader2, Star, Target, Save, TrendingUp,
  CheckCircle2, Clock, AlertTriangle, XCircle,
  MessageSquare, BarChart3, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

// ─── Types ───

interface SkillData {
  id: string;
  name: string;
  type: string;
  selfLevel: string | null;
  managerLevel: string | null;
  description: string | null;
  evidence: string | null;
  updatedAt: string;
}

interface ObjectiveData {
  id: string;
  title: string;
  description: string;
  deadline: string;
  status: string;
  progress: number | null;
  selfComment: string | null;
  managerComment: string | null;
  manager?: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ───

const SKILL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  TECHNICAL: { label: "Technique", color: "bg-blue-100 text-blue-700" },
  SOFT: { label: "Soft skill", color: "bg-green-100 text-green-700" },
  BEHAVIORAL: { label: "Comportemental", color: "bg-purple-100 text-purple-700" },
  OTHER: { label: "Autre", color: "bg-gray-100 text-gray-600" },
};

const SKILL_LEVEL_LABELS: Record<string, { label: string; value: number }> = {
  BEGINNER: { label: "Débutant", value: 1 },
  INTERMEDIATE: { label: "Intermédiaire", value: 2 },
  ADVANCED: { label: "Avancé", value: 3 },
  EXPERT: { label: "Expert", value: 4 },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  IN_PROGRESS: { label: "En cours", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
  ACHIEVED: { label: "Atteint", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
  PARTIALLY_ACHIEVED: { label: "Partiellement atteint", icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
  NOT_ACHIEVED: { label: "Non atteint", icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  CANCELLED: { label: "Annulé", icon: AlertTriangle, color: "text-gray-500", bg: "bg-gray-50" },
};

function SkillLevelBar({ level, color }: { level: string | null; color: string }) {
  const val = level ? SKILL_LEVEL_LABELS[level]?.value ?? 0 : 0;
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-2.5 w-7 rounded-full ${i <= val ? color : "bg-gray-200"}`}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500">
        {level ? SKILL_LEVEL_LABELS[level]?.label : "Non évalué"}
      </span>
    </div>
  );
}

function SkillComparisonBadge({ selfLevel, managerLevel }: { selfLevel: string | null; managerLevel: string | null }) {
  if (!selfLevel || !managerLevel) return null;
  const selfVal = SKILL_LEVEL_LABELS[selfLevel]?.value ?? 0;
  const mgrVal = SKILL_LEVEL_LABELS[managerLevel]?.value ?? 0;
  if (selfVal === mgrVal) {
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Aligné</span>;
  }
  if (mgrVal > selfVal) {
    return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Manager +</span>;
  }
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Écart</span>;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main Component ───

export default function EntretienPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveData[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "skills" | "objectives">("overview");

  // Self-comment editing
  const [editingObjId, setEditingObjId] = useState<string | null>(null);
  const [selfComment, setSelfComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // ─── Fetch data ───
  const fetchData = useCallback(async () => {
    try {
      const [skillsRes, objectivesRes] = await Promise.all([
        fetch("/api/profile/skills"),
        fetch("/api/profile/objectives"),
      ]);
      if (skillsRes.ok) {
        const data = await skillsRes.json();
        setSkills(data);
      }
      if (objectivesRes.ok) {
        const data = await objectivesRes.json();
        setObjectives(data.objectives || data);
      }
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les données" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Save self-comment ───
  const saveSelfComment = async (objectiveId: string) => {
    if (!selfComment.trim()) return;
    setSavingComment(true);
    try {
      const res = await fetch(`/api/profile/objectives/${objectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfComment }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({ type: "success", title: "Commentaire enregistré" });
      setEditingObjId(null);
      await fetchData();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally { setSavingComment(false); }
  };

  // ─── Computed stats ───
  const skillStats = {
    total: skills.length,
    selfAssessed: skills.filter((s) => s.selfLevel).length,
    managerAssessed: skills.filter((s) => s.managerLevel).length,
    aligned: skills.filter((s) =>
      s.selfLevel && s.managerLevel && s.selfLevel === s.managerLevel
    ).length,
    gaps: skills.filter((s) =>
      s.selfLevel && s.managerLevel && s.selfLevel !== s.managerLevel
    ).length,
  };

  const objStats = {
    total: objectives.length,
    inProgress: objectives.filter((o) => o.status === "IN_PROGRESS").length,
    achieved: objectives.filter((o) => o.status === "ACHIEVED").length,
    partiallyAchieved: objectives.filter((o) => o.status === "PARTIALLY_ACHIEVED").length,
    avgProgress: objectives.length > 0
      ? Math.round(objectives.reduce((acc, o) => acc + (o.progress ?? 0), 0) / objectives.length)
      : 0,
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B3A5C]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mon entretien annuel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Préparez votre auto-évaluation et consultez les retours de votre manager
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
        {[
          { id: "overview" as const, label: "Vue d'ensemble", icon: BarChart3 },
          { id: "skills" as const, label: "Compétences", icon: Star },
          { id: "objectives" as const, label: "Objectifs", icon: Target },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-[#1B3A5C] shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Overview Tab ═══ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-3xl font-bold text-[#1B3A5C]">{skillStats.total}</p>
              <p className="text-xs text-gray-500">Compétences</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-3xl font-bold text-green-600">{skillStats.aligned}</p>
              <p className="text-xs text-gray-500">Éval. alignées</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-3xl font-bold text-[#00BCD4]">{objStats.achieved}</p>
              <p className="text-xs text-gray-500">Objectifs atteints</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-3xl font-bold text-amber-600">{objStats.avgProgress}%</p>
              <p className="text-xs text-gray-500">Progression moy.</p>
            </div>
          </div>

          {/* Skills comparison summary */}
          {skills.filter((s) => s.selfLevel && s.managerLevel).length > 0 && (
            <div className="rounded-lg border bg-white p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Star className="h-5 w-5 text-[#1B3A5C]" />
                Rapport comparatif — Compétences
              </h2>
              <div className="space-y-3">
                {skills
                  .filter((s) => s.selfLevel && s.managerLevel)
                  .map((skill) => {
                    const selfVal = SKILL_LEVEL_LABELS[skill.selfLevel!]?.value ?? 0;
                    const mgrVal = SKILL_LEVEL_LABELS[skill.managerLevel!]?.value ?? 0;
                    return (
                      <div key={skill.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{skill.name}</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SKILL_TYPE_LABELS[skill.type]?.color || ""}`}>
                              {SKILL_TYPE_LABELS[skill.type]?.label || skill.type}
                            </span>
                          </div>
                          <SkillComparisonBadge selfLevel={skill.selfLevel} managerLevel={skill.managerLevel} />
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs text-gray-400">Mon évaluation</span>
                            <div className="mt-0.5 flex items-center gap-1">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className={`h-3 w-8 rounded-full ${i <= selfVal ? "bg-blue-500" : "bg-gray-200"}`} />
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400">Évaluation manager</span>
                            <div className="mt-0.5 flex items-center gap-1">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className={`h-3 w-8 rounded-full ${i <= mgrVal ? "bg-green-500" : "bg-gray-200"}`} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Objectives summary */}
          {objectives.length > 0 && (
            <div className="rounded-lg border bg-white p-4 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                <Target className="h-5 w-5 text-[#1B3A5C]" />
                Bilan des objectifs
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "En cours", value: objStats.inProgress, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Atteints", value: objStats.achieved, color: "text-green-600", bg: "bg-green-50" },
                  { label: "Partiels", value: objStats.partiallyAchieved, color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "Total", value: objStats.total, color: "text-gray-700", bg: "bg-gray-50" },
                ].map((stat) => (
                  <div key={stat.label} className={`rounded-lg ${stat.bg} p-3 text-center`}>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {skills.length === 0 && objectives.length === 0 && (
            <div className="rounded-lg border bg-white p-8 text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Aucune donnée d&apos;entretien disponible.</p>
              <p className="mt-1 text-sm text-gray-400">
                Commencez par ajouter des compétences dans votre profil. Votre manager définira vos objectifs.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ Skills Tab ═══ */}
      {activeTab === "skills" && (
        <div className="space-y-3">
          {skills.length === 0 ? (
            <div className="rounded-lg border bg-white p-8 text-center">
              <Star className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Aucune compétence déclarée.</p>
              <p className="mt-1 text-sm text-gray-400">
                Ajoutez vos compétences depuis votre profil pour préparer votre entretien.
              </p>
            </div>
          ) : (
            skills.map((skill) => (
              <div key={skill.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{skill.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SKILL_TYPE_LABELS[skill.type]?.color || ""}`}>
                      {SKILL_TYPE_LABELS[skill.type]?.label || skill.type}
                    </span>
                  </div>
                  <SkillComparisonBadge selfLevel={skill.selfLevel} managerLevel={skill.managerLevel} />
                </div>
                {skill.description && <p className="mt-1 text-sm text-gray-500">{skill.description}</p>}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-blue-50/50 p-2.5">
                    <span className="text-xs font-medium text-blue-700">Mon auto-évaluation</span>
                    <SkillLevelBar level={skill.selfLevel} color="bg-blue-500" />
                    {skill.evidence && (
                      <p className="mt-1 text-xs text-blue-600">💡 {skill.evidence}</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-green-50/50 p-2.5">
                    <span className="text-xs font-medium text-green-700">Évaluation manager</span>
                    <SkillLevelBar level={skill.managerLevel} color="bg-green-500" />
                    {!skill.managerLevel && (
                      <p className="mt-1 text-xs text-gray-400 italic">En attente d&apos;évaluation</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ Objectives Tab ═══ */}
      {activeTab === "objectives" && (
        <div className="space-y-3">
          {objectives.length === 0 ? (
            <div className="rounded-lg border bg-white p-8 text-center">
              <Target className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Aucun objectif défini.</p>
              <p className="mt-1 text-sm text-gray-400">
                Votre manager définira vos objectifs pour la période en cours.
              </p>
            </div>
          ) : (
            objectives.map((obj) => {
              const statusCfg = STATUS_CONFIG[obj.status] || STATUS_CONFIG.IN_PROGRESS;
              const StatusIcon = statusCfg.icon;
              const isEditing = editingObjId === obj.id;

              return (
                <div key={obj.id} className="rounded-lg border bg-white p-4">
                  <div className="flex items-start gap-3">
                    <StatusIcon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${statusCfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{obj.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color} ${statusCfg.bg}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{obj.description}</p>

                      {/* Progress bar */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-[#00BCD4] transition-all"
                            style={{ width: `${obj.progress ?? 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600">{obj.progress ?? 0}%</span>
                      </div>

                      <div className="mt-2 text-xs text-gray-400">
                        Échéance : {formatDate(obj.deadline)}
                        {obj.manager && (
                          <span className="ml-2">• Assigné par {obj.manager.firstName} {obj.manager.lastName}</span>
                        )}
                      </div>

                      {/* Manager comment */}
                      {obj.managerComment && (
                        <div className="mt-3 rounded-lg bg-green-50 p-3">
                          <p className="text-xs font-medium text-green-700">Commentaire de votre manager</p>
                          <p className="mt-1 text-sm text-green-600">{obj.managerComment}</p>
                        </div>
                      )}

                      {/* Self comment (display or edit) */}
                      {isEditing ? (
                        <div className="mt-3">
                          <textarea
                            value={selfComment}
                            onChange={(e) => setSelfComment(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                            rows={3}
                            placeholder="Décrivez votre progression, vos réussites, les difficultés rencontrées..."
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => saveSelfComment(obj.id)}
                              disabled={savingComment || !selfComment.trim()}
                              className="flex items-center gap-1.5 rounded-lg bg-[#1B3A5C] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {savingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Enregistrer
                            </button>
                            <button
                              onClick={() => setEditingObjId(null)}
                              className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          {obj.selfComment ? (
                            <div className="rounded-lg bg-blue-50 p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-blue-700">Mon auto-évaluation</p>
                                <button
                                  onClick={() => { setEditingObjId(obj.id); setSelfComment(obj.selfComment || ""); }}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  Modifier
                                </button>
                              </div>
                              <p className="mt-1 text-sm text-blue-600">{obj.selfComment}</p>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingObjId(obj.id); setSelfComment(""); }}
                              className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-[#1B3A5C] hover:text-[#1B3A5C] transition-colors"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Ajouter mon auto-évaluation
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
