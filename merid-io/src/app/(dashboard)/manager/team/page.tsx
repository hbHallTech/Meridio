"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Loader2, Users, Star, Target, ChevronRight, ChevronDown,
  Pencil, Plus, Trash2, Save, X, TrendingUp,
  CheckCircle2, Clock, AlertTriangle, XCircle, Smile, Heart,
} from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
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
  managerId: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePictureUrl: string | null;
  jobFunction: string | null;
  teamId: string;
  skills: SkillData[];
  objectives: ObjectiveData[];
}

interface TeamInfo {
  id: string;
  name: string;
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

const SKILL_LEVEL_OPTIONS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  IN_PROGRESS: { label: "En cours", icon: Clock, color: "text-blue-600" },
  ACHIEVED: { label: "Atteint", icon: CheckCircle2, color: "text-green-600" },
  PARTIALLY_ACHIEVED: { label: "Partiellement atteint", icon: TrendingUp, color: "text-amber-600" },
  NOT_ACHIEVED: { label: "Non atteint", icon: XCircle, color: "text-red-600" },
  CANCELLED: { label: "Annulé", icon: AlertTriangle, color: "text-gray-500" },
};

const OBJECTIVE_STATUS_OPTIONS = ["IN_PROGRESS", "ACHIEVED", "PARTIALLY_ACHIEVED", "NOT_ACHIEVED", "CANCELLED"] as const;

