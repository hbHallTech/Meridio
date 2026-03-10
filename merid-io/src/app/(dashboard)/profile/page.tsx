"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  changePasswordSchema,
  userPersonalSchema,
  emergencyContactSchema,
  skillCreateSchema,
  skillSelfUpdateSchema,
  type ChangePasswordInput,
  type UserPersonalInput,
  type EmergencyContactInput,
  type SkillCreateInput,
  type SkillSelfUpdateInput,
} from "@/lib/validators";
import { useToast } from "@/components/ui/toast";
import { useTheme } from "next-themes";
import {
  Loader2,
  Camera,
  User,
  Mail,
  Building2,
  Users,
  CalendarDays,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  Shield,
  Sun,
  Moon,
  Monitor,
  Bell,
  Briefcase,
  FileText,
  Phone,
  MapPin,
  Heart,
  Save,
  Baby,
  Flag,
  Hash,
  Clock,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Target,
  Star,
} from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";

// ─── Types ───

interface OfficeInfo {
  id: string;
  name: string;
  city: string;
  country: string;
}

interface TeamInfo {
  id: string;
  name: string;
}

interface EmergencyContact {
  id: string;
  priority: number;
  firstName: string;
  lastName: string;
  relation: string;
  mobile: string | null;
  address: string | null;
  phone: string;
  email: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  language: string;
  hireDate: string;
  roles: string[];
  office: OfficeInfo;
  team: TeamInfo | null;
  // Personal
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
  // Professional
  professionalPhone: string | null;
  internalNumber: string | null;
  service: string | null;
  jobFunction: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  accountingCode: string | null;
  // Emergency contacts
  emergencyContacts: EmergencyContact[];
}

interface BalanceEntry {
  balanceType: string;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  carriedOverDays: number;
  remaining: number;
}

// ─── Constants ───

const BALANCE_LABELS: Record<string, { fr: string; en: string; color: string }> = {
  ANNUAL: { fr: "Congé annuel", en: "Annual Leave", color: "#1B3A5C" },
  OFFERED: { fr: "Congés offerts", en: "Offered Days", color: "#00BCD4" },
};

const NOTIF_TYPES = [
  { type: "NEW_REQUEST", fr: "Nouvelle demande de congé", en: "New leave request" },
  { type: "APPROVED", fr: "Demande approuvée", en: "Request approved" },
  { type: "REFUSED", fr: "Demande refusée", en: "Request refused" },
  { type: "RETURNED", fr: "Demande renvoyée", en: "Request returned" },
  { type: "REMINDER", fr: "Rappel de traitement", en: "Processing reminder" },
  { type: "PASSWORD_EXPIRING", fr: "Expiration mot de passe", en: "Password expiring" },
  { type: "PASSWORD_CHANGED", fr: "Mot de passe modifié", en: "Password changed" },
  { type: "NEW_LOGIN", fr: "Nouvelle connexion", en: "New login detected" },
  { type: "ACCOUNT_LOCKED", fr: "Compte verrouillé", en: "Account locked" },
  { type: "CLOSURE", fr: "Fermeture entreprise", en: "Company closure" },
];

const ROLE_LABELS: Record<string, { fr: string; en: string }> = {
  EMPLOYEE: { fr: "Employé", en: "Employee" },
  MANAGER: { fr: "Manager", en: "Manager" },
  HR: { fr: "Ressources Humaines", en: "Human Resources" },
  ADMIN: { fr: "Administrateur", en: "Administrator" },
};

const GENDER_LABELS: Record<string, { fr: string; en: string }> = {
  MALE: { fr: "Homme", en: "Male" },
  FEMALE: { fr: "Femme", en: "Female" },
  OTHER: { fr: "Autre", en: "Other" },
  PREFER_NOT_TO_SAY: { fr: "Ne souhaite pas préciser", en: "Prefer not to say" },
};

const MARITAL_LABELS: Record<string, { fr: string; en: string }> = {
  SINGLE: { fr: "Célibataire", en: "Single" },
  MARRIED: { fr: "Marié(e)", en: "Married" },
  DIVORCED: { fr: "Divorcé(e)", en: "Divorced" },
  WIDOWED: { fr: "Veuf/Veuve", en: "Widowed" },
  PACSED: { fr: "Pacsé(e)", en: "Civil union" },
  OTHER: { fr: "Autre", en: "Other" },
};

type TabId = "personnel" | "professionnel" | "contrat" | "competences";

const TABS: { id: TabId; fr: string; en: string; icon: typeof User }[] = [
  { id: "personnel", fr: "Personnel", en: "Personal", icon: User },
  { id: "professionnel", fr: "Professionnel", en: "Professional", icon: Briefcase },
  { id: "contrat", fr: "Contrat", en: "Contract", icon: FileText },
  { id: "competences", fr: "Compétences", en: "Skills & Goals", icon: Target },
];

// ─── Password strength checker ───

function getPasswordChecks(password: string) {
  return [
    { key: "length", label_fr: "8 caractères minimum", label_en: "8 characters minimum", ok: password.length >= 8 },
    { key: "upper", label_fr: "1 majuscule", label_en: "1 uppercase letter", ok: /[A-Z]/.test(password) },
    { key: "lower", label_fr: "1 minuscule", label_en: "1 lowercase letter", ok: /[a-z]/.test(password) },
    { key: "digit", label_fr: "1 chiffre", label_en: "1 digit", ok: /\d/.test(password) },
    { key: "special", label_fr: "1 caractère spécial", label_en: "1 special character", ok: /[^A-Za-z\d\s]/.test(password) },
  ];
}

