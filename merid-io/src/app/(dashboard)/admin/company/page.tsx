"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2, Building, Save, Upload, Trash2, Globe, Mail, Lock,
  Bell, Settings, Send, MapPin, Users, Phone, CheckCircle2, XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";

// ─── Types ───


interface OfficeData {
  id: string;
  name: string;
  country: string;
  city: string;
  _count: { users: number };
}

interface NotifSetting {
  id?: string;
  type: string;
  enabled: boolean;
}

interface CompanyData {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  legalForm: string | null;
  contactLastName: string | null;
  contactFirstName: string | null;
  address: string | null;
  addressComplement: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  facebook: string | null;
  twitter: string | null;
  skype: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassConfigured: boolean;
  smtpFrom: string | null;
  pwdExpirationEnabled: boolean;
  pwdMaxAgeDays: number;
  pwdExpiryAlertDays: number;
  pwdMinLength: number;
  pwdRequireLowercase: boolean;
  pwdRequireUppercase: boolean;
  pwdRequireDigit: boolean;
  pwdRequireSpecial: boolean;
  pwdHistoryCount: number;
  pwdForceChangeOnFirst: boolean;
  pwdCheckDictionary: boolean;
  enforce2FA: boolean;
  inactivityTimeoutMin: number;
  auditRetentionDays: number;
  trialModeEnabled: boolean;
  emailLogoUrl: string | null;
  privacyPolicyUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { offices: number };
  offices: OfficeData[];
  notificationSettings: NotifSetting[];
}

// ─── Constants ───

const LEGAL_FORMS = ["SA", "SARL", "Sàrl", "SNC", "Association", "Fondation", "Raison individuelle", "Coopérative", "Autre"];

