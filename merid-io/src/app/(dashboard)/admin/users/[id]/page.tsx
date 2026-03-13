"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2, ArrowLeft, Save, User, Briefcase, FileText, Star, Target,
  KeyRound, Copy, Check, Mail, Plus, Pencil, Trash2, Phone, MapPin,
  Heart, Baby, Flag, Hash, Globe, Calendar,
} from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  userSchema,
  userPersonalSchema,
  userProfessionalSchema,
  emergencyContactSchema,
  skillManagerUpdateSchema,
  type UserPersonalInput,
  type UserProfessionalInput,
  type EmergencyContactInput,
} from "@/lib/validators";

// ─── Schemas ───

const identitySchema = userSchema.extend({
  isActive: z.boolean().optional(),
  password: z.string().optional(),
  forcePasswordChange: z.boolean().optional(),
  sendNotification: z.boolean().optional(),
});
type IdentityForm = z.infer<typeof identitySchema>;

// ─── Types ───

interface EmergencyContact {
  id: string;
  priority: number;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  mobile: string | null;
  email: string | null;
  address: string | null;
}

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

interface ContractData {
  id: string;
  type: string;
  status: string;
  contractNumber: string | null;
  startDate: string;
  endDate: string | null;
  trialPeriodEnd: string | null;
  weeklyHours: number | null;
  salaryGrossMonthly: number | null;
  currency: string;
  jobTitle: string;
  department: string | null;
  location: string | null;
  remoteAllowed: boolean;
  remotePercentage: number | null;
  notes: string | null;
}

interface UserDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  cin: string | null;
  cnss: string | null;
  roles: string[];
  isActive: boolean;
  hireDate: string;
  language: string;
  forcePasswordChange: boolean;
  profilePictureUrl: string | null;
  officeId: string;
  teamId: string | null;
  office: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  personalEmail: string | null;
  personalPhone: string | null;
  personalMobile: string | null;
  personalAddressStreet: string | null;
  personalAddressZip: string | null;
  personalAddressCity: string | null;
  personalAddressCountry: string | null;
  birthDate: string | null;
  birthCity: string | null;
  birthCountry: string | null;
  nationality: string | null;
  gender: string | null;
  maritalStatus: string | null;
  dependentsCount: number;
  professionalPhone: string | null;
  internalNumber: string | null;
  service: string | null;
  jobFunction: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  accountingCode: string | null;
  emergencyContacts: EmergencyContact[];
  skills: SkillData[];
  contracts: ContractData[];
}

interface OfficeOption { id: string; name: string; }
interface TeamOption { id: string; name: string; }

// ─── Constants ───

const ALL_ROLES = ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] as const;
type TabId = "identite" | "personnel" | "professionnel" | "contrat" | "competences";

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: "identite", label: "Identité", icon: User },
  { id: "personnel", label: "Personnel", icon: Heart },
  { id: "professionnel", label: "Professionnel", icon: Briefcase },
  { id: "contrat", label: "Contrat", icon: FileText },
  { id: "competences", label: "Compétences", icon: Star },
];

const GENDER_LABELS: Record<string, string> = {
  MALE: "Homme",
  FEMALE: "Femme",
  OTHER: "Autre",
  PREFER_NOT_TO_SAY: "Ne souhaite pas préciser",
};

const MARITAL_LABELS: Record<string, string> = {
  SINGLE: "Célibataire",
  MARRIED: "Marié(e)",
  DIVORCED: "Divorcé(e)",
  WIDOWED: "Veuf/Veuve",
  PACSED: "Pacsé(e)",
  OTHER: "Autre",
};

const SKILL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  TECHNICAL: { label: "Technique", color: "bg-blue-100 text-blue-700" },
  SOFT: { label: "Soft skill", color: "bg-green-100 text-green-700" },
  BEHAVIORAL: { label: "Comportemental", color: "bg-purple-100 text-purple-700" },
  OTHER: { label: "Autre", color: "bg-gray-100 text-gray-600" },
};

const SKILL_LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
  EXPERT: "Expert",
};

const SKILL_LEVEL_OPTIONS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI: "CDI", CDD: "CDD", SIVP: "SIVP", STAGE: "Stage",
  ALTERNANCE: "Alternance", FREELANCE: "Freelance", AUTRE: "Autre",
};