function formatDate(dateStr: string | null, lang: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function toDateInputValue(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

// ─── Component ───

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const { addToast } = useToast();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const lang = session?.user?.language ?? "fr";

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [balances, setBalances] = useState<BalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [langSaving, setLangSaving] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  const [notifSaving, setNotifSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("personnel");
  const [personalEditing, setPersonalEditing] = useState(false);
  const [personalSaving, setPersonalSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pwdForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const personalForm = useForm<UserPersonalInput>({
    resolver: zodResolver(userPersonalSchema),
  });

  const watchNewPwd = pwdForm.watch("newPassword");
  const pwdChecks = getPasswordChecks(watchNewPwd || "");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch profile
  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setProfile(d.user);
          setBalances(d.balances);
          resetPersonalForm(d.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/profile/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((prefs: { type: string; enabled: boolean }[]) => {
        const map: Record<string, boolean> = {};
        for (const nt of NOTIF_TYPES) {
          const found = prefs.find((p) => p.type === nt.type);
          map[nt.type] = found ? found.enabled : true;
        }
        setNotifPrefs(map);
      })
      .catch(() => {});
  }, [pathname]);

  function resetPersonalForm(user: UserProfile) {
    personalForm.reset({
      personalEmail: user.personalEmail || "",
      personalPhone: user.personalPhone || "",
      personalMobile: user.personalMobile || "",
      personalAddressStreet: user.personalAddressStreet || "",
      personalAddressZip: user.personalAddressZip || "",
      personalAddressCity: user.personalAddressCity || "",
      personalAddressCountry: user.personalAddressCountry || "",
      birthDate: toDateInputValue(user.birthDate),
      birthCity: user.birthCity || "",
      birthCountry: user.birthCountry || "",
      nationality: user.nationality || "",
      gender: (user.gender as UserPersonalInput["gender"]) || null,
      maritalStatus: (user.maritalStatus as UserPersonalInput["maritalStatus"]) || null,
      dependentsCount: user.dependentsCount ?? 0,
    });
  }

  // Avatar upload
  const handleAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      setProfile((prev) => (prev ? { ...prev, profilePictureUrl: data.profilePictureUrl } : prev));
      addToast({ type: "success", title: lang === "en" ? "Photo updated" : "Photo mise à jour" });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Upload failed" : "Échec de l'envoi" });
    } finally {
      setAvatarUploading(false);
    }
  };

  // Language change
  const handleLanguageChange = async (newLang: string) => {
    setLangSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      });
      if (res.ok) {
        setProfile((prev) => (prev ? { ...prev, language: newLang } : prev));
        await updateSession({ language: newLang });
        addToast({ type: "success", title: newLang === "en" ? "Language updated" : "Langue mise à jour" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setLangSaving(false);
    }
  };

  // Theme change
  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch {
      // Theme still applied locally via next-themes
    }
  };

  // Password change
  const onPasswordSubmit = async (values: ChangePasswordInput) => {
    setPwdSubmitting(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      pwdForm.reset();
      addToast({
        type: "success",
        title: lang === "en" ? "Password changed" : "Mot de passe modifié",
        message: lang === "en"
          ? "A confirmation email has been sent."
          : "Un email de confirmation a été envoyé.",
      });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setPwdSubmitting(false);
    }
  };

  // Save personal info
  const onPersonalSubmit = async (values: UserPersonalInput) => {
    setPersonalSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personal: values }),
      });
      if (!res.ok) {
        const data = await res.json();
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      // Update local state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              personalEmail: values.personalEmail || null,
              personalPhone: values.personalPhone || null,
              personalMobile: values.personalMobile || null,
              personalAddressStreet: values.personalAddressStreet || null,
              personalAddressZip: values.personalAddressZip || null,
              personalAddressCity: values.personalAddressCity || null,
              personalAddressCountry: values.personalAddressCountry || null,
              birthDate: values.birthDate || null,
              birthCity: values.birthCity || null,
              birthCountry: values.birthCountry || null,
              nationality: values.nationality || null,
              gender: values.gender || null,
              maritalStatus: values.maritalStatus || null,
              dependentsCount: values.dependentsCount ?? 0,
            }
          : prev
      );
      setPersonalEditing(false);
      addToast({
        type: "success",
        title: lang === "en" ? "Personal info updated" : "Informations personnelles mises à jour",
      });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setPersonalSaving(false);
    }
  };

  // Notification preferences
  const handleNotifToggle = async (type: string, enabled: boolean) => {
    const prev = { ...notifPrefs };
    setNotifPrefs({ ...notifPrefs, [type]: enabled });
    setNotifSaving(true);
    try {
      const res = await fetch("/api/profile/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: [{ type, enabled }] }),
      });
      if (!res.ok) {
        setNotifPrefs(prev);
        addToast({ type: "error", title: lang === "en" ? "Save error" : "Erreur de sauvegarde" });
      }
    } catch {
      setNotifPrefs(prev);
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setNotifSaving(false);
    }
  };

  // ─── Render ───

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        {lang === "en" ? "Unable to load profile." : "Impossible de charger le profil."}
      </div>
    );
  }

  const themeOptions = [
    { value: "light", label_fr: "Clair", label_en: "Light", icon: Sun },
    { value: "dark", label_fr: "Sombre", label_en: "Dark", icon: Moon },
    { value: "system", label_fr: "Système", label_en: "System", icon: Monitor },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {lang === "en" ? "My Profile" : "Mon profil"}
      </h1>

      {/* ─── Profile header card ─── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-5 border-b border-gray-100 p-6">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gray-100">
              {profile.profilePictureUrl ? (
                <img
                  src={profile.profilePictureUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: "#1B3A5C" }}
                >
                  {profile.firstName[0]}
                  {profile.lastName[0]}
                </span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#1B3A5C] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {avatarUploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">
              {profile.firstName} {profile.lastName}
            </h2>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.roles.map((role) => {
                const label = ROLE_LABELS[role];
                return (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    <Shield className="h-3 w-3" />
                    {label ? (lang === "en" ? label.en : label.fr) : role}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Language + theme controls */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleLanguageChange("fr")}
                disabled={langSaving}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  profile.language === "fr"
                    ? "bg-[#1B3A5C] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                FR
              </button>
              <button
                onClick={() => handleLanguageChange("en")}
                disabled={langSaving}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                  profile.language === "en"
                    ? "bg-[#1B3A5C] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                EN
              </button>
              {langSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
            </div>
            {mounted && (
              <div className="flex items-center gap-1">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleThemeChange(opt.value)}
                      className={`rounded-lg p-1.5 transition-all ${
                        active
                          ? "bg-[#1B3A5C] text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                      title={lang === "en" ? opt.label_en : opt.label_fr}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto border-b border-gray-200">
          <div className="flex min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-all border-b-2 sm:px-6 ${
                    active
                      ? "border-[#1B3A5C] text-[#1B3A5C]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {lang === "en" ? tab.en : tab.fr}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "personnel" && (
            <PersonnelTab
              profile={profile}
              lang={lang}
              personalForm={personalForm}
              personalEditing={personalEditing}
              personalSaving={personalSaving}
              onEdit={() => {
                resetPersonalForm(profile);
                setPersonalEditing(true);
              }}
              onCancel={() => {
                resetPersonalForm(profile);
                setPersonalEditing(false);
              }}
              onSubmit={onPersonalSubmit}
            />
          )}

          {activeTab === "professionnel" && (
            <ProfessionnelTab profile={profile} lang={lang} />
          )}

          {activeTab === "contrat" && (
            <ContratTab profile={profile} lang={lang} />
          )}

          {activeTab === "competences" && (
            <CompetencesTab lang={lang} />
          )}
        </div>
      </div>

      {/* ─── Password change section ─── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Change Password" : "Changer mon mot de passe"}
          </h2>
        </div>

        <form onSubmit={pwdForm.handleSubmit(onPasswordSubmit)} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Current password" : "Mot de passe actuel"}
            </label>
            <div className="relative">
              <input
                type={showCurrentPwd ? "text" : "password"}
                {...pwdForm.register("currentPassword")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwdForm.formState.errors.currentPassword && (
              <p className="mt-1 text-xs text-red-600">{pwdForm.formState.errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "New password" : "Nouveau mot de passe"}
            </label>
            <div className="relative">
              <input
                type={showNewPwd ? "text" : "password"}
                {...pwdForm.register("newPassword")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
              <button
                type="button"
                onClick={() => setShowNewPwd(!showNewPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {pwdForm.formState.errors.newPassword && (
              <p className="mt-1 text-xs text-red-600">{pwdForm.formState.errors.newPassword.message}</p>
            )}

            {watchNewPwd && (
              <div className="mt-2 space-y-1">
                {pwdChecks.map((check) => (
                  <div key={check.key} className="flex items-center gap-2">
                    {check.ok ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-gray-300" />
                    )}
                    <span className={`text-xs ${check.ok ? "text-green-600" : "text-gray-400"}`}>
                      {lang === "en" ? check.label_en : check.label_fr}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Confirm new password" : "Confirmer le nouveau mot de passe"}
            </label>
            <input
              type="password"
              {...pwdForm.register("confirmPassword")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            />
            {pwdForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{pwdForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={pwdSubmitting}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {pwdSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "en" ? "Change password" : "Changer le mot de passe"}
            </button>
          </div>
        </form>
      </div>

      {/* ─── Balances section ─── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          {lang === "en" ? "My Balances" : "Mes soldes"}{" "}
          <span className="text-sm font-normal text-gray-400">{new Date().getFullYear()}</span>
        </h2>

        {balances.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            {lang === "en" ? "No balance configured." : "Aucun solde configuré."}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {balances.map((b) => {
              const meta = BALANCE_LABELS[b.balanceType] ?? {
                fr: b.balanceType,
                en: b.balanceType,
                color: "#6B7280",
              };
              const totalPool = b.totalDays + b.carriedOverDays;
              const usedPct = totalPool > 0 ? Math.min(100, (b.usedDays / totalPool) * 100) : 0;
              const pendingPct = totalPool > 0 ? Math.min(100 - usedPct, (b.pendingDays / totalPool) * 100) : 0;

              return (
                <div key={b.balanceType} className="rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-500">
                    {lang === "en" ? meta.en : meta.fr}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {b.remaining}
                    <span className="ml-1 text-sm font-normal text-gray-400">/ {totalPool}j</span>
                  </p>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="flex h-full">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${usedPct}%`, backgroundColor: meta.color }}
                      />
                      <div
                        className="h-full transition-all"
                        style={{ width: `${pendingPct}%`, backgroundColor: meta.color, opacity: 0.4 }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>
                      {b.usedDays}j {lang === "en" ? "used" : "pris"}
                    </span>
                    {b.pendingDays > 0 && (
                      <span className="text-amber-600">
                        {b.pendingDays}j {lang === "en" ? "pending" : "en attente"}
                      </span>
                    )}
                    {b.carriedOverDays > 0 && (
                      <span>
                        {b.carriedOverDays}j {lang === "en" ? "carried over" : "reportés"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Notification preferences section ─── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "My Notifications" : "Mes notifications"}
          </h2>
          {notifSaving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {lang === "en"
            ? "Choose which notifications you want to receive."
            : "Choisissez les notifications que vous souhaitez recevoir."}
        </p>

        <div className="mt-4 space-y-1">
          {NOTIF_TYPES.map((nt) => (
            <div key={nt.type} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">
                {lang === "en" ? nt.en : nt.fr}
              </span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={notifPrefs[nt.type] ?? true}
                  onChange={(e) => handleNotifToggle(nt.type, e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#00BCD4] peer-checked:after:translate-x-full peer-checked:after:border-white" />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Personnel Tab ───

function PersonnelTab({
  profile,
  lang,
  personalForm,
  personalEditing,
  personalSaving,
  onEdit,
  onCancel,
  onSubmit,
}: {
  profile: UserProfile;
  lang: string;
  personalForm: ReturnType<typeof useForm<UserPersonalInput>>;
  personalEditing: boolean;
  personalSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (values: UserPersonalInput) => void;
}) {
  if (personalEditing) {
    return (
      <form onSubmit={personalForm.handleSubmit(onSubmit)} className="space-y-6">
        {/* Identité */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wider">
            {lang === "en" ? "Identity" : "Identité"}
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label={lang === "en" ? "Date of birth" : "Date de naissance"}
              type="date"
              register={personalForm.register("birthDate")}
              error={personalForm.formState.errors.birthDate?.message as string}
            />
            <FormField
              label={lang === "en" ? "City of birth" : "Ville de naissance"}
              register={personalForm.register("birthCity")}
              error={personalForm.formState.errors.birthCity?.message as string}
            />
            <FormField
              label={lang === "en" ? "Country of birth" : "Pays de naissance"}
              register={personalForm.register("birthCountry")}
              error={personalForm.formState.errors.birthCountry?.message as string}
            />
            <FormField
              label={lang === "en" ? "Nationality" : "Nationalité"}
              register={personalForm.register("nationality")}
              error={personalForm.formState.errors.nationality?.message as string}
            />
            <FormSelect
              label={lang === "en" ? "Gender" : "Genre"}
              register={personalForm.register("gender")}
              options={Object.entries(GENDER_LABELS).map(([value, labels]) => ({
                value,
                label: lang === "en" ? labels.en : labels.fr,
              }))}
              error={personalForm.formState.errors.gender?.message as string}
            />
            <FormSelect
              label={lang === "en" ? "Marital status" : "Situation familiale"}
              register={personalForm.register("maritalStatus")}
              options={Object.entries(MARITAL_LABELS).map(([value, labels]) => ({
                value,
                label: lang === "en" ? labels.en : labels.fr,
              }))}
              error={personalForm.formState.errors.maritalStatus?.message as string}
            />
            <FormField
              label={lang === "en" ? "Dependents" : "Personnes à charge"}
              type="number"
              register={personalForm.register("dependentsCount", { valueAsNumber: true })}
              error={personalForm.formState.errors.dependentsCount?.message as string}
            />
          </div>
        </fieldset>

        {/* Coordonnées */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wider">
            {lang === "en" ? "Contact details" : "Coordonnées"}
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label={lang === "en" ? "Personal email" : "Email personnel"}
              type="email"
              register={personalForm.register("personalEmail")}
              error={personalForm.formState.errors.personalEmail?.message as string}
            />
            <FormField
              label={lang === "en" ? "Phone" : "Téléphone fixe"}
              register={personalForm.register("personalPhone")}
              error={personalForm.formState.errors.personalPhone?.message as string}
            />
            <FormField
              label={lang === "en" ? "Mobile" : "Mobile"}
              register={personalForm.register("personalMobile")}
              error={personalForm.formState.errors.personalMobile?.message as string}
            />
          </div>
        </fieldset>

        {/* Adresse */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-gray-900 uppercase tracking-wider">
            {lang === "en" ? "Address" : "Adresse"}
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FormField
                label={lang === "en" ? "Street" : "Rue"}
                register={personalForm.register("personalAddressStreet")}
                error={personalForm.formState.errors.personalAddressStreet?.message as string}
              />
            </div>
            <FormField
              label={lang === "en" ? "Zip code" : "Code postal"}
              register={personalForm.register("personalAddressZip")}
              error={personalForm.formState.errors.personalAddressZip?.message as string}
            />
            <FormField
              label={lang === "en" ? "City" : "Ville"}
              register={personalForm.register("personalAddressCity")}
              error={personalForm.formState.errors.personalAddressCity?.message as string}
            />
            <FormField
              label={lang === "en" ? "Country" : "Pays"}
              register={personalForm.register("personalAddressCountry")}
              error={personalForm.formState.errors.personalAddressCountry?.message as string}
            />
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={personalSaving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {lang === "en" ? "Cancel" : "Annuler"}
          </button>
          <button
            type="submit"
            disabled={personalSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
          >
            {personalSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {lang === "en" ? "Save" : "Enregistrer"}
          </button>
        </div>
      </form>
    );
  }

  // Read-only view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          {lang === "en" ? "Personal information" : "Informations personnelles"}
        </h3>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {lang === "en" ? "Edit" : "Modifier"}
        </button>
      </div>

      {/* Identité */}
      <SectionTitle icon={User} label={lang === "en" ? "Identity" : "Identité"} />
      <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField
          icon={CalendarDays}
          label={lang === "en" ? "Date of birth" : "Date de naissance"}
          value={formatDate(profile.birthDate, lang)}
        />
        <ReadonlyField
          icon={MapPin}
          label={lang === "en" ? "City of birth" : "Ville de naissance"}
          value={profile.birthCity || "—"}
        />
        <ReadonlyField
          icon={Globe}
          label={lang === "en" ? "Country of birth" : "Pays de naissance"}
          value={profile.birthCountry || "—"}
        />
        <ReadonlyField
          icon={Flag}
          label={lang === "en" ? "Nationality" : "Nationalité"}
          value={profile.nationality || "—"}
        />
        <ReadonlyField
          icon={User}
          label={lang === "en" ? "Gender" : "Genre"}
          value={profile.gender ? (lang === "en" ? GENDER_LABELS[profile.gender]?.en : GENDER_LABELS[profile.gender]?.fr) || profile.gender : "—"}
        />
        <ReadonlyField
          icon={Heart}
          label={lang === "en" ? "Marital status" : "Situation familiale"}
          value={profile.maritalStatus ? (lang === "en" ? MARITAL_LABELS[profile.maritalStatus]?.en : MARITAL_LABELS[profile.maritalStatus]?.fr) || profile.maritalStatus : "—"}
        />
        <ReadonlyField
          icon={Baby}
          label={lang === "en" ? "Dependents" : "Personnes à charge"}
          value={String(profile.dependentsCount ?? 0)}
        />
      </div>

      {/* Coordonnées */}
      <SectionTitle icon={Phone} label={lang === "en" ? "Contact details" : "Coordonnées"} />
      <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField
          icon={Mail}
          label={lang === "en" ? "Personal email" : "Email personnel"}
          value={profile.personalEmail || "—"}
        />
        <ReadonlyField
          icon={Phone}
          label={lang === "en" ? "Phone" : "Téléphone fixe"}
          value={profile.personalPhone || "—"}
        />
        <ReadonlyField
          icon={Phone}
          label={lang === "en" ? "Mobile" : "Mobile"}
          value={profile.personalMobile || "—"}
        />
      </div>

      {/* Adresse */}
      <SectionTitle icon={MapPin} label={lang === "en" ? "Address" : "Adresse"} />
      <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2">
        <ReadonlyField
          icon={MapPin}
          label={lang === "en" ? "Street" : "Rue"}
          value={profile.personalAddressStreet || "—"}
        />
        <ReadonlyField
          icon={MapPin}
          label={lang === "en" ? "Zip code" : "Code postal"}
          value={profile.personalAddressZip || "—"}
        />
        <ReadonlyField
          icon={MapPin}
          label={lang === "en" ? "City" : "Ville"}
          value={profile.personalAddressCity || "—"}
        />
        <ReadonlyField
          icon={Globe}
          label={lang === "en" ? "Country" : "Pays"}
          value={profile.personalAddressCountry || "—"}
        />
      </div>

      {/* Contacts d'urgence — CRUD */}
      <EmergencyContactsSection lang={lang} />
    </div>
  );
}

// ─── Emergency Contacts Section (CRUD) ───

const RELATION_OPTIONS = [
  { value: "Conjoint", fr: "Conjoint(e)", en: "Spouse" },
  { value: "Parent", fr: "Parent", en: "Parent" },
  { value: "Enfant", fr: "Enfant", en: "Child" },
  { value: "Frère/Sœur", fr: "Frère/Sœur", en: "Sibling" },
  { value: "Ami", fr: "Ami(e)", en: "Friend" },
  { value: "Autre", fr: "Autre", en: "Other" },
];

function EmergencyContactsSection({ lang }: { lang: string }) {
  const { addToast } = useToast();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [deletingContact, setDeletingContact] = useState<EmergencyContact | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<EmergencyContactInput>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: {
      priority: 1,
      firstName: "",
      lastName: "",
      relation: "",
      phone: "",
      mobile: "",
      email: "",
      address: "",
    },
  });

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/emergency-contacts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const openCreate = () => {
    setEditingContact(null);
    const nextPriority = contacts.length > 0
      ? Math.max(...contacts.map((c) => c.priority)) + 1
      : 1;
    form.reset({
      priority: Math.min(nextPriority, 5),
      firstName: "",
      lastName: "",
      relation: "",
      phone: "",
      mobile: "",
      email: "",
      address: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (contact: EmergencyContact) => {
    setEditingContact(contact);
    form.reset({
      priority: contact.priority,
      firstName: contact.firstName,
      lastName: contact.lastName,
      relation: contact.relation,
      phone: contact.phone,
      mobile: contact.mobile || "",
      email: contact.email || "",
      address: contact.address || "",
    });
    setDialogOpen(true);
  };

  const openDelete = (contact: EmergencyContact) => {
    setDeletingContact(contact);
    setDeleteOpen(true);
  };

  const handleSubmit = async (values: EmergencyContactInput) => {
    setSubmitting(true);
    try {
      const isEdit = !!editingContact;
      const url = isEdit
        ? `/api/profile/emergency-contacts/${editingContact.id}`
        : "/api/profile/emergency-contacts";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const err = await res.json();
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: err.error });
        return;
      }

      const saved = await res.json();

      // Optimistic update
      if (isEdit) {
        setContacts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)).sort((a, b) => a.priority - b.priority));
      } else {
        setContacts((prev) => [...prev, saved].sort((a, b) => a.priority - b.priority));
      }

      setDialogOpen(false);
      addToast({
        type: "success",
        title: isEdit
          ? (lang === "en" ? "Contact updated" : "Contact mis à jour")
          : (lang === "en" ? "Contact added" : "Contact ajouté"),
      });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingContact) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/profile/emergency-contacts/${deletingContact.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: err.error });
        return;
      }
      setContacts((prev) => prev.filter((c) => c.id !== deletingContact.id));
      setDeleteOpen(false);
      setDeletingContact(null);
      addToast({
        type: "success",
        title: lang === "en" ? "Contact deleted" : "Contact supprimé",
      });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setSubmitting(false);
    }
  };

  const hasPriority1 = contacts.some((c) => c.priority === 1);

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 pt-2">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {lang === "en" ? "Emergency contacts" : "Contacts d'urgence"}
          </span>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            {contacts.length}/5
          </span>
        </div>
        {contacts.length < 5 && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === "en" ? "Add" : "Ajouter"}
          </button>
        )}
      </div>

      {/* Alert: no priority 1 contact */}
      {!loading && contacts.length > 0 && !hasPriority1 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mt-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-700">
            {lang === "en"
              ? "No primary contact (priority #1). Please designate one."
              : "Aucun contact principal (priorité #1). Veuillez en désigner un."}
          </p>
        </div>
      )}

      {/* Alert: no contacts at all */}
      {!loading && contacts.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mt-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-700">
            {lang === "en"
              ? "No emergency contacts configured. Please add at least one."
              : "Aucun contact d'urgence configuré. Veuillez en ajouter au moins un."}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="group flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 transition-colors hover:bg-gray-100"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    c.priority === 1
                      ? "bg-[#1B3A5C] text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {c.priority}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {c.firstName} {c.lastName}
                    <span className="ml-2 text-xs font-normal text-gray-500">({c.relation})</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.phone}
                    {c.mobile ? ` / ${c.mobile}` : ""}
                    {c.email ? ` — ${c.email}` : ""}
                  </p>
                  {c.address && (
                    <p className="text-xs text-gray-400">{c.address}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => openEdit(c)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-[#1B3A5C]"
                  title={lang === "en" ? "Edit" : "Modifier"}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openDelete(c)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-red-600"
                  title={lang === "en" ? "Delete" : "Supprimer"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={
          editingContact
            ? (lang === "en" ? "Edit emergency contact" : "Modifier le contact d'urgence")
            : (lang === "en" ? "Add emergency contact" : "Ajouter un contact d'urgence")
        }
        maxWidth="md"
      >
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Priority + Relation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Priority" : "Priorité"}
              </label>
              <select
                {...form.register("priority", { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    #{n} {n === 1 ? (lang === "en" ? "(Primary)" : "(Principal)") : ""}
                  </option>
                ))}
              </select>
              {form.formState.errors.priority && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.priority.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Relationship" : "Relation"}
              </label>
              <select
                {...form.register("relation")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              >
                <option value="">—</option>
                {RELATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {lang === "en" ? opt.en : opt.fr}
                  </option>
                ))}
              </select>
              {form.formState.errors.relation && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.relation.message}</p>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={lang === "en" ? "First name" : "Prénom"}
              register={form.register("firstName")}
              error={form.formState.errors.firstName?.message}
            />
            <FormField
              label={lang === "en" ? "Last name" : "Nom"}
              register={form.register("lastName")}
              error={form.formState.errors.lastName?.message}
            />
          </div>

          {/* Phone + Mobile */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={lang === "en" ? "Phone *" : "Téléphone *"}
              register={form.register("phone")}
              error={form.formState.errors.phone?.message}
            />
            <FormField
              label={lang === "en" ? "Mobile" : "Mobile"}
              register={form.register("mobile")}
              error={form.formState.errors.mobile?.message}
            />
          </div>

          {/* Email */}
          <FormField
            label={lang === "en" ? "Email" : "Email"}
            type="email"
            register={form.register("email")}
            error={form.formState.errors.email?.message}
          />

          {/* Address */}
          <FormField
            label={lang === "en" ? "Address" : "Adresse"}
            register={form.register("address")}
            error={form.formState.errors.address?.message}
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {lang === "en" ? "Cancel" : "Annuler"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingContact
                ? (lang === "en" ? "Save" : "Enregistrer")
                : (lang === "en" ? "Add" : "Ajouter")}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeletingContact(null);
        }}
        onConfirm={handleDelete}
        title={lang === "en" ? "Delete contact" : "Supprimer le contact"}
        message={
          deletingContact
            ? lang === "en"
              ? `Are you sure you want to delete ${deletingContact.firstName} ${deletingContact.lastName}?`
              : `Êtes-vous sûr de vouloir supprimer ${deletingContact.firstName} ${deletingContact.lastName} ?`
            : ""
        }
        confirmLabel={lang === "en" ? "Delete" : "Supprimer"}
        loading={submitting}
      />
    </>
  );
}

// ─── Professionnel Tab ───

function ProfessionnelTab({ profile, lang }: { profile: UserProfile; lang: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          {lang === "en" ? "Professional information" : "Informations professionnelles"}
        </h3>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
          {lang === "en" ? "Read only" : "Lecture seule"}
        </span>
      </div>

      <p className="text-xs text-gray-400">
        {lang === "en"
          ? "This information is managed by HR. Contact your HR department to make changes."
          : "Ces informations sont gérées par les RH. Contactez votre service RH pour toute modification."}
      </p>

      <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField
          icon={Briefcase}
          label={lang === "en" ? "Service" : "Service"}
          value={profile.service || "—"}
        />
        <ReadonlyField
          icon={Briefcase}
          label={lang === "en" ? "Job function" : "Fonction"}
          value={profile.jobFunction || "—"}
        />
        <ReadonlyField
          icon={Phone}
          label={lang === "en" ? "Professional phone" : "Téléphone professionnel"}
          value={profile.professionalPhone || "—"}
        />
        <ReadonlyField
          icon={Hash}
          label={lang === "en" ? "Internal number" : "Numéro interne"}
          value={profile.internalNumber || "—"}
        />
        <ReadonlyField
          icon={Hash}
          label={lang === "en" ? "Accounting code" : "Code comptable"}
          value={profile.accountingCode || "—"}
        />
        <ReadonlyField
          icon={Building2}
          label={lang === "en" ? "Office" : "Bureau"}
          value={`${profile.office.name} — ${profile.office.city}, ${profile.office.country}`}
        />
        <ReadonlyField
          icon={Users}
          label={lang === "en" ? "Team" : "Équipe"}
          value={profile.team?.name ?? (lang === "en" ? "No team" : "Aucune équipe")}
        />
      </div>
    </div>
  );
}

// ─── Compétences & Objectifs Tab ───

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
  createdAt: string;
  manager: { id: string; firstName: string; lastName: string } | null;
}

const SKILL_TYPE_LABELS: Record<string, { fr: string; en: string; color: string }> = {
  TECHNICAL: { fr: "Technique", en: "Technical", color: "bg-blue-100 text-blue-700" },
  SOFT: { fr: "Soft skill", en: "Soft skill", color: "bg-green-100 text-green-700" },
  BEHAVIORAL: { fr: "Comportemental", en: "Behavioral", color: "bg-purple-100 text-purple-700" },
  OTHER: { fr: "Autre", en: "Other", color: "bg-gray-100 text-gray-600" },
};

const SKILL_LEVEL_LABELS: Record<string, { fr: string; en: string; order: number }> = {
  BEGINNER: { fr: "Débutant", en: "Beginner", order: 1 },
  INTERMEDIATE: { fr: "Intermédiaire", en: "Intermediate", order: 2 },
  ADVANCED: { fr: "Avancé", en: "Advanced", order: 3 },
  EXPERT: { fr: "Expert", en: "Expert", order: 4 },
};

const OBJECTIVE_STATUS_LABELS: Record<string, { fr: string; en: string; color: string }> = {
  IN_PROGRESS: { fr: "En cours", en: "In progress", color: "bg-blue-100 text-blue-700" },
  ACHIEVED: { fr: "Atteint", en: "Achieved", color: "bg-green-100 text-green-700" },
  PARTIALLY_ACHIEVED: { fr: "Partiellement atteint", en: "Partially achieved", color: "bg-amber-100 text-amber-700" },
  NOT_ACHIEVED: { fr: "Non atteint", en: "Not achieved", color: "bg-red-100 text-red-700" },
  CANCELLED: { fr: "Annulé", en: "Cancelled", color: "bg-gray-100 text-gray-500" },
};

const SKILL_TYPE_OPTIONS = ["TECHNICAL", "SOFT", "BEHAVIORAL", "OTHER"] as const;
const SKILL_LEVEL_OPTIONS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

function CompetencesTab({ lang }: { lang: string }) {
  const { addToast } = useToast();

  // ─── Skills state ───
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillDialogOpen, setSkillDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillData | null>(null);
  const [skillSubmitting, setSkillSubmitting] = useState(false);

  // ─── Objectives state ───
  const [objectives, setObjectives] = useState<ObjectiveData[]>([]);
  const [objectivesLoading, setObjectivesLoading] = useState(true);
  const [objectiveStats, setObjectiveStats] = useState<{
    total: number; achieved: number; inProgress: number; achievementRate: number | null;
  } | null>(null);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const skillForm = useForm<SkillCreateInput>({
    resolver: zodResolver(skillCreateSchema),
    defaultValues: { name: "", type: "TECHNICAL", selfLevel: undefined, description: "", evidence: "" },
  });

  const selfUpdateForm = useForm<SkillSelfUpdateInput>({
    resolver: zodResolver(skillSelfUpdateSchema),
  });

  // ─── Fetch data ───
  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/skills", { cache: "no-store" });
      if (res.ok) setSkills(await res.json());
    } catch { /* silent */ } finally { setSkillsLoading(false); }
  }, []);

  const fetchObjectives = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/objectives", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setObjectives(data.objectives);
        setObjectiveStats(data.stats);
      }
    } catch { /* silent */ } finally { setObjectivesLoading(false); }
  }, []);

  useEffect(() => { fetchSkills(); fetchObjectives(); }, [fetchSkills, fetchObjectives]);

  // ─── Skill handlers ───
  const openAddSkill = () => {
    setEditingSkill(null);
    skillForm.reset({ name: "", type: "TECHNICAL", selfLevel: undefined, description: "", evidence: "" });
    setSkillDialogOpen(true);
  };

  const openEditSelfLevel = (skill: SkillData) => {
    setEditingSkill(skill);
    selfUpdateForm.reset({
      selfLevel: (skill.selfLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT") ?? "BEGINNER",
      evidence: skill.evidence ?? "",
    });
    setSkillDialogOpen(true);
  };

  const handleSkillCreate = async (values: SkillCreateInput) => {
    setSkillSubmitting(true);
    try {
      const res = await fetch("/api/profile/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: err.error });
        return;
      }
      const created = await res.json();
      setSkills((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSkillDialogOpen(false);
      addToast({ type: "success", title: lang === "en" ? "Skill added" : "Compétence ajoutée" });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally { setSkillSubmitting(false); }
  };

  const handleSelfLevelUpdate = async (values: SkillSelfUpdateInput) => {
    if (!editingSkill) return;
    setSkillSubmitting(true);
    try {
      const res = await fetch(`/api/profile/skills/${editingSkill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: err.error });
        return;
      }
      const updated = await res.json();
      setSkills((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setSkillDialogOpen(false);
      addToast({ type: "success", title: lang === "en" ? "Updated" : "Mis à jour" });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally { setSkillSubmitting(false); }
  };

  const handleDeleteSkill = async (skillId: string) => {
    try {
      const res = await fetch(`/api/profile/skills/${skillId}`, { method: "DELETE" });
      if (res.ok) {
        setSkills((prev) => prev.filter((s) => s.id !== skillId));
        addToast({ type: "success", title: lang === "en" ? "Skill removed" : "Compétence supprimée" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    }
  };

  // ─── Objective comment handler ───
  const handleSelfComment = async (objectiveId: string) => {
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/profile/objectives/${objectiveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfComment: commentText }),
      });
      if (res.ok) {
        setObjectives((prev) => prev.map((o) => (o.id === objectiveId ? { ...o, selfComment: commentText } : o)));
        setCommentingId(null);
        setCommentText("");
        addToast({ type: "success", title: lang === "en" ? "Comment saved" : "Commentaire enregistré" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally { setCommentSubmitting(false); }
  };

  // ─── Level comparison helper ───
  const renderLevelComparison = (selfLevel: string | null, managerLevel: string | null) => {
    const selfLabel = selfLevel ? (lang === "en" ? SKILL_LEVEL_LABELS[selfLevel]?.en : SKILL_LEVEL_LABELS[selfLevel]?.fr) : null;
    const mgrLabel = managerLevel ? (lang === "en" ? SKILL_LEVEL_LABELS[managerLevel]?.en : SKILL_LEVEL_LABELS[managerLevel]?.fr) : null;
    const mismatch = selfLevel && managerLevel && selfLevel !== managerLevel;

    return (
      <div className="flex items-center gap-2 text-xs">
        {selfLabel && (
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">
            {lang === "en" ? "Self" : "Auto"}: {selfLabel}
          </span>
        )}
        {mgrLabel && (
          <span className={`rounded px-1.5 py-0.5 ${mismatch ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
            {lang === "en" ? "Mgr" : "Mgr"}: {mgrLabel}
          </span>
        )}
        {!selfLabel && !mgrLabel && (
          <span className="text-gray-400">{lang === "en" ? "Not assessed" : "Non évalué"}</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* ═══ SKILLS SECTION ═══ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">
              {lang === "en" ? "Skills" : "Compétences"}
            </h3>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              {skills.length}
            </span>
          </div>
          <button
            onClick={openAddSkill}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === "en" ? "Add skill" : "Ajouter"}
          </button>
        </div>

        <p className="text-xs text-gray-400">
          {lang === "en"
            ? "Self-assess your skills. Your manager can also provide their evaluation."
            : "Auto-évaluez vos compétences. Votre manager peut également fournir son évaluation."}
        </p>

        {skillsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : skills.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <Star className="h-4 w-4 text-gray-400" />
            <p className="text-sm text-gray-500">
              {lang === "en" ? "No skills added yet. Start by adding your first skill." : "Aucune compétence ajoutée. Commencez par ajouter vos compétences."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="group relative rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{skill.name}</p>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${SKILL_TYPE_LABELS[skill.type]?.color ?? "bg-gray-100"}`}>
                      {lang === "en" ? SKILL_TYPE_LABELS[skill.type]?.en : SKILL_TYPE_LABELS[skill.type]?.fr}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEditSelfLevel(skill)}
                      className="rounded p-1 text-gray-400 hover:bg-white hover:text-[#1B3A5C]"
                      title={lang === "en" ? "Self-assess" : "Auto-évaluer"}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSkill(skill.id)}
                      className="rounded p-1 text-gray-400 hover:bg-white hover:text-red-600"
                      title={lang === "en" ? "Remove" : "Supprimer"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {renderLevelComparison(skill.selfLevel, skill.managerLevel)}
                {skill.description && (
                  <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{skill.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ OBJECTIVES SECTION ═══ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">
              {lang === "en" ? "Objectives" : "Objectifs"}
            </h3>
            {objectiveStats && objectiveStats.total > 0 && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                {objectiveStats.achievementRate != null
                  ? `${objectiveStats.achievementRate}% ${lang === "en" ? "achieved" : "atteint"}`
                  : `${objectiveStats.inProgress} ${lang === "en" ? "in progress" : "en cours"}`}
              </span>
            )}
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
            {lang === "en" ? "Assigned by manager" : "Assigné par le manager"}
          </span>
        </div>

        <p className="text-xs text-gray-400">
          {lang === "en"
            ? "Objectives are assigned by your manager. You can add a self-assessment comment."
            : "Les objectifs sont assignés par votre manager. Vous pouvez ajouter un commentaire d'auto-évaluation."}
        </p>

        {objectivesLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : objectives.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <Target className="h-4 w-4 text-gray-400" />
            <p className="text-sm text-gray-500">
              {lang === "en" ? "No objectives assigned yet." : "Aucun objectif assigné pour le moment."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {objectives.filter((o) => o.status !== "CANCELLED").map((obj) => (
              <div key={obj.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{obj.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${OBJECTIVE_STATUS_LABELS[obj.status]?.color ?? "bg-gray-100"}`}>
                        {lang === "en" ? OBJECTIVE_STATUS_LABELS[obj.status]?.en : OBJECTIVE_STATUS_LABELS[obj.status]?.fr}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">{obj.description}</p>
                  </div>
                </div>

                {/* Progress bar */}
                {obj.progress != null && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{lang === "en" ? "Progress" : "Progression"}</span>
                      <span>{obj.progress}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full transition-all ${obj.progress >= 100 ? "bg-green-500" : obj.progress >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                        style={{ width: `${Math.min(obj.progress, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <span>
                    {lang === "en" ? "Deadline" : "Échéance"}: {formatDate(obj.deadline, lang)}
                  </span>
                  {obj.manager && (
                    <span>
                      {lang === "en" ? "By" : "Par"} {obj.manager.firstName} {obj.manager.lastName}
                    </span>
                  )}
                </div>

                {/* Manager comment */}
                {obj.managerComment && (
                  <div className="mt-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    <span className="font-medium">Manager:</span> {obj.managerComment}
                  </div>
                )}

                {/* Self comment */}
                {obj.selfComment && commentingId !== obj.id && (
                  <div className="mt-2 flex items-start justify-between rounded bg-gray-100 px-3 py-2 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">{lang === "en" ? "Your comment" : "Votre commentaire"}:</span> {obj.selfComment}
                    </div>
                    <button
                      onClick={() => { setCommentingId(obj.id); setCommentText(obj.selfComment || ""); }}
                      className="ml-2 shrink-0 text-gray-400 hover:text-[#1B3A5C]"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Self comment editor */}
                {commentingId === obj.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder={lang === "en" ? "Your self-assessment comment..." : "Votre commentaire d'auto-évaluation..."}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setCommentingId(null); setCommentText(""); }}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        {lang === "en" ? "Cancel" : "Annuler"}
                      </button>
                      <button
                        disabled={commentSubmitting}
                        onClick={() => handleSelfComment(obj.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1B3A5C] px-3 py-1 text-xs text-white hover:bg-[#15304d] disabled:opacity-50"
                      >
                        {commentSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                        {lang === "en" ? "Save" : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                ) : !obj.selfComment && (
                  <button
                    onClick={() => { setCommentingId(obj.id); setCommentText(""); }}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#1B3A5C]"
                  >
                    <Plus className="h-3 w-3" />
                    {lang === "en" ? "Add your comment" : "Ajouter votre commentaire"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ SKILL CREATE / SELF-LEVEL DIALOG ═══ */}
      <Dialog
        open={skillDialogOpen}
        onClose={() => setSkillDialogOpen(false)}
        title={
          editingSkill
            ? (lang === "en" ? `Assess: ${editingSkill.name}` : `Évaluer : ${editingSkill.name}`)
            : (lang === "en" ? "Add a skill" : "Ajouter une compétence")
        }
        maxWidth="md"
      >
        {editingSkill ? (
          /* Self-level update form */
          <form onSubmit={selfUpdateForm.handleSubmit(handleSelfLevelUpdate)} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Your level" : "Votre niveau"}
              </label>
              <select
                {...selfUpdateForm.register("selfLevel")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              >
                {SKILL_LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {lang === "en" ? SKILL_LEVEL_LABELS[level]?.en : SKILL_LEVEL_LABELS[level]?.fr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Evidence / notes" : "Preuves / notes"}
              </label>
              <textarea
                {...selfUpdateForm.register("evidence")}
                rows={3}
                placeholder={lang === "en" ? "Certifications, projects, etc." : "Certifications, projets, etc."}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
            </div>
            {editingSkill.managerLevel && (
              <div className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
                {lang === "en" ? "Manager assessment" : "Évaluation manager"}: <strong>{lang === "en" ? SKILL_LEVEL_LABELS[editingSkill.managerLevel]?.en : SKILL_LEVEL_LABELS[editingSkill.managerLevel]?.fr}</strong>
              </div>
            )}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button type="button" onClick={() => setSkillDialogOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
              <button type="submit" disabled={skillSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm text-white hover:bg-[#15304d] disabled:opacity-50">
                {skillSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "en" ? "Save" : "Enregistrer"}
              </button>
            </div>
          </form>
        ) : (
          /* Create skill form */
          <form onSubmit={skillForm.handleSubmit(handleSkillCreate)} className="space-y-4">
            <FormField
              label={lang === "en" ? "Skill name *" : "Nom de la compétence *"}
              register={skillForm.register("name")}
              error={skillForm.formState.errors.name?.message}
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {lang === "en" ? "Type" : "Type"}
                </label>
                <select
                  {...skillForm.register("type")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                >
                  {SKILL_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {lang === "en" ? SKILL_TYPE_LABELS[t]?.en : SKILL_TYPE_LABELS[t]?.fr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {lang === "en" ? "Your level" : "Votre niveau"}
                </label>
                <select
                  {...skillForm.register("selfLevel")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                >
                  <option value="">—</option>
                  {SKILL_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {lang === "en" ? SKILL_LEVEL_LABELS[level]?.en : SKILL_LEVEL_LABELS[level]?.fr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Description" : "Description"}
              </label>
              <textarea
                {...skillForm.register("description")}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
            </div>
            <FormField
              label={lang === "en" ? "Evidence / certification" : "Preuve / certification"}
              register={skillForm.register("evidence")}
              error={skillForm.formState.errors.evidence?.message}
            />
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button type="button" onClick={() => setSkillDialogOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
              <button type="submit" disabled={skillSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm text-white hover:bg-[#15304d] disabled:opacity-50">
                {skillSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "en" ? "Add" : "Ajouter"}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

// ─── Contrat Tab ───

interface ContractData {
  id: string;
  type: string;
  status: string;
  contractNumber: string | null;
  startDate: string;
  endDate: string | null;
  trialPeriodEnd: string | null;
  weeklyHours: number | null;
  currency: string;
  jobTitle: string;
  department: string | null;
  conventionCollective: string | null;
  location: string | null;
  remoteAllowed: boolean;
  remotePercentage: number | null;
  signedAt: string | null;
  terminatedAt?: string | null;
  manager: { id: string; firstName: string; lastName: string } | null;
}

interface ContractHistory {
  id: string;
  type: string;
  status: string;
  contractNumber: string | null;
  startDate: string;
  endDate: string | null;
  jobTitle: string;
  signedAt: string | null;
  terminatedAt: string | null;
}

const CONTRACT_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  CDI: { fr: "CDI", en: "Permanent" },
  CDD: { fr: "CDD", en: "Fixed-term" },
  SIVP: { fr: "SIVP", en: "SIVP" },
  STAGE: { fr: "Stage", en: "Internship" },
  ALTERNANCE: { fr: "Alternance", en: "Apprenticeship" },
  FREELANCE: { fr: "Freelance", en: "Freelance" },
  AUTRE: { fr: "Autre", en: "Other" },
};

const CONTRACT_STATUS_LABELS: Record<string, { fr: string; en: string; color: string }> = {
  ACTIF: { fr: "Actif", en: "Active", color: "bg-green-100 text-green-700" },
  TERMINE: { fr: "Terminé", en: "Ended", color: "bg-gray-100 text-gray-600" },
  SUSPENDU: { fr: "Suspendu", en: "Suspended", color: "bg-amber-100 text-amber-700" },
  EN_PROLONGATION: { fr: "En prolongation", en: "Extended", color: "bg-blue-100 text-blue-700" },
  EN_ATTENTE_SIGNATURE: { fr: "En attente", en: "Pending", color: "bg-purple-100 text-purple-700" },
};

function ContratTab({ profile, lang }: { profile: UserProfile; lang: string }) {
  const [activeContract, setActiveContract] = useState<ContractData | null>(null);
  const [history, setHistory] = useState<ContractHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContract() {
      try {
        const res = await fetch("/api/profile/contract", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setActiveContract(data.active);
          setHistory(data.history ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchContract();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          {lang === "en" ? "Contract information" : "Informations contractuelles"}
        </h3>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
          {lang === "en" ? "Managed by HR" : "Géré par les RH"}
        </span>
      </div>

      <p className="text-xs text-gray-400">
        {lang === "en"
          ? "This information is managed by HR. Contact your HR department to make changes."
          : "Ces informations sont gérées par les RH. Contactez votre service RH pour toute modification."}
      </p>

      {/* Legacy fields from User */}
      <SectionTitle icon={Building2} label={lang === "en" ? "Employment" : "Emploi"} />
      <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <ReadonlyField
          icon={CalendarDays}
          label={lang === "en" ? "Hire date" : "Date d'embauche"}
          value={formatDate(profile.hireDate, lang)}
        />
        <ReadonlyField
          icon={Clock}
          label={lang === "en" ? "Arrival date" : "Date d'arrivée"}
          value={formatDate(profile.arrivalDate, lang)}
        />
        <ReadonlyField
          icon={Clock}
          label={lang === "en" ? "Departure date" : "Date de départ"}
          value={formatDate(profile.departureDate, lang)}
        />
        <ReadonlyField
          icon={Building2}
          label={lang === "en" ? "Office" : "Bureau"}
          value={`${profile.office.name} — ${profile.office.city}`}
        />
        <ReadonlyField
          icon={Users}
          label={lang === "en" ? "Team" : "Équipe"}
          value={profile.team?.name ?? (lang === "en" ? "No team" : "Aucune équipe")}
        />
        <ReadonlyField
          icon={Shield}
          label={lang === "en" ? "Roles" : "Rôles"}
          value={profile.roles
            .map((r) => {
              const l = ROLE_LABELS[r];
              return l ? (lang === "en" ? l.en : l.fr) : r;
            })
            .join(", ")}
        />
      </div>

      {/* Active Contract */}
      <SectionTitle icon={FileText} label={lang === "en" ? "Active contract" : "Contrat actif"} />

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : activeContract ? (
        <div className="space-y-4">
          {/* Status + Type badges */}
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTRACT_STATUS_LABELS[activeContract.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
              {lang === "en"
                ? CONTRACT_STATUS_LABELS[activeContract.status]?.en
                : CONTRACT_STATUS_LABELS[activeContract.status]?.fr}
            </span>
            <span className="rounded-full bg-[#1B3A5C]/10 px-2.5 py-0.5 text-xs font-medium text-[#1B3A5C]">
              {lang === "en"
                ? CONTRACT_TYPE_LABELS[activeContract.type]?.en
                : CONTRACT_TYPE_LABELS[activeContract.type]?.fr}
            </span>
            {activeContract.contractNumber && (
              <span className="text-xs text-gray-400">
                N° {activeContract.contractNumber}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <ReadonlyField
              icon={Briefcase}
              label={lang === "en" ? "Job title" : "Poste"}
              value={activeContract.jobTitle}
            />
            {activeContract.department && (
              <ReadonlyField
                icon={Building2}
                label={lang === "en" ? "Department" : "Service"}
                value={activeContract.department}
              />
            )}
            <ReadonlyField
              icon={CalendarDays}
              label={lang === "en" ? "Start date" : "Date de début"}
              value={formatDate(activeContract.startDate, lang)}
            />
            {activeContract.endDate && (
              <ReadonlyField
                icon={CalendarDays}
                label={lang === "en" ? "End date" : "Date de fin"}
                value={formatDate(activeContract.endDate, lang)}
              />
            )}
            {activeContract.trialPeriodEnd && (
              <ReadonlyField
                icon={Clock}
                label={lang === "en" ? "Trial period end" : "Fin période d'essai"}
                value={formatDate(activeContract.trialPeriodEnd, lang)}
              />
            )}
            {activeContract.weeklyHours != null && (
              <ReadonlyField
                icon={Clock}
                label={lang === "en" ? "Weekly hours" : "Heures/semaine"}
                value={`${activeContract.weeklyHours}h`}
              />
            )}
            {activeContract.location && (
              <ReadonlyField
                icon={MapPin}
                label={lang === "en" ? "Work location" : "Lieu de travail"}
                value={activeContract.location}
              />
            )}
            {activeContract.remoteAllowed && (
              <ReadonlyField
                icon={Globe}
                label={lang === "en" ? "Remote work" : "Télétravail"}
                value={
                  activeContract.remotePercentage != null
                    ? `${lang === "en" ? "Yes" : "Oui"} — ${activeContract.remotePercentage}%`
                    : lang === "en" ? "Yes" : "Oui"
                }
              />
            )}
            {activeContract.manager && (
              <ReadonlyField
                icon={User}
                label={lang === "en" ? "Manager" : "Responsable"}
                value={`${activeContract.manager.firstName} ${activeContract.manager.lastName}`}
              />
            )}
            {activeContract.conventionCollective && (
              <ReadonlyField
                icon={FileText}
                label={lang === "en" ? "Collective agreement" : "Convention collective"}
                value={activeContract.conventionCollective}
              />
            )}
            {activeContract.signedAt && (
              <ReadonlyField
                icon={Check}
                label={lang === "en" ? "Signed on" : "Signé le"}
                value={formatDate(activeContract.signedAt, lang)}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <FileText className="h-4 w-4 text-gray-400" />
          <p className="text-sm text-gray-500">
            {lang === "en" ? "No active contract found." : "Aucun contrat actif trouvé."}
          </p>
        </div>
      )}

      {/* Contract History */}
      {history.length > 1 && (
        <>
          <SectionTitle icon={Clock} label={lang === "en" ? "Contract history" : "Historique des contrats"} />
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">{lang === "en" ? "Type" : "Type"}</th>
                  <th className="px-4 py-2">{lang === "en" ? "Status" : "Statut"}</th>
                  <th className="px-4 py-2">{lang === "en" ? "Job title" : "Poste"}</th>
                  <th className="px-4 py-2">{lang === "en" ? "Start" : "Début"}</th>
                  <th className="px-4 py-2">{lang === "en" ? "End" : "Fin"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((c) => (
                  <tr key={c.id} className={c.status === "ACTIF" ? "bg-green-50/50" : ""}>
                    <td className="px-4 py-2 font-medium">
                      {lang === "en"
                        ? CONTRACT_TYPE_LABELS[c.type]?.en ?? c.type
                        : CONTRACT_TYPE_LABELS[c.type]?.fr ?? c.type}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_STATUS_LABELS[c.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
                        {lang === "en"
                          ? CONTRACT_STATUS_LABELS[c.status]?.en
                          : CONTRACT_STATUS_LABELS[c.status]?.fr}
                      </span>
                    </td>
                    <td className="px-4 py-2">{c.jobTitle}</td>
                    <td className="px-4 py-2">{formatDate(c.startDate, lang)}</td>
                    <td className="px-4 py-2">{c.endDate ? formatDate(c.endDate, lang) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared UI helpers ───

function SectionTitle({ icon: Icon, label }: { icon: typeof User; label: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pt-2">
      <Icon className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
    </div>
  );
}

function ReadonlyField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function FormField({
  label,
  type = "text",
  register,
  error,
}: {
  label: string;
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        {...register}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function FormSelect({
  label,
  register,
  options,
  error,
}: {
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        {...register}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