const COUNTRIES = [
  { code: "CH", label: "Suisse" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Allemagne" },
  { code: "IT", label: "Italie" },
  { code: "BE", label: "Belgique" },
  { code: "LU", label: "Luxembourg" },
  { code: "TN", label: "Tunisie" },
  { code: "MA", label: "Maroc" },
  { code: "OTHER", label: "Autre" },
];

const NOTIFICATION_TYPES = [
  { type: "NEW_REQUEST", fr: "Nouvelle demande de congé", en: "New leave request" },
  { type: "APPROVED", fr: "Demande approuvée", en: "Request approved" },
  { type: "REFUSED", fr: "Demande refusée", en: "Request refused" },
  { type: "RETURNED", fr: "Demande renvoyée", en: "Request returned" },
  { type: "REMINDER", fr: "Rappel de traitement", en: "Processing reminder" },
  { type: "PASSWORD_EXPIRING", fr: "Expiration mot de passe", en: "Password expiring" },
  { type: "PASSWORD_CHANGED", fr: "Mot de passe modifié", en: "Password changed" },
  { type: "NEW_LOGIN", fr: "Nouvelle connexion détectée", en: "New login detected" },
  { type: "ACCOUNT_LOCKED", fr: "Compte verrouillé", en: "Account locked" },
  { type: "CLOSURE", fr: "Fermeture entreprise", en: "Company closure" },
];

const TABS = [
  { id: "info", icon: Building, fr: "Informations", en: "Information" },
  { id: "smtp", icon: Mail, fr: "Email (SMTP)", en: "Email (SMTP)" },
  { id: "password", icon: Lock, fr: "Mots de passe", en: "Passwords" },
  { id: "notifications", icon: Bell, fr: "Notifications", en: "Notifications" },
  { id: "advanced", icon: Settings, fr: "Avancé", en: "Advanced" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Component ───

export default function AdminCompanyPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const pathname = usePathname();
  const lang = session?.user?.language ?? "fr";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailLogoInputRef = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("info");

  // ── Form state (tab 1: info) ──
  const [infoForm, setInfoForm] = useState({
    name: "", legalForm: "", contactLastName: "", contactFirstName: "",
    address: "", addressComplement: "", postalCode: "", city: "", country: "CH",
    email: "", phone: "", mobile: "", fax: "", websiteUrl: "",
    facebook: "", twitter: "", skype: "",
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // ── Form state (tab 2: smtp) ──
  const [smtpForm, setSmtpForm] = useState({
    smtpHost: "", smtpPort: "587", smtpSecure: false,
    smtpUser: "", smtpPass: "", smtpFrom: "",
  });
  const [smtpPassConfigured, setSmtpPassConfigured] = useState(false);

  // ── Form state (tab 3: password) ──
  const [pwdForm, setPwdForm] = useState({
    pwdExpirationEnabled: true, pwdMaxAgeDays: 90, pwdExpiryAlertDays: 5,
    pwdMinLength: 12, pwdRequireLowercase: true, pwdRequireUppercase: true,
    pwdRequireDigit: true, pwdRequireSpecial: true, pwdHistoryCount: 5,
    pwdForceChangeOnFirst: true, pwdCheckDictionary: false,
  });

  // ── Form state (tab 4: notifications) ──
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({});

  // ── Form state (tab 5: advanced) ──
  const [advForm, setAdvForm] = useState({
    enforce2FA: false, inactivityTimeoutMin: 30,
    auditRetentionDays: 365, trialModeEnabled: false, privacyPolicyUrl: "",
  });
  const [emailLogoPreview, setEmailLogoPreview] = useState<string | null>(null);

  // ─── Fetch ───
  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/company", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CompanyData | null = await res.json();
      if (!data) { setCompany(null); return; }
      setCompany(data);

      // Populate forms
      setInfoForm({
        name: data.name || "", legalForm: data.legalForm || "",
        contactLastName: data.contactLastName || "", contactFirstName: data.contactFirstName || "",
        address: data.address || "", addressComplement: data.addressComplement || "",
        postalCode: data.postalCode || "", city: data.city || "", country: data.country || "CH",
        email: data.email || "", phone: data.phone || "", mobile: data.mobile || "",
        fax: data.fax || "", websiteUrl: data.websiteUrl || "",
        facebook: data.facebook || "", twitter: data.twitter || "", skype: data.skype || "",
      });
      setLogoPreview(data.logoUrl);

      setSmtpForm({
        smtpHost: data.smtpHost || "", smtpPort: String(data.smtpPort || 587),
        smtpSecure: data.smtpSecure, smtpUser: data.smtpUser || "",
        smtpPass: "", smtpFrom: data.smtpFrom || "",
      });
      setSmtpPassConfigured(data.smtpPassConfigured);

      setPwdForm({
        pwdExpirationEnabled: data.pwdExpirationEnabled,
        pwdMaxAgeDays: data.pwdMaxAgeDays, pwdExpiryAlertDays: data.pwdExpiryAlertDays,
        pwdMinLength: data.pwdMinLength, pwdRequireLowercase: data.pwdRequireLowercase,
        pwdRequireUppercase: data.pwdRequireUppercase, pwdRequireDigit: data.pwdRequireDigit,
        pwdRequireSpecial: data.pwdRequireSpecial, pwdHistoryCount: data.pwdHistoryCount,
        pwdForceChangeOnFirst: data.pwdForceChangeOnFirst, pwdCheckDictionary: data.pwdCheckDictionary,
      });

      const ns: Record<string, boolean> = {};
      for (const nt of NOTIFICATION_TYPES) {
        const found = data.notificationSettings.find((s) => s.type === nt.type);
        ns[nt.type] = found ? found.enabled : true;
      }
      setNotifSettings(ns);

      setAdvForm({
        enforce2FA: data.enforce2FA, inactivityTimeoutMin: data.inactivityTimeoutMin,
        auditRetentionDays: data.auditRetentionDays, trialModeEnabled: data.trialModeEnabled,
        privacyPolicyUrl: data.privacyPolicyUrl || "",
      });
      setEmailLogoPreview(data.emailLogoUrl);
    } catch (e) {
      addToast({ type: "error", title: lang === "en" ? "Load error" : "Erreur de chargement", message: e instanceof Error ? e.message : "" });
    }
  }, [addToast, lang]);

  useEffect(() => {
    fetchCompany().finally(() => setLoading(false));
  }, [fetchCompany, pathname]);

  // ─── Logo upload ───
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "logo" | "emailLogo") => {
    const file = e.target.files?.[0];
    if (!file || !company) return;
    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: "error", title: "Erreur", message: "Max 2Mo" });
      return;
    }
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      addToast({ type: "error", title: "Erreur", message: "Format invalide (JPG/PNG/WebP/SVG)" });
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      formData.append("companyId", company.id);
      const res = await fetch("/api/admin/company/logo", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload error");
      const data = await res.json();
      if (field === "logo") {
        setLogoPreview(data.logoUrl);
        setCompany((p) => p ? { ...p, logoUrl: data.logoUrl } : p);
      } else {
        setEmailLogoPreview(data.logoUrl);
        // Save emailLogoUrl via PATCH
        await fetch("/api/admin/company", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: company.id, tab: "advanced", emailLogoUrl: data.logoUrl }),
        });
      }
      addToast({ type: "success", title: lang === "en" ? "Logo updated" : "Logo mis à jour" });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Upload error" : "Erreur d'upload" });
    } finally {
      setUploadingLogo(false);
      if (field === "logo" && fileInputRef.current) fileInputRef.current.value = "";
      if (field === "emailLogo" && emailLogoInputRef.current) emailLogoInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    if (!company) return;
    setSaving(true);
    try {
      await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: company.id, logoUrl: "" }),
      });
      setLogoPreview(null);
      setCompany((p) => p ? { ...p, logoUrl: null } : p);
      addToast({ type: "success", title: lang === "en" ? "Logo removed" : "Logo supprimé" });
    } catch {
      addToast({ type: "error", title: "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Tab save handlers ───
  const handleSaveTab = async () => {
    if (!company) return;
    setSaving(true);

    let payload: Record<string, unknown> = { id: company.id, tab: activeTab };

    if (activeTab === "info") {
      if (!infoForm.name.trim()) {
        addToast({ type: "error", title: "Erreur", message: lang === "en" ? "Company name is required" : "Le nom est requis" });
        setSaving(false);
        return;
      }
      payload = { ...payload, ...infoForm };
    } else if (activeTab === "smtp") {
      payload = { ...payload, ...smtpForm, smtpPort: Number(smtpForm.smtpPort) || 587 };
    } else if (activeTab === "password") {
      payload = { ...payload, ...pwdForm };
    } else if (activeTab === "notifications") {
      payload = {
        ...payload,
        settings: NOTIFICATION_TYPES.map((nt) => ({
          type: nt.type,
          enabled: notifSettings[nt.type] ?? true,
        })),
      };
    } else if (activeTab === "advanced") {
      payload = { ...payload, ...advForm };
    }

    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save error");
      const updated = await res.json();
      if (updated) setCompany(updated);
      addToast({ type: "success", title: lang === "en" ? "Saved" : "Enregistré" });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Save error" : "Erreur de sauvegarde" });
    } finally {
      setSaving(false);
    }
  };

  // ─── SMTP test ───
  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    try {
      const res = await fetch("/api/admin/company/smtp-test", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: "success", title: lang === "en" ? "SMTP OK" : "SMTP OK", message: data.message });
      } else {
        addToast({ type: "error", title: lang === "en" ? "SMTP Failed" : "SMTP Échoué", message: data.error });
      }
    } catch {
      addToast({ type: "error", title: "Erreur SMTP" });
    } finally {
      setTestingSmtp(false);
    }
  };

  // ─── Loading / Empty states ───
  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lang === "en" ? "Company Settings" : "Paramètres entreprise"}</h1>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(27,58,92,0.1)" }}>
            <Building className="h-5 w-5" style={{ color: "#1B3A5C" }} />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          {lang === "en" ? "No company configured." : "Aucune entreprise configurée."}
        </div>
      </div>
    );
  }

  // ─── Render ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === "en" ? "Company Settings" : "Paramètres entreprise"}</h1>
          <p className="mt-1 text-sm text-gray-500">{lang === "en" ? "Advanced configuration" : "Configuration avancée"}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(27,58,92,0.1)" }}>
          <Building className="h-5 w-5" style={{ color: "#1B3A5C" }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-[#1B3A5C] text-[#1B3A5C]"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {lang === "en" ? tab.en : tab.fr}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {activeTab === "info" && (
          <TabInfo
            form={infoForm} setForm={setInfoForm}
            logoPreview={logoPreview} fileInputRef={fileInputRef}
            handleLogoUpload={handleLogoUpload} handleRemoveLogo={handleRemoveLogo}
            uploadingLogo={uploadingLogo} company={company} lang={lang}
          />
        )}

        {activeTab === "smtp" && (
          <TabSmtp
            form={smtpForm} setForm={setSmtpForm}
            smtpPassConfigured={smtpPassConfigured}
            testingSmtp={testingSmtp} handleTestSmtp={handleTestSmtp}
            lang={lang}
          />
        )}

        {activeTab === "password" && (
          <TabPassword form={pwdForm} setForm={setPwdForm} lang={lang} />
        )}

        {activeTab === "notifications" && (
          <TabNotifications settings={notifSettings} setSettings={setNotifSettings} lang={lang} />
        )}

        {activeTab === "advanced" && (
          <TabAdvanced
            form={advForm} setForm={setAdvForm}
            emailLogoPreview={emailLogoPreview}
            emailLogoInputRef={emailLogoInputRef}
            handleLogoUpload={handleLogoUpload}
            uploadingLogo={uploadingLogo}
            lang={lang}
          />
        )}

        {/* Save button */}
        <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
          <button
            onClick={handleSaveTab}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {lang === "en" ? "Save" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Offices section */}
      {company.offices.length > 0 && activeTab === "info" && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">{lang === "en" ? "Offices" : "Bureaux"}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {company.offices.map((office) => (
              <Link
                key={office.id}
                href="/admin/offices"
                className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(0,188,212,0.1)" }}>
                    <MapPin className="h-5 w-5" style={{ color: "#00BCD4" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{office.name}</p>
                    <p className="mt-0.5 text-sm text-gray-500">{office.city}, {office.country}</p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      <span>{office._count.users} {lang === "en" ? "users" : "utilisateurs"}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: styled input ───
function Input({ label, value, onChange, type = "text", required, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  required?: boolean; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4] disabled:bg-gray-100"
      />
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#00BCD4] peer-checked:after:translate-x-full peer-checked:after:border-white" />
      </label>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, suffix }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; suffix?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number" value={value} min={min} max={max}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── TAB 1: Information ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TabInfo({ form, setForm, logoPreview, fileInputRef, handleLogoUpload, handleRemoveLogo, uploadingLogo, company, lang }: {
  form: Record<string, string>; setForm: any;
  logoPreview: string | null; fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>, field: "logo" | "emailLogo") => void;
  handleRemoveLogo: () => void; uploadingLogo: boolean; company: CompanyData; lang: string;
}) {
  const upd = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      {/* Logo section */}
      <div className="flex items-start gap-5">
        <div className="relative">
          {logoPreview ? (
            <img src={logoPreview} alt={company.name} className="h-20 w-20 rounded-xl object-contain border border-gray-200 bg-white p-1" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl text-2xl font-bold text-white" style={{ backgroundColor: "#1B3A5C" }}>
              {company.name.charAt(0).toUpperCase()}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={(e) => handleLogoUpload(e, "logo")} className="hidden" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Logo</h3>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {logoPreview ? (lang === "en" ? "Change" : "Changer") : (lang === "en" ? "Upload" : "Ajouter")}
            </button>
            {logoPreview && (
              <button onClick={handleRemoveLogo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" />{lang === "en" ? "Remove" : "Supprimer"}
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-400">JPG, PNG, WebP, SVG. Max 2Mo.</p>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Company name + legal form */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label={lang === "en" ? "Company Name" : "Nom de la société"} value={form.name} onChange={(v) => upd("name", v)} required />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{lang === "en" ? "Legal Form" : "Forme juridique"}</label>
          <select value={form.legalForm} onChange={(e) => upd("legalForm", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]">
            <option value="">{lang === "en" ? "Select..." : "Sélectionner..."}</option>
            {LEGAL_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label={lang === "en" ? "Contact Last Name" : "Nom du contact"} value={form.contactLastName} onChange={(v) => upd("contactLastName", v)} />
        <Input label={lang === "en" ? "Contact First Name" : "Prénom du contact"} value={form.contactFirstName} onChange={(v) => upd("contactFirstName", v)} />
      </div>

      <hr className="border-gray-100" />

      {/* Address */}
      <h4 className="text-sm font-semibold text-gray-700">{lang === "en" ? "Address" : "Adresse"}</h4>
      <Input label={lang === "en" ? "Address" : "Adresse"} value={form.address} onChange={(v) => upd("address", v)} />
      <Input label={lang === "en" ? "Address line 2" : "Complément d'adresse"} value={form.addressComplement} onChange={(v) => upd("addressComplement", v)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input label="NPA" value={form.postalCode} onChange={(v) => upd("postalCode", v)} />
        <Input label={lang === "en" ? "City" : "Localité"} value={form.city} onChange={(v) => upd("city", v)} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{lang === "en" ? "Country" : "Pays"}</label>
          <select value={form.country} onChange={(e) => upd("country", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]">
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Contact details */}
      <h4 className="text-sm font-semibold text-gray-700">{lang === "en" ? "Contact Details" : "Coordonnées"}</h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Email" value={form.email} onChange={(v) => upd("email", v)} type="email" />
        <div className="relative">
          <Input label={lang === "en" ? "Phone" : "Téléphone"} value={form.phone} onChange={(v) => upd("phone", v)} type="tel" />
        </div>
        <Input label="Mobile" value={form.mobile} onChange={(v) => upd("mobile", v)} type="tel" />
        <Input label="Fax" value={form.fax} onChange={(v) => upd("fax", v)} type="tel" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="relative">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{lang === "en" ? "Website" : "Site web"}</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="url" value={form.websiteUrl} onChange={(e) => upd("websiteUrl", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]" />
          </div>
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Social */}
      <h4 className="text-sm font-semibold text-gray-700">{lang === "en" ? "Social Networks" : "Réseaux sociaux"}</h4>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input label="Facebook" value={form.facebook} onChange={(v) => upd("facebook", v)} placeholder="URL ou identifiant" />
        <Input label="Twitter / X" value={form.twitter} onChange={(v) => upd("twitter", v)} placeholder="@handle" />
        <Input label="Skype" value={form.skype} onChange={(v) => upd("skype", v)} placeholder="ID Skype" />
      </div>
    </div>
  );
}

// ─── TAB 2: SMTP ───

function TabSmtp({ form, setForm, smtpPassConfigured, testingSmtp, handleTestSmtp, lang }: {
  form: { smtpHost: string; smtpPort: string; smtpSecure: boolean; smtpUser: string; smtpPass: string; smtpFrom: string };
  setForm: (f: typeof form) => void;
  smtpPassConfigured: boolean; testingSmtp: boolean; handleTestSmtp: () => void; lang: string;
}) {
  const upd = (field: string, value: string | boolean) => setForm({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">{lang === "en" ? "SMTP Configuration" : "Configuration SMTP"}</h3>
      </div>

      <p className="text-sm text-gray-500">
        {lang === "en"
          ? "Configure the SMTP server for sending notification emails. Falls back to .env if not set."
          : "Configurez le serveur SMTP pour l'envoi des emails de notification. Fallback .env si non configuré."}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Host" value={form.smtpHost} onChange={(v) => upd("smtpHost", v)} placeholder="smtp.office365.com" />
        <Input label="Port" value={form.smtpPort} onChange={(v) => upd("smtpPort", v)} placeholder="587" />
      </div>

      <Toggle
        label={lang === "en" ? "Secure (SSL/TLS)" : "Sécurisé (SSL/TLS)"}
        description={lang === "en" ? "Enable for port 465 (SSL). Disable for port 587 (STARTTLS)." : "Activer pour le port 465 (SSL). Désactiver pour le port 587 (STARTTLS)."}
        checked={form.smtpSecure}
        onChange={(v) => upd("smtpSecure", v)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label={lang === "en" ? "Username" : "Utilisateur"} value={form.smtpUser} onChange={(v) => upd("smtpUser", v)} placeholder="noreply@company.ch" />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {lang === "en" ? "Password" : "Mot de passe"}
            {smtpPassConfigured && !form.smtpPass && (
              <span className="ml-2 text-xs text-green-600">({lang === "en" ? "configured" : "configuré"})</span>
            )}
          </label>
          <input
            type="password" value={form.smtpPass}
            onChange={(e) => upd("smtpPass", e.target.value)}
            placeholder={smtpPassConfigured ? "••••••••" : ""}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
          />
          <p className="mt-1 text-xs text-gray-400">{lang === "en" ? "Encrypted with AES-256-GCM" : "Chiffré avec AES-256-GCM"}</p>
        </div>
      </div>

      <Input
        label={lang === "en" ? "Sender address (From)" : "Adresse d'expédition (From)"}
        value={form.smtpFrom} onChange={(v) => upd("smtpFrom", v)}
        placeholder="noreply@company.ch" type="email"
      />

      <div className="pt-2">
        <button
          onClick={handleTestSmtp} disabled={testingSmtp}
          className="inline-flex items-center gap-2 rounded-lg border border-[#00BCD4] px-4 py-2 text-sm font-medium text-[#00BCD4] hover:bg-[#00BCD4]/5 disabled:opacity-50"
        >
          {testingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {lang === "en" ? "Test SMTP Connection" : "Tester la connexion SMTP"}
        </button>
      </div>
    </div>
  );
}

// ─── TAB 3: Password Policy ───

function TabPassword({ form, setForm, lang }: {
  form: {
    pwdExpirationEnabled: boolean; pwdMaxAgeDays: number; pwdExpiryAlertDays: number;
    pwdMinLength: number; pwdRequireLowercase: boolean; pwdRequireUppercase: boolean;
    pwdRequireDigit: boolean; pwdRequireSpecial: boolean; pwdHistoryCount: number;
    pwdForceChangeOnFirst: boolean; pwdCheckDictionary: boolean;
  };
  setForm: (f: typeof form) => void; lang: string;
}) {
  const upd = (field: string, value: boolean | number) => setForm({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Lock className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">{lang === "en" ? "Password Policy" : "Politique de mots de passe"}</h3>
      </div>

      {/* Expiration */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <Toggle
          label={lang === "en" ? "Enable password expiration" : "Activer l'expiration des mots de passe"}
          checked={form.pwdExpirationEnabled} onChange={(v) => upd("pwdExpirationEnabled", v)}
        />
        {form.pwdExpirationEnabled && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pl-4">
            <NumberInput label={lang === "en" ? "Max password age" : "Durée max"} value={form.pwdMaxAgeDays} onChange={(v) => upd("pwdMaxAgeDays", v)} min={1} max={365} suffix={lang === "en" ? "days" : "jours"} />
            <NumberInput label={lang === "en" ? "Alert before expiry" : "Alerte avant expiration"} value={form.pwdExpiryAlertDays} onChange={(v) => upd("pwdExpiryAlertDays", v)} min={1} max={30} suffix={lang === "en" ? "days" : "jours"} />
          </div>
        )}
      </div>

      {/* Min length */}
      <div className="rounded-lg border border-gray-200 p-4">
        <NumberInput label={lang === "en" ? "Minimum length" : "Longueur minimale"} value={form.pwdMinLength} onChange={(v) => upd("pwdMinLength", v)} min={8} max={128} suffix={lang === "en" ? "characters" : "caractères"} />
      </div>

      {/* Complexity */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-1">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">{lang === "en" ? "Complexity Requirements" : "Exigences de complexité"}</h4>
        <Toggle label={lang === "en" ? "Require lowercase letter" : "Exiger une minuscule"} checked={form.pwdRequireLowercase} onChange={(v) => upd("pwdRequireLowercase", v)} />
        <Toggle label={lang === "en" ? "Require uppercase letter" : "Exiger une majuscule"} checked={form.pwdRequireUppercase} onChange={(v) => upd("pwdRequireUppercase", v)} />
        <Toggle label={lang === "en" ? "Require digit" : "Exiger un chiffre"} checked={form.pwdRequireDigit} onChange={(v) => upd("pwdRequireDigit", v)} />
        <Toggle label={lang === "en" ? "Require special character" : "Exiger un caractère spécial"} checked={form.pwdRequireSpecial} onChange={(v) => upd("pwdRequireSpecial", v)} />
      </div>

      {/* History */}
      <div className="rounded-lg border border-gray-200 p-4">
        <NumberInput
          label={lang === "en" ? "Disallow last N passwords" : "Interdire les X derniers mots de passe"}
          value={form.pwdHistoryCount} onChange={(v) => upd("pwdHistoryCount", v)} min={0} max={24}
        />
      </div>

      {/* Other */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-1">
        <Toggle
          label={lang === "en" ? "Force password change on first login" : "Forcer le changement au premier login"}
          checked={form.pwdForceChangeOnFirst} onChange={(v) => upd("pwdForceChangeOnFirst", v)}
        />
        <Toggle
          label={lang === "en" ? "Check against dictionary / personal attributes" : "Vérification dictionnaire / attributs personnels"}
          description={lang === "en" ? "Optional: reject common passwords" : "Optionnel : rejeter les mots de passe courants"}
          checked={form.pwdCheckDictionary} onChange={(v) => upd("pwdCheckDictionary", v)}
        />
      </div>
    </div>
  );
}

// ─── TAB 4: Notifications ───

function TabNotifications({ settings, setSettings, lang }: {
  settings: Record<string, boolean>; setSettings: (s: Record<string, boolean>) => void; lang: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">{lang === "en" ? "Notification Settings" : "Paramètres de notifications"}</h3>
      </div>

      <p className="text-sm text-gray-500">
        {lang === "en"
          ? "Enable or disable notification types at the company level. Users can further opt-out in their profile."
          : "Activez ou désactivez les types de notifications au niveau entreprise. Les utilisateurs peuvent se désinscrire dans leur profil."}
      </p>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-6 py-3 text-left font-medium text-gray-500">{lang === "en" ? "Notification Type" : "Type de notification"}</th>
              <th className="px-6 py-3 text-center font-medium text-gray-500">{lang === "en" ? "Enabled" : "Actif"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {NOTIFICATION_TYPES.map((nt) => (
              <tr key={nt.type} className="hover:bg-gray-50/50">
                <td className="px-6 py-3.5">
                  <p className="font-medium text-gray-700">{lang === "en" ? nt.en : nt.fr}</p>
                  <p className="text-xs text-gray-400">{nt.type}</p>
                </td>
                <td className="px-6 py-3.5 text-center">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings[nt.type] ?? true}
                      onChange={(e) => setSettings({ ...settings, [nt.type]: e.target.checked })}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#00BCD4] peer-checked:after:translate-x-full peer-checked:after:border-white" />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB 5: Advanced ───

function TabAdvanced({ form, setForm, emailLogoPreview, emailLogoInputRef, handleLogoUpload, uploadingLogo, lang }: {
  form: { enforce2FA: boolean; inactivityTimeoutMin: number; auditRetentionDays: number; trialModeEnabled: boolean; privacyPolicyUrl: string };
  setForm: (f: typeof form) => void;
  emailLogoPreview: string | null;
  emailLogoInputRef: React.RefObject<HTMLInputElement | null>;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>, field: "logo" | "emailLogo") => void;
  uploadingLogo: boolean; lang: string;
}) {
  const upd = (field: string, value: boolean | number | string) => setForm({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">{lang === "en" ? "Advanced Settings" : "Paramètres avancés"}</h3>
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <Toggle
          label={lang === "en" ? "Mandatory 2FA for all users" : "2FA obligatoire pour tous les utilisateurs"}
          description={lang === "en" ? "Require two-factor authentication for every login" : "Exiger l'authentification à deux facteurs pour chaque connexion"}
          checked={form.enforce2FA} onChange={(v) => upd("enforce2FA", v)}
        />
      </div>

      <div className="rounded-lg border border-gray-200 p-4 space-y-4">
        <NumberInput
          label={lang === "en" ? "Inactivity timeout" : "Délai d'inactivité avant déconnexion"}
          value={form.inactivityTimeoutMin} onChange={(v) => upd("inactivityTimeoutMin", v)}
          min={5} max={480} suffix="minutes"
        />
        <NumberInput
          label={lang === "en" ? "Audit log retention" : "Rétention des logs d'audit"}
          value={form.auditRetentionDays} onChange={(v) => upd("auditRetentionDays", v)}
          min={30} max={3650} suffix={lang === "en" ? "days" : "jours"}
        />
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <Toggle
          label={lang === "en" ? "Trial mode" : "Mode période d'essai"}
          description={lang === "en" ? "Enable global trial mode for the company" : "Activer le mode « période d'essai » global"}
          checked={form.trialModeEnabled} onChange={(v) => upd("trialModeEnabled", v)}
        />
      </div>

      {/* Email logo */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">{lang === "en" ? "Email/PDF Logo" : "Logo emails/PDF"}</h4>
        <div className="flex items-center gap-4">
          {emailLogoPreview ? (
            <img src={emailLogoPreview} alt="Email logo" className="h-12 w-auto rounded border border-gray-200 bg-white p-1" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-gray-400 text-xs">
              {lang === "en" ? "None" : "Aucun"}
            </div>
          )}
          <button onClick={() => emailLogoInputRef.current?.click()} disabled={uploadingLogo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {lang === "en" ? "Upload" : "Choisir"}
          </button>
          <input ref={emailLogoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={(e) => handleLogoUpload(e, "emailLogo")} className="hidden" />
        </div>
      </div>

      {/* Privacy policy URL */}
      <div className="rounded-lg border border-gray-200 p-4">
        <Input
          label={lang === "en" ? "Privacy policy URL" : "Lien politique de confidentialité"}
          value={form.privacyPolicyUrl} onChange={(v) => upd("privacyPolicyUrl", v)}
          type="url" placeholder="https://..."
        />
      </div>
    </div>
  );
}
