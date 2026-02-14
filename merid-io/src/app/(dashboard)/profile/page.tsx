"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validators";
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
} from "lucide-react";

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

const ROLE_LABELS: Record<string, { fr: string; en: string }> = {
  EMPLOYEE: { fr: "Employé", en: "Employee" },
  MANAGER: { fr: "Manager", en: "Manager" },
  HR: { fr: "Ressources Humaines", en: "Human Resources" },
  ADMIN: { fr: "Administrateur", en: "Administrator" },
};

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

function formatDate(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const watchNewPwd = watch("newPassword");
  const pwdChecks = getPasswordChecks(watchNewPwd || "");

  // Wait for client mount (for next-themes)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch profile - refetch on pathname change
  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setProfile(d.user);
          setBalances(d.balances);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pathname]);

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
      reset();
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
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {lang === "en" ? "My Profile" : "Mon profil"}
      </h1>

      {/* ─── Profile info section ─── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Avatar + name header */}
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
                  className="text-2xl font-bold text-white"
                  style={{ backgroundColor: "#1B3A5C", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}
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

          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {profile.firstName} {profile.lastName}
            </h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
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
        </div>

        {/* Info rows */}
        <div className="divide-y divide-gray-100">
          <InfoRow
            icon={Mail}
            label={lang === "en" ? "Email" : "Email"}
            value={profile.email}
          />
          <InfoRow
            icon={Building2}
            label={lang === "en" ? "Office" : "Bureau"}
            value={`${profile.office.name} — ${profile.office.city}, ${profile.office.country}`}
          />
          <InfoRow
            icon={Users}
            label={lang === "en" ? "Team" : "Équipe"}
            value={profile.team?.name ?? (lang === "en" ? "No team" : "Aucune équipe")}
          />
          <InfoRow
            icon={CalendarDays}
            label={lang === "en" ? "Hire date" : "Date d'embauche"}
            value={formatDate(profile.hireDate, lang)}
          />

          {/* Language selector */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {lang === "en" ? "Language" : "Langue"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleLanguageChange("fr")}
                disabled={langSaving}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  profile.language === "fr"
                    ? "bg-[#1B3A5C] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Français
              </button>
              <button
                onClick={() => handleLanguageChange("en")}
                disabled={langSaving}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  profile.language === "en"
                    ? "bg-[#1B3A5C] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                English
              </button>
              {langSaving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </div>
          </div>

          {/* Theme selector */}
          {mounted && (
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <Sun className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {lang === "en" ? "Theme" : "Thème"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleThemeChange(opt.value)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        active
                          ? "bg-[#1B3A5C] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {lang === "en" ? opt.label_en : opt.label_fr}
                    </button>
                  );
                })}
              </div>
            </div>
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

        <form onSubmit={handleSubmit(onPasswordSubmit)} className="mt-5 space-y-4">
          {/* Current password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Current password" : "Mot de passe actuel"}
            </label>
            <div className="relative">
              <input
                type={showCurrentPwd ? "text" : "password"}
                {...register("currentPassword")}
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
            {errors.currentPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.currentPassword.message}</p>
            )}
          </div>

          {/* New password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "New password" : "Nouveau mot de passe"}
            </label>
            <div className="relative">
              <input
                type={showNewPwd ? "text" : "password"}
                {...register("newPassword")}
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
            {errors.newPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>
            )}

            {/* Real-time password checks */}
            {watchNewPwd && (
              <div className="mt-2 space-y-1">
                {pwdChecks.map((check) => (
                  <div key={check.key} className="flex items-center gap-2">
                    {check.ok ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-gray-300" />
                    )}
                    <span
                      className={`text-xs ${
                        check.ok ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {lang === "en" ? check.label_en : check.label_fr}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Confirm new password" : "Confirmer le nouveau mot de passe"}
            </label>
            <input
              type="password"
              {...register("confirmPassword")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
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
                <div
                  key={b.balanceType}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <p className="text-sm font-medium text-gray-500">
                    {lang === "en" ? meta.en : meta.fr}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {b.remaining}
                    <span className="ml-1 text-sm font-normal text-gray-400">
                      / {totalPool}j
                    </span>
                  </p>

                  {/* Stacked progress bar */}
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
    </div>
  );
}

// ─── Info row sub-component ───

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