function SkillLevelBar({ level, color }: { level: string | null; color: string }) {
  const val = level ? SKILL_LEVEL_LABELS[level]?.value ?? 0 : 0;
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-2 w-6 rounded-full ${i <= val ? color : "bg-gray-200"}`}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500">
        {level ? SKILL_LEVEL_LABELS[level]?.label : "Non évalué"}
      </span>
    </div>
  );
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main Component ───

export default function ManagerTeamPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"skills" | "objectives">("skills");

  // Skill assessment dialog
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [assessingSkill, setAssessingSkill] = useState<SkillData | null>(null);
  const [assessingMemberId, setAssessingMemberId] = useState<string>("");
  const [managerLevel, setManagerLevel] = useState<string>("");
  const [savingSkill, setSavingSkill] = useState(false);

  // Objective dialog
  const [objectiveDialogOpen, setObjectiveDialogOpen] = useState(false);
  const [editingObjective, setEditingObjective] = useState<ObjectiveData | null>(null);
  const [objectiveMemberId, setObjectiveMemberId] = useState<string>("");
  const [objForm, setObjForm] = useState({
    title: "", description: "", deadline: "", status: "IN_PROGRESS", progress: 0, managerComment: "",
  });
  const [savingObjective, setSavingObjective] = useState(false);

  // Delete objective
  const [deleteObjOpen, setDeleteObjOpen] = useState(false);
  const [deleteObjId, setDeleteObjId] = useState<string>("");
  const [deleteObjMemberId, setDeleteObjMemberId] = useState<string>("");

  // Pulse KPIs
  const [pulseData, setPulseData] = useState<{
    moodAverage: number | null;
    moodTotal: number;
    shoutoutsThisWeek: number;
  } | null>(null);

  // ─── Fetch ───
  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/manager/team");
      if (!res.ok) throw new Error("Erreur chargement");
      const data = await res.json();
      setTeams(data.teams);
      setMembers(data.members);
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger l'équipe" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  useEffect(() => {
    fetch("/api/hr/mood-stats?period=week")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setPulseData({
            moodAverage: data.average,
            moodTotal: data.total,
            shoutoutsThisWeek: 0,
          });
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  // ─── Skill assessment ───
  const openSkillAssess = (member: TeamMember, skill: SkillData) => {
    setAssessingMemberId(member.id);
    setAssessingSkill(skill);
    setManagerLevel(skill.managerLevel || "");
    setSkillDialogOpen(true);
  };

  const saveSkillAssessment = async () => {
    if (!assessingSkill || !managerLevel) return;
    setSavingSkill(true);
    try {
      const res = await fetch(`/api/users/${assessingMemberId}/skills/${assessingSkill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerLevel }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({ type: "success", title: "Évaluation enregistrée" });
      setSkillDialogOpen(false);
      await fetchTeam();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally { setSavingSkill(false); }
  };

  // ─── Objectives CRUD ───
  const openAddObjective = (memberId: string) => {
    setObjectiveMemberId(memberId);
    setEditingObjective(null);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 3);
    setObjForm({
      title: "", description: "", deadline: nextMonth.toISOString().split("T")[0],
      status: "IN_PROGRESS", progress: 0, managerComment: "",
    });
    setObjectiveDialogOpen(true);
  };

  const openEditObjective = (memberId: string, obj: ObjectiveData) => {
    setObjectiveMemberId(memberId);
    setEditingObjective(obj);
    setObjForm({
      title: obj.title,
      description: obj.description,
      deadline: new Date(obj.deadline).toISOString().split("T")[0],
      status: obj.status,
      progress: obj.progress ?? 0,
      managerComment: obj.managerComment || "",
    });
    setObjectiveDialogOpen(true);
  };

  const saveObjective = async () => {
    if (!objForm.title || !objForm.description || !objForm.deadline) {
      addToast({ type: "error", title: "Champs requis", message: "Titre, description et échéance sont obligatoires" });
      return;
    }
    setSavingObjective(true);
    try {
      const url = editingObjective
        ? `/api/users/${objectiveMemberId}/objectives/${editingObjective.id}`
        : `/api/users/${objectiveMemberId}/objectives`;
      const res = await fetch(url, {
        method: editingObjective ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(objForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({ type: "success", title: editingObjective ? "Objectif mis à jour" : "Objectif créé" });
      setObjectiveDialogOpen(false);
      await fetchTeam();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally { setSavingObjective(false); }
  };

  const confirmDeleteObjective = (memberId: string, objId: string) => {
    setDeleteObjMemberId(memberId);
    setDeleteObjId(objId);
    setDeleteObjOpen(true);
  };

  const deleteObjective = async () => {
    try {
      const res = await fetch(`/api/users/${deleteObjMemberId}/objectives/${deleteObjId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
      addToast({ type: "success", title: "Objectif annulé" });
      setDeleteObjOpen(false);
      await fetchTeam();
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible d'annuler l'objectif" });
    }
  };

  // ─── Render ───
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1B3A5C]" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-gray-900">Mon équipe</h1>
        <div className="mt-8 rounded-lg border bg-white p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Vous ne gérez aucune équipe pour le moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mon équipe</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gérez les compétences et objectifs de vos collaborateurs
        </p>
      </div>

      {/* Team summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{members.length}</p>
              <p className="text-xs text-gray-500">Collaborateurs</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <Star className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {members.reduce((acc, m) => acc + m.skills.filter((s) => s.managerLevel).length, 0)}
                /{members.reduce((acc, m) => acc + m.skills.length, 0)}
              </p>
              <p className="text-xs text-gray-500">Compétences évaluées</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Target className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {members.reduce((acc, m) => acc + m.objectives.filter((o) => o.status === "IN_PROGRESS").length, 0)}
              </p>
              <p className="text-xs text-gray-500">Objectifs en cours</p>
            </div>
          </div>
        </div>
        {pulseData && (
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50">
                <Smile className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${pulseData.moodAverage !== null ? (pulseData.moodAverage >= 4 ? "text-green-600" : pulseData.moodAverage >= 3 ? "text-amber-500" : "text-red-500") : "text-gray-400"}`}>
                  {pulseData.moodAverage !== null ? `${pulseData.moodAverage.toFixed(1)}/5` : "—"}
                </p>
                <p className="text-xs text-gray-500">Humeur équipe (7j)</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Members list */}
      <div className="space-y-3">
        {members.map((member) => {
          const isExpanded = expandedMember === member.id;
          const teamName = teams.find((t) => t.id === member.teamId)?.name;
          const skillsAssessed = member.skills.filter((s) => s.managerLevel).length;
          const objInProgress = member.objectives.filter((o) => o.status === "IN_PROGRESS").length;
          const objAchieved = member.objectives.filter((o) => o.status === "ACHIEVED").length;

          return (
            <div key={member.id} className="rounded-lg border bg-white">
              {/* Member header */}
              <button
                onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                className="flex w-full items-center gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B3A5C] text-white font-semibold text-sm">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {member.jobFunction || member.email}
                    {teamName && <span className="ml-2 text-gray-400">• {teamName}</span>}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" /> {skillsAssessed}/{member.skills.length} compétences
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" /> {objInProgress} en cours, {objAchieved} atteints
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t px-4 pb-4">
                  {/* Section tabs */}
                  <div className="flex gap-1 border-b py-2">
                    <button
                      onClick={() => setActiveSection("skills")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        activeSection === "skills"
                          ? "bg-[#1B3A5C] text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Star className="h-4 w-4" /> Compétences ({member.skills.length})
                    </button>
                    <button
                      onClick={() => setActiveSection("objectives")}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        activeSection === "objectives"
                          ? "bg-[#1B3A5C] text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <Target className="h-4 w-4" /> Objectifs ({member.objectives.length})
                    </button>
                  </div>

                  {/* Skills section */}
                  {activeSection === "skills" && (
                    <div className="mt-3">
                      {member.skills.length === 0 ? (
                        <p className="py-4 text-center text-sm text-gray-400">
                          Aucune compétence déclarée par ce collaborateur
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {member.skills.map((skill) => (
                            <div key={skill.id} className="group flex items-start gap-3 rounded-lg border p-3 hover:bg-gray-50">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm text-gray-900">{skill.name}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SKILL_TYPE_LABELS[skill.type]?.color || "bg-gray-100 text-gray-600"}`}>
                                    {SKILL_TYPE_LABELS[skill.type]?.label || skill.type}
                                  </span>
                                </div>
                                {skill.description && (
                                  <p className="mt-1 text-xs text-gray-500">{skill.description}</p>
                                )}
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-xs text-gray-400">Auto-évaluation :</span>
                                    <SkillLevelBar level={skill.selfLevel} color="bg-blue-500" />
                                  </div>
                                  <div>
                                    <span className="text-xs text-gray-400">Évaluation manager :</span>
                                    <SkillLevelBar level={skill.managerLevel} color="bg-green-500" />
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => openSkillAssess(member, skill)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[#1B3A5C] sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                                title="Évaluer"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Objectives section */}
                  {activeSection === "objectives" && (
                    <div className="mt-3">
                      <div className="mb-3 flex justify-end">
                        <button
                          onClick={() => openAddObjective(member.id)}
                          className="flex items-center gap-1.5 rounded-lg bg-[#1B3A5C] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                        >
                          <Plus className="h-4 w-4" /> Nouvel objectif
                        </button>
                      </div>
                      {member.objectives.length === 0 ? (
                        <p className="py-4 text-center text-sm text-gray-400">
                          Aucun objectif défini pour ce collaborateur
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {member.objectives.map((obj) => {
                            const statusCfg = STATUS_CONFIG[obj.status] || STATUS_CONFIG.IN_PROGRESS;
                            const StatusIcon = statusCfg.icon;
                            return (
                              <div key={obj.id} className="group rounded-lg border p-3 hover:bg-gray-50">
                                <div className="flex items-start gap-3">
                                  <StatusIcon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${statusCfg.color}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-sm text-gray-900">{obj.title}</span>
                                      <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{obj.description}</p>

                                    {/* Progress bar */}
                                    <div className="mt-2 flex items-center gap-2">
                                      <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                                        <div
                                          className="h-1.5 rounded-full bg-[#00BCD4] transition-all"
                                          style={{ width: `${obj.progress ?? 0}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium text-gray-600">{obj.progress ?? 0}%</span>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                                      <span>Échéance : {formatDate(obj.deadline)}</span>
                                      {obj.selfComment && <span className="text-blue-500">• Auto-évaluation renseignée</span>}
                                    </div>

                                    {/* Comments */}
                                    {obj.selfComment && (
                                      <div className="mt-2 rounded-lg bg-blue-50 p-2 text-xs">
                                        <span className="font-medium text-blue-700">Commentaire collaborateur :</span>
                                        <p className="mt-0.5 text-blue-600">{obj.selfComment}</p>
                                      </div>
                                    )}
                                    {obj.managerComment && (
                                      <div className="mt-1 rounded-lg bg-green-50 p-2 text-xs">
                                        <span className="font-medium text-green-700">Commentaire manager :</span>
                                        <p className="mt-0.5 text-green-600">{obj.managerComment}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Action buttons */}
                                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                                    <button
                                      onClick={() => openEditObjective(member.id, obj)}
                                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[#1B3A5C]"
                                      title="Modifier"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    {obj.status !== "CANCELLED" && (
                                      <button
                                        onClick={() => confirmDeleteObjective(member.id, obj.id)}
                                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                        title="Annuler"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Skill Assessment Dialog ─── */}
      <Dialog
        open={skillDialogOpen}
        onClose={() => setSkillDialogOpen(false)}
        title={`Évaluer : ${assessingSkill?.name || ""}`}
      >
        <div className="space-y-4">
          {assessingSkill && (
            <>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs font-medium text-blue-700">Auto-évaluation du collaborateur</p>
                <SkillLevelBar level={assessingSkill.selfLevel} color="bg-blue-500" />
                {assessingSkill.evidence && (
                  <p className="mt-1 text-xs text-blue-600">Justification : {assessingSkill.evidence}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Votre évaluation
                </label>
                <select
                  value={managerLevel}
                  onChange={(e) => setManagerLevel(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                >
                  <option value="">— Sélectionner —</option>
                  {SKILL_LEVEL_OPTIONS.map((lvl) => (
                    <option key={lvl} value={lvl}>{SKILL_LEVEL_LABELS[lvl].label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setSkillDialogOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={saveSkillAssessment}
              disabled={!managerLevel || savingSkill}
              className="flex items-center gap-1.5 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {savingSkill ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>
        </div>
      </Dialog>

      {/* ─── Objective Dialog ─── */}
      <Dialog
        open={objectiveDialogOpen}
        onClose={() => setObjectiveDialogOpen(false)}
        title={editingObjective ? "Modifier l'objectif" : "Nouvel objectif"}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Titre *</label>
            <input
              value={objForm.title}
              onChange={(e) => setObjForm({ ...objForm, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              placeholder="Ex: Améliorer la couverture de tests à 80%"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
            <textarea
              value={objForm.description}
              onChange={(e) => setObjForm({ ...objForm, description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              rows={3}
              placeholder="Décrivez l'objectif en détail, les critères de succès..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Échéance *</label>
              <input
                type="date"
                value={objForm.deadline}
                onChange={(e) => setObjForm({ ...objForm, deadline: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Statut</label>
              <select
                value={objForm.status}
                onChange={(e) => setObjForm({ ...objForm, status: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              >
                {OBJECTIVE_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Progression ({objForm.progress}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={objForm.progress}
                onChange={(e) => setObjForm({ ...objForm, progress: parseInt(e.target.value) })}
                className="w-full accent-[#1B3A5C]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Commentaire manager</label>
            <textarea
              value={objForm.managerComment}
              onChange={(e) => setObjForm({ ...objForm, managerComment: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              rows={2}
              placeholder="Votre feedback ou remarques..."
            />
          </div>

          {/* Show employee self-comment if editing */}
          {editingObjective?.selfComment && (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-700">Commentaire du collaborateur</p>
              <p className="mt-1 text-sm text-blue-600">{editingObjective.selfComment}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setObjectiveDialogOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={saveObjective}
              disabled={savingObjective}
              className="flex items-center gap-1.5 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {savingObjective ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingObjective ? "Mettre à jour" : "Créer l'objectif"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* ─── Delete Objective Confirm ─── */}
      <ConfirmDialog
        open={deleteObjOpen}
        onClose={() => setDeleteObjOpen(false)}
        onConfirm={deleteObjective}
        title="Annuler l'objectif"
        message="Voulez-vous vraiment annuler cet objectif ? Le statut sera changé en « Annulé »."
        confirmLabel="Annuler l'objectif"
      />
    </div>
  );
}