const CONTRACT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIF: { label: "Actif", color: "bg-green-100 text-green-700" },
  TERMINE: { label: "Terminé", color: "bg-gray-100 text-gray-600" },
  SUSPENDU: { label: "Suspendu", color: "bg-amber-100 text-amber-700" },
  EN_PROLONGATION: { label: "En prolongation", color: "bg-blue-100 text-blue-700" },
  EN_ATTENTE_SIGNATURE: { label: "En attente de signature", color: "bg-purple-100 text-purple-700" },
};

// ─── Helpers ───

function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*+-=?";
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const all = upper + lower + digits + special;
  const extra = Array.from({ length: 12 }, () => pick(all));
  const password = [...required, ...extra];
  for (let i = password.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [password[i], password[j]] = [password[j], password[i]];
  }
  return password.join("");
}

function toDateInput(d: string | null): string {
  if (!d) return "";
  try { return new Date(d).toISOString().split("T")[0]; } catch { return ""; }
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]";
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

// ─── Component ───

export default function AdminUserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { addToast } = useToast();

  const [userId, setUserId] = useState<string>("");
  const [user, setUser] = useState<UserDetail | null>(null);
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("identite");
  const [saving, setSaving] = useState(false);

  // Password
  const [generatedPwd, setGeneratedPwd] = useState("");
  const [copiedPwd, setCopiedPwd] = useState(false);

  // Emergency contacts
  const [ecDialogOpen, setEcDialogOpen] = useState(false);
  const [editingEc, setEditingEc] = useState<EmergencyContact | null>(null);
  const [deleteEcOpen, setDeleteEcOpen] = useState(false);
  const [selectedEcId, setSelectedEcId] = useState<string | null>(null);

  // Skills
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [assessingSkill, setAssessingSkill] = useState<SkillData | null>(null);

  // Risk score
  const [riskScore, setRiskScore] = useState<{
    overall: number;
    label: string;
    seniority: number;
    mood: number;
    objectives: number;
    leaveUsage: number;
    recognition: number;
    contractRisk: number;
  } | null>(null);

  // Resolve params
  useEffect(() => { params.then((p) => setUserId(p.id)); }, [params]);

  // ─── Forms ───
  const identityForm = useForm<IdentityForm>({
    resolver: zodResolver(identitySchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", password: "", roles: ["EMPLOYEE"],
      officeId: "", teamId: "", hireDate: "", cin: "", cnss: "",
      isActive: true, forcePasswordChange: false, sendNotification: false,
    },
  });

  const personalForm = useForm<UserPersonalInput>({
    resolver: zodResolver(userPersonalSchema),
  });

  const professionalForm = useForm<UserProfessionalInput>({
    resolver: zodResolver(userProfessionalSchema),
  });

  const ecForm = useForm<EmergencyContactInput>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: { priority: 1, firstName: "", lastName: "", relation: "", phone: "", mobile: "", email: "", address: "" },
  });

  // ─── Fetch data ───
  const fetchUser = useCallback(async () => {
    if (!userId) return;
    try {
      const [userRes, officesRes, teamsRes] = await Promise.all([
        fetch(`/api/admin/users/${userId}`),
        fetch("/api/admin/offices"),
        fetch("/api/admin/teams"),
      ]);
      if (!userRes.ok) throw new Error("Utilisateur introuvable");
      const userData: UserDetail = await userRes.json();
      setUser(userData);

      // Populate identity form
      identityForm.reset({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: "",
        roles: userData.roles as ("EMPLOYEE" | "MANAGER" | "HR" | "ADMIN")[],
        officeId: userData.officeId || "",
        teamId: userData.teamId || "",
        hireDate: toDateInput(userData.hireDate),
        cin: userData.cin || "",
        cnss: userData.cnss || "",
        isActive: userData.isActive,
        forcePasswordChange: userData.forcePasswordChange,
        sendNotification: false,
      });

      // Populate personal form
      personalForm.reset({
        personalEmail: userData.personalEmail || "",
        personalPhone: userData.personalPhone || "",
        personalMobile: userData.personalMobile || "",
        personalAddressStreet: userData.personalAddressStreet || "",
        personalAddressZip: userData.personalAddressZip || "",
        personalAddressCity: userData.personalAddressCity || "",
        personalAddressCountry: userData.personalAddressCountry || "",
        birthDate: toDateInput(userData.birthDate),
        birthCity: userData.birthCity || "",
        birthCountry: userData.birthCountry || "",
        nationality: userData.nationality || "",
        gender: (userData.gender as UserPersonalInput["gender"]) || null,
        maritalStatus: (userData.maritalStatus as UserPersonalInput["maritalStatus"]) || null,
        dependentsCount: userData.dependentsCount ?? 0,
      });

      // Populate professional form
      professionalForm.reset({
        professionalPhone: userData.professionalPhone || "",
        internalNumber: userData.internalNumber || "",
        service: userData.service || "",
        jobFunction: userData.jobFunction || "",
        arrivalDate: toDateInput(userData.arrivalDate),
        departureDate: toDateInput(userData.departureDate),
        accountingCode: userData.accountingCode || "",
      });

      if (officesRes.ok) {
        const data = await officesRes.json();
        setOffices(data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
      }
      if (teamsRes.ok) {
        const data = await teamsRes.json();
        setTeams(data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      }
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur inconnue" });
    } finally {
      setLoading(false);
    }
  }, [userId, addToast, identityForm, personalForm, professionalForm]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  // Fetch risk score when user loads
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users/${userId}/risk-score`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setRiskScore(data); })
      .catch(() => {});
  }, [userId]);

  // ─── Save identity ───
  const saveIdentity = async (data: IdentityForm) => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        id: user.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        roles: data.roles,
        officeId: data.officeId,
        teamId: data.teamId || null,
        hireDate: data.hireDate,
        cin: data.cin || "",
        cnss: data.cnss || "",
        isActive: data.isActive,
        forcePasswordChange: data.forcePasswordChange,
        sendNotification: data.sendNotification,
      };
      if (data.password && data.password.trim().length > 0) payload.password = data.password;

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({ type: "success", title: "Identité mise à jour" });
      setGeneratedPwd("");
      await fetchUser();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally { setSaving(false); }
  };

  // ─── Save personal ───
  const savePersonal = async (data: UserPersonalInput) => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}/personal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({ type: "success", title: "Informations personnelles mises à jour" });
      await fetchUser();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally { setSaving(false); }
  };

  // ─── Save professional ───
  const saveProfessional = async (data: UserProfessionalInput) => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}/professional`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({ type: "success", title: "Informations professionnelles mises à jour" });
      await fetchUser();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally { setSaving(false); }
  };

  // ─── Emergency contacts ───
  const openAddEc = () => {
    setEditingEc(null);
    ecForm.reset({ priority: (user?.emergencyContacts.length ?? 0) + 1, firstName: "", lastName: "", relation: "", phone: "", mobile: "", email: "", address: "" });
    setEcDialogOpen(true);
  };

  const openEditEc = (ec: EmergencyContact) => {
    setEditingEc(ec);
    ecForm.reset({
      priority: ec.priority,
      firstName: ec.firstName,
      lastName: ec.lastName,
      relation: ec.relation,
      phone: ec.phone,
      mobile: ec.mobile || "",
      email: ec.email || "",
      address: ec.address || "",
    });
    setEcDialogOpen(true);
  };

  const saveEc = async (data: EmergencyContactInput) => {
    if (!user) return;
    setSaving(true);
    try {
      const url = editingEc
        ? `/api/profile/emergency-contacts/${editingEc.id}`
        : "/api/profile/emergency-contacts";
      // For admin, we call a user-specific endpoint
      const adminUrl = editingEc
        ? `/api/admin/users/${user.id}/emergency-contacts/${editingEc.id}`
        : `/api/admin/users/${user.id}/emergency-contacts`;
      // Try admin endpoint first, fallback to profile endpoint
      let res = await fetch(adminUrl, {
        method: editingEc ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 404) {
        // Admin endpoint doesn't exist, use profile endpoint with userId context
        res = await fetch(url, {
          method: editingEc ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, userId: user.id }),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({ type: "success", title: editingEc ? "Contact modifié" : "Contact ajouté" });
      setEcDialogOpen(false);
      await fetchUser();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally { setSaving(false); }
  };

  const deleteEc = async () => {
    if (!selectedEcId) return;
    setSaving(true);
    try {
      let res = await fetch(`/api/admin/users/${userId}/emergency-contacts/${selectedEcId}`, { method: "DELETE" });
      if (res.status === 404) {
        res = await fetch(`/api/profile/emergency-contacts/${selectedEcId}`, { method: "DELETE" });
      }
      if (res.ok) {
        addToast({ type: "success", title: "Contact supprimé" });
        setDeleteEcOpen(false);
        setSelectedEcId(null);
        await fetchUser();
      }
    } catch {
      addToast({ type: "error", title: "Erreur" });
    } finally { setSaving(false); }
  };

  // ─── Skills - Manager assessment ───
  const openSkillAssess = (skill: SkillData) => {
    setAssessingSkill(skill);
    setSkillDialogOpen(true);
  };

  const saveSkillAssessment = async (managerLevel: string) => {
    if (!assessingSkill || !user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}/skills/${assessingSkill.id}`, {
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
      setAssessingSkill(null);
      await fetchUser();
    } catch (err) {
      addToast({ type: "error", title: "Erreur", message: err instanceof Error ? err.message : "Erreur" });
    } finally { setSaving(false); }
  };

  // ─── Password helpers ───
  const handleGenPwd = () => {
    const pwd = generateStrongPassword();
    setGeneratedPwd(pwd);
    setCopiedPwd(false);
    identityForm.setValue("password", pwd);
  };

  const handleCopyPwd = async () => {
    try {
      await navigator.clipboard.writeText(generatedPwd);
      setCopiedPwd(true);
      addToast({ type: "success", title: "Copié" });
      setTimeout(() => setCopiedPwd(false), 2000);
    } catch {
      addToast({ type: "error", title: "Erreur" });
    }
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-12 text-center text-gray-500">
        Utilisateur introuvable.
        <button onClick={() => router.back()} className="ml-2 text-[#1B3A5C] underline">Retour</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.roles.map((role) => (
            <span key={role} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
              {role}
            </span>
          ))}
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {user.isActive ? "Actif" : "Inactif"}
          </span>
        </div>
      </div>

      {/* Risk Score Widget */}
      {riskScore && user?.isActive && (
        <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
          riskScore.overall >= 70
            ? "border-red-200 bg-red-50"
            : riskScore.overall >= 50
              ? "border-orange-200 bg-orange-50"
              : riskScore.overall >= 30
                ? "border-amber-200 bg-amber-50"
                : "border-green-200 bg-green-50"
        }`}>
          <div className="flex items-center gap-3 shrink-0">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${
              riskScore.overall >= 70 ? "bg-red-100 text-red-700"
              : riskScore.overall >= 50 ? "bg-orange-100 text-orange-700"
              : riskScore.overall >= 30 ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
            }`}>
              {riskScore.overall}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Risque de départ</p>
              <p className={`text-xs font-medium ${
                riskScore.label === "critical" ? "text-red-600"
                : riskScore.label === "high" ? "text-orange-600"
                : riskScore.label === "moderate" ? "text-amber-600"
                : "text-green-600"
              }`}>
                {riskScore.label === "critical" ? "Critique"
                 : riskScore.label === "high" ? "Élevé"
                 : riskScore.label === "moderate" ? "Modéré"
                 : "Faible"}
              </p>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
            {[
              { label: "Ancienneté", value: riskScore.seniority },
              { label: "Humeur", value: riskScore.mood },
              { label: "Objectifs", value: riskScore.objectives },
              { label: "Congés", value: riskScore.leaveUsage },
              { label: "Reconnaissance", value: riskScore.recognition },
              { label: "Contrat", value: riskScore.contractRisk },
            ].map((item) => (
              <div key={item.label}>
                <div className="h-1.5 w-full rounded-full bg-gray-200 mb-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      item.value >= 70 ? "bg-red-500" : item.value >= 50 ? "bg-orange-500" : item.value >= 30 ? "bg-amber-400" : "bg-green-500"
                    }`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
                <span className="text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto border-b border-gray-200">
        <nav className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 ${
                  active
                    ? "border-[#1B3A5C] text-[#1B3A5C]"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        {activeTab === "identite" && (
          <form onSubmit={identityForm.handleSubmit(saveIdentity)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Prénom</label>
                <input {...identityForm.register("firstName")} className={inputClass} />
                {identityForm.formState.errors.firstName && <p className="mt-1 text-xs text-red-600">{identityForm.formState.errors.firstName.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Nom</label>
                <input {...identityForm.register("lastName")} className={inputClass} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input type="email" {...identityForm.register("email")} className={inputClass} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>CIN</label>
                <input {...identityForm.register("cin")} placeholder="09815606 ou TN09815606" className={`${inputClass} font-mono`} />
              </div>
              <div>
                <label className={labelClass}>CNSS</label>
                <input {...identityForm.register("cnss")} placeholder="1753436706" className={`${inputClass} font-mono`} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={labelClass}>Mot de passe (laisser vide pour ne pas changer)</label>
              <div className="flex gap-2">
                <input type="text" {...identityForm.register("password")} className={`flex-1 ${inputClass} font-mono`} placeholder="Laisser vide pour ne pas changer" />
                <button type="button" onClick={handleGenPwd} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                  <KeyRound className="h-3.5 w-3.5" /> Générer
                </button>
              </div>
              {generatedPwd && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                  <code className="flex-1 text-sm font-mono text-green-800">{generatedPwd}</code>
                  <button type="button" onClick={handleCopyPwd} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
                    {copiedPwd ? <><Check className="h-3.5 w-3.5" /> Copié</> : <><Copy className="h-3.5 w-3.5" /> Copier</>}
                  </button>
                </div>
              )}
            </div>

            {/* Roles */}
            <div>
              <label className={`${labelClass} mb-2`}>Rôles</label>
              <Controller
                control={identityForm.control}
                name="roles"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-3">
                    {ALL_ROLES.map((role) => {
                      const checked = (field.value as string[]).includes(role);
                      return (
                        <label key={role} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox" checked={checked}
                            onChange={() => {
                              const cur = field.value as string[];
                              field.onChange(checked ? cur.filter((r) => r !== role) : [...cur, role]);
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
                          />
                          {role}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            {/* Office & Team */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Bureau</label>
                <select {...identityForm.register("officeId")} className={inputClass}>
                  <option value="">-- Sélectionner --</option>
                  {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Équipe</label>
                <select {...identityForm.register("teamId")} className={inputClass}>
                  <option value="">-- Aucune --</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {/* Hire date */}
            <div>
              <label className={labelClass}>Date d&apos;embauche</label>
              <input type="date" {...identityForm.register("hireDate")} className={inputClass} />
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap items-center gap-6">
              <Controller
                control={identityForm.control}
                name="isActive"
                render={({ field }) => (
                  <label className="flex items-center gap-3">
                    <button type="button" role="switch" aria-checked={field.value ?? true} onClick={() => field.onChange(!field.value)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${field.value ? "bg-[#1B3A5C]" : "bg-gray-200"}`}>
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${field.value ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                    <span className="text-sm font-medium text-gray-700">{field.value ? "Actif" : "Inactif"}</span>
                  </label>
                )}
              />
              <Controller
                control={identityForm.control}
                name="forcePasswordChange"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={field.value ?? false} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C]" />
                    <span className="font-medium text-gray-700">Forcer changement mot de passe</span>
                  </label>
                )}
              />
              <Controller
                control={identityForm.control}
                name="sendNotification"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={field.value ?? false} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C]" />
                    <Mail className="h-3.5 w-3.5 text-gray-500" />
                    <span className="font-medium text-gray-700">Notifier par email</span>
                  </label>
                )}
              />
            </div>

            <div className="flex justify-end border-t border-gray-100 pt-4">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          </form>
        )}

        {activeTab === "personnel" && (
          <div className="space-y-8">
            <form onSubmit={personalForm.handleSubmit(savePersonal)} className="space-y-6">
              <h3 className="text-base font-semibold text-gray-900">Informations personnelles</h3>

              {/* Birth info */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelClass}>Date de naissance</label>
                  <input type="date" {...personalForm.register("birthDate")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Ville de naissance</label>
                  <input {...personalForm.register("birthCity")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Pays de naissance</label>
                  <input {...personalForm.register("birthCountry")} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelClass}>Nationalité</label>
                  <input {...personalForm.register("nationality")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Genre</label>
                  <select {...personalForm.register("gender")} className={inputClass}>
                    <option value="">—</option>
                    {Object.entries(GENDER_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Situation matrimoniale</label>
                  <select {...personalForm.register("maritalStatus")} className={inputClass}>
                    <option value="">—</option>
                    {Object.entries(MARITAL_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="w-32">
                <label className={labelClass}>Personnes à charge</label>
                <input type="number" min={0} max={50} {...personalForm.register("dependentsCount", { valueAsNumber: true })} className={inputClass} />
              </div>

              {/* Contact */}
              <h4 className="text-sm font-semibold text-gray-700">Contact personnel</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={labelClass}>Email personnel</label>
                  <input type="email" {...personalForm.register("personalEmail")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input {...personalForm.register("personalPhone")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Mobile</label>
                  <input {...personalForm.register("personalMobile")} className={inputClass} />
                </div>
              </div>

              {/* Address */}
              <h4 className="text-sm font-semibold text-gray-700">Adresse</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="col-span-2">
                  <label className={labelClass}>Rue</label>
                  <input {...personalForm.register("personalAddressStreet")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Code postal</label>
                  <input {...personalForm.register("personalAddressZip")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Ville</label>
                  <input {...personalForm.register("personalAddressCity")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Pays</label>
                  <input {...personalForm.register("personalAddressCountry")} className={inputClass} />
                </div>
              </div>

              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </button>
              </div>
            </form>

            {/* Emergency Contacts */}
            <div className="space-y-4 border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Contacts d&apos;urgence</h3>
                <button onClick={openAddEc} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <Plus className="h-3.5 w-3.5" /> Ajouter
                </button>
              </div>

              {user.emergencyContacts.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun contact d&apos;urgence.</p>
              ) : (
                <div className="space-y-2">
                  {user.emergencyContacts.map((ec) => (
                    <div key={ec.id} className="group flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-500">#{ec.priority}</span>
                          <span className="text-sm font-medium text-gray-900">{ec.firstName} {ec.lastName}</span>
                          <span className="text-xs text-gray-500">({ec.relation})</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                          <span>{ec.phone}</span>
                          {ec.mobile && <span>Mob: {ec.mobile}</span>}
                          {ec.email && <span>{ec.email}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100">
                        <button onClick={() => openEditEc(ec)} className="rounded p-1.5 text-gray-400 hover:bg-white hover:text-[#1B3A5C]">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => { setSelectedEcId(ec.id); setDeleteEcOpen(true); }} className="rounded p-1.5 text-gray-400 hover:bg-white hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "professionnel" && (
          <form onSubmit={professionalForm.handleSubmit(saveProfessional)} className="space-y-6">
            <h3 className="text-base font-semibold text-gray-900">Informations professionnelles</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Poste / Fonction</label>
                <input {...professionalForm.register("jobFunction")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Service / Département</label>
                <input {...professionalForm.register("service")} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Téléphone professionnel</label>
                <input {...professionalForm.register("professionalPhone")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Numéro interne</label>
                <input {...professionalForm.register("internalNumber")} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Date d&apos;arrivée effective</label>
                <input type="date" {...professionalForm.register("arrivalDate")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Date de départ</label>
                <input type="date" {...professionalForm.register("departureDate")} className={inputClass} />
              </div>
            </div>

            <div className="w-64">
              <label className={labelClass}>Code comptable</label>
              <input {...professionalForm.register("accountingCode")} className={inputClass} />
            </div>

            <div className="flex justify-end border-t border-gray-100 pt-4">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          </form>
        )}

        {activeTab === "contrat" && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Contrats</h3>
            {user.contracts.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun contrat enregistré.</p>
            ) : (
              <div className="space-y-3">
                {user.contracts.map((c) => {
                  const statusCfg = CONTRACT_STATUS_LABELS[c.status] ?? { label: c.status, color: "bg-gray-100 text-gray-600" };
                  return (
                    <div key={c.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{c.jobTitle}</span>
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            {CONTRACT_TYPE_LABELS[c.type] ?? c.type}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                        {c.contractNumber && <span className="text-xs font-mono text-gray-400">#{c.contractNumber}</span>}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-gray-500 sm:grid-cols-2 lg:grid-cols-4">
                        <div>Début: {formatDate(c.startDate)}</div>
                        <div>Fin: {c.endDate ? formatDate(c.endDate) : "—"}</div>
                        {c.weeklyHours && <div>{c.weeklyHours}h/sem</div>}
                        {c.department && <div>Dép.: {c.department}</div>}
                        {c.location && <div>Lieu: {c.location}</div>}
                        {c.remoteAllowed && <div>Télétravail: {c.remotePercentage ?? 0}%</div>}
                        {c.salaryGrossMonthly && <div>Salaire: {c.salaryGrossMonthly} {c.currency}/mois</div>}
                      </div>
                      {c.notes && <p className="mt-2 text-xs text-gray-400">{c.notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "competences" && (
          <div className="space-y-8">
            {/* Skills */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-gray-500" />
                <h3 className="text-base font-semibold text-gray-900">Compétences</h3>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{user.skills.length}</span>
              </div>

              <p className="text-xs text-gray-400">
                En tant qu&apos;admin/HR, vous pouvez évaluer le niveau manager pour chaque compétence.
              </p>

              {user.skills.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune compétence déclarée par l&apos;employé.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {user.skills.map((skill) => (
                    <div key={skill.id} className="group relative rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{skill.name}</p>
                          <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${SKILL_TYPE_LABELS[skill.type]?.color ?? "bg-gray-100"}`}>
                            {SKILL_TYPE_LABELS[skill.type]?.label ?? skill.type}
                          </span>
                        </div>
                        <button
                          onClick={() => openSkillAssess(skill)}
                          className="rounded p-1 text-gray-400 transition-opacity hover:bg-white hover:text-[#1B3A5C] sm:opacity-0 sm:group-hover:opacity-100"
                          title="Évaluer (manager)"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        {skill.selfLevel && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
                            Auto: {SKILL_LEVEL_LABELS[skill.selfLevel] ?? skill.selfLevel}
                          </span>
                        )}
                        {skill.managerLevel && (
                          <span className={`rounded px-1.5 py-0.5 ${skill.selfLevel && skill.managerLevel !== skill.selfLevel ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                            Mgr: {SKILL_LEVEL_LABELS[skill.managerLevel] ?? skill.managerLevel}
                          </span>
                        )}
                        {!skill.selfLevel && !skill.managerLevel && (
                          <span className="text-gray-400">Non évalué</span>
                        )}
                      </div>
                      {skill.description && <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{skill.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Emergency Contact Dialog ─── */}
      <Dialog
        open={ecDialogOpen}
        onClose={() => setEcDialogOpen(false)}
        title={editingEc ? "Modifier le contact" : "Ajouter un contact d'urgence"}
        maxWidth="md"
      >
        <form onSubmit={ecForm.handleSubmit(saveEc)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Prénom *</label>
              <input {...ecForm.register("firstName")} className={inputClass} />
              {ecForm.formState.errors.firstName && <p className="mt-1 text-xs text-red-600">{ecForm.formState.errors.firstName.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Nom *</label>
              <input {...ecForm.register("lastName")} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Relation *</label>
              <input {...ecForm.register("relation")} placeholder="Ex: Conjoint, Parent" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Priorité *</label>
              <input type="number" min={1} max={5} {...ecForm.register("priority", { valueAsNumber: true })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Téléphone *</label>
              <input {...ecForm.register("phone")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Mobile</label>
              <input {...ecForm.register("mobile")} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" {...ecForm.register("email")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Adresse</label>
            <input {...ecForm.register("address")} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={() => setEcDialogOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm text-white hover:bg-[#15304d] disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingEc ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteEcOpen}
        onClose={() => { setDeleteEcOpen(false); setSelectedEcId(null); }}
        onConfirm={deleteEc}
        title="Supprimer le contact"
        message="Êtes-vous sûr de vouloir supprimer ce contact d'urgence ?"
        confirmLabel="Supprimer"
        loading={saving}
      />

      {/* ─── Skill Assessment Dialog ─── */}
      <Dialog
        open={skillDialogOpen}
        onClose={() => { setSkillDialogOpen(false); setAssessingSkill(null); }}
        title={assessingSkill ? `Évaluer : ${assessingSkill.name}` : "Évaluer"}
        maxWidth="sm"
      >
        {assessingSkill && (
          <SkillAssessForm
            skill={assessingSkill}
            onSave={saveSkillAssessment}
            onCancel={() => { setSkillDialogOpen(false); setAssessingSkill(null); }}
            saving={saving}
          />
        )}
      </Dialog>
    </div>
  );
}

// ─── Skill Assess Sub-component ───

function SkillAssessForm({
  skill, onSave, onCancel, saving,
}: {
  skill: SkillData;
  onSave: (level: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [level, setLevel] = useState(skill.managerLevel || "");

  return (
    <div className="space-y-4">
      {skill.selfLevel && (
        <div className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Auto-évaluation de l&apos;employé : <strong>{SKILL_LEVEL_LABELS[skill.selfLevel] ?? skill.selfLevel}</strong>
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Niveau manager</label>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
        >
          <option value="">— Sélectionner —</option>
          {SKILL_LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>{SKILL_LEVEL_LABELS[l]}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
        <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
        <button
          type="button"
          disabled={!level || saving}
          onClick={() => onSave(level)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm text-white hover:bg-[#15304d] disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Enregistrer
        </button>
      </div>
    </div>
  );
}
