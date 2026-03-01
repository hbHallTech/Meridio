"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Loader2, Building, Save, Upload, Trash2, Globe, Mail, Lock,
  Bell, Settings, Send, MapPin, Users, Phone, CheckCircle2, XCircle,
  FileText, Plus, Pencil, LayoutTemplate, Plug, ToggleLeft, Star,
  Play, AlertCircle,
} from "lucide-react";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
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
  csvSeparator: string;
  emailLogoUrl: string | null;
  privacyPolicyUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { offices: number };
  offices: OfficeData[];
  notificationSettings: NotifSetting[];
}

interface DocsConfig {
  id: string;
  documentsModuleEnabled: boolean;
  documentsAiEnabled: boolean;
  documentsNotifyEmail: string | null;
  documentsWebhookUrl: string | null;
  documentsWebhookSecret: string | null;
  documentsWebhookEnabled: boolean;
  docsImapHost: string | null;
  docsImapPort: number | null;
  docsImapUser: string | null;
  docsImapSecure: boolean;
  docsImapPassConfigured: boolean;
}

interface TemplateItem {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  content: string;
  variables: string[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ───

const DOC_TYPES = [
  "FICHE_PAIE",
  "ATTESTATION_TRAVAIL",
  "CERTIFICAT_TRAVAIL",
  "CONTRAT",
  "AUTRE",
] as const;

const DOC_TYPE_CONFIG: Record<string, { fr: string; en: string; color: string }> = {
  FICHE_PAIE: { fr: "Fiche de paie", en: "Payslip", color: "#3B82F6" },
  ATTESTATION_TRAVAIL: { fr: "Attestation de travail", en: "Work Certificate", color: "#8B5CF6" },
  CERTIFICAT_TRAVAIL: { fr: "Certificat de travail", en: "Employment Certificate", color: "#06B6D4" },
  CONTRAT: { fr: "Contrat", en: "Contract", color: "#F59E0B" },
  AUTRE: { fr: "Autre", en: "Other", color: "#6B7280" },
};

const AVAILABLE_VARIABLES = [
  { key: "employee_name", fr: "Nom employé", en: "Employee name" },
  { key: "employee_email", fr: "Email employé", en: "Employee email" },
  { key: "employee_id", fr: "ID employé", en: "Employee ID" },
  { key: "company_name", fr: "Nom entreprise", en: "Company name" },
  { key: "month", fr: "Mois", en: "Month" },
  { key: "year", fr: "Année", en: "Year" },
  { key: "date", fr: "Date", en: "Date" },
  { key: "document_type", fr: "Type document", en: "Document type" },
];

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
  { id: "documents", icon: FileText, fr: "Documents", en: "Documents" },
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
  const searchParams = useSearchParams();
  const lang = session?.user?.language ?? "fr";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emailLogoInputRef = useRef<HTMLInputElement>(null);

  // Support ?tab=documents for redirect from old URL
  const initialTab = ((): TabId => {
    const tabParam = searchParams.get("tab");
    if (tabParam && TABS.some((t) => t.id === tabParam)) return tabParam as TabId;
    return "info";
  })();

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

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
    csvSeparator: ",",
  });
  const [emailLogoPreview, setEmailLogoPreview] = useState<string | null>(null);

  // ── Form state (tab: documents) ──
  const [docsConfig, setDocsConfig] = useState<DocsConfig | null>(null);
  const [docsParamsSaving, setDocsParamsSaving] = useState(false);
  const [docsIntegrationSaving, setDocsIntegrationSaving] = useState(false);
  const [docsImapPass, setDocsImapPass] = useState("");
  const [docsImportRunning, setDocsImportRunning] = useState(false);
  const [docsImportResult, setDocsImportResult] = useState<{
    success: boolean; processed: number; created: number; errors: string[];
  } | null>(null);
  const [docsSubTab, setDocsSubTab] = useState<"params" | "templates" | "integration">("params");

  // Templates
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [tplCreateOpen, setTplCreateOpen] = useState(false);
  const [tplEditOpen, setTplEditOpen] = useState(false);
  const [tplDeleteOpen, setTplDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [tplSubmitting, setTplSubmitting] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplType, setTplType] = useState<string>("FICHE_PAIE");
  const [tplSubject, setTplSubject] = useState("");
  const [tplContent, setTplContent] = useState("");
  const [tplVariables, setTplVariables] = useState<string[]>([]);
  const [tplIsActive, setTplIsActive] = useState(true);
  const [tplIsDefault, setTplIsDefault] = useState(false);

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
        csvSeparator: data.csvSeparator || ",",
      });
      setEmailLogoPreview(data.emailLogoUrl);

      // Documents config
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      setDocsConfig({
        id: data.id,
        documentsModuleEnabled: d.documentsModuleEnabled ?? false,
        documentsAiEnabled: d.documentsAiEnabled ?? false,
        documentsNotifyEmail: d.documentsNotifyEmail ?? null,
        documentsWebhookUrl: d.documentsWebhookUrl ?? null,
        documentsWebhookSecret: d.documentsWebhookSecret ?? null,
        documentsWebhookEnabled: d.documentsWebhookEnabled ?? false,
        docsImapHost: d.docsImapHost ?? null,
        docsImapPort: d.docsImapPort ?? 993,
        docsImapUser: d.docsImapUser ?? null,
        docsImapSecure: d.docsImapSecure ?? true,
        docsImapPassConfigured: d.docsImapPassConfigured ?? false,
      });
    } catch (e) {
      addToast({ type: "error", title: lang === "en" ? "Load error" : "Erreur de chargement", message: e instanceof Error ? e.message : "" });
    }
  }, [addToast, lang]);

  // ─── Fetch templates ───
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/admin/templates");
      if (res.ok) setTemplates(await res.json());
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error loading templates" : "Erreur de chargement des templates" });
    } finally {
      setTemplatesLoading(false);
    }
  }, [addToast, lang]);

  useEffect(() => {
    fetchCompany().finally(() => setLoading(false));
    fetchTemplates();
  }, [fetchCompany, fetchTemplates, pathname]);

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

  // ─── Documents tab: Save params ───
  const handleDocsSaveParams = async () => {
    if (!docsConfig) return;
    setDocsParamsSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: docsConfig.id, tab: "documents",
          documentsModuleEnabled: docsConfig.documentsModuleEnabled,
          documentsAiEnabled: docsConfig.documentsAiEnabled,
        }),
      });
      if (res.ok) {
        addToast({ type: "success", title: lang === "en" ? "Settings saved" : "Paramètres enregistrés" });
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setDocsParamsSaving(false);
    }
  };

  // ─── Documents tab: Save integration ───
  const handleDocsSaveIntegration = async () => {
    if (!docsConfig) return;
    setDocsIntegrationSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: docsConfig.id, tab: "documents",
          documentsNotifyEmail: docsConfig.documentsNotifyEmail,
          documentsWebhookUrl: docsConfig.documentsWebhookUrl,
          documentsWebhookSecret: docsConfig.documentsWebhookSecret,
          documentsWebhookEnabled: docsConfig.documentsWebhookEnabled,
          docsImapHost: docsConfig.docsImapHost,
          docsImapPort: docsConfig.docsImapPort,
          docsImapUser: docsConfig.docsImapUser,
          docsImapSecure: docsConfig.docsImapSecure,
          ...(docsImapPass ? { docsImapPass } : {}),
        }),
      });
      if (res.ok) {
        if (docsImapPass) {
          setDocsConfig((prev) => prev ? { ...prev, docsImapPassConfigured: true } : prev);
          setDocsImapPass("");
        }
        addToast({ type: "success", title: lang === "en" ? "Integration saved" : "Intégration enregistrée" });
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setDocsIntegrationSaving(false);
    }
  };

  // ─── Documents tab: Manual import ───
  const handleDocsManualImport = async () => {
    setDocsImportRunning(true);
    setDocsImportResult(null);
    try {
      const res = await fetch("/api/admin/import-documents", { method: "POST" });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setDocsImportResult({
        success: data.success ?? false, processed: data.processed ?? 0,
        created: data.created ?? 0, errors: data.errors ?? [],
      });
      if (data.success && data.created > 0) {
        addToast({ type: "success", title: lang === "en" ? `${data.created} document(s) imported` : `${data.created} document(s) importé(s)` });
      } else if (data.success && data.created === 0) {
        addToast({ type: "info", title: lang === "en" ? "No new documents found" : "Aucun nouveau document trouvé" });
      } else {
        addToast({ type: "error", title: data.error || (lang === "en" ? "Import failed" : "Échec de l'import") });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      addToast({
        type: "error",
        title: message.includes("Server error")
          ? (lang === "en" ? message : "Erreur serveur — vérifiez les paramètres IMAP")
          : (lang === "en" ? "Network error" : "Erreur réseau"),
      });
    } finally {
      setDocsImportRunning(false);
    }
  };

  // ─── Template CRUD ───
  const resetTemplateForm = () => {
    setTplName(""); setTplType("FICHE_PAIE"); setTplSubject("");
    setTplContent(""); setTplVariables([]); setTplIsActive(true); setTplIsDefault(false);
  };

  const openCreateTemplate = () => { resetTemplateForm(); setTplCreateOpen(true); };

  const openEditTemplate = (tpl: TemplateItem) => {
    setSelectedTemplate(tpl);
    setTplName(tpl.name); setTplType(tpl.type); setTplSubject(tpl.subject || "");
    setTplContent(tpl.content); setTplVariables([...tpl.variables]);
    setTplIsActive(tpl.isActive); setTplIsDefault(tpl.isDefault);
    setTplEditOpen(true);
  };

  const handleCreateTemplate = async () => {
    if (!tplName || !tplContent) return;
    setTplSubmitting(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tplName, type: tplType, subject: tplSubject || null, content: tplContent, variables: tplVariables, isActive: tplIsActive, isDefault: tplIsDefault }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erreur"); }
      addToast({ type: "success", title: lang === "en" ? "Template created" : "Template créé" });
      setTplCreateOpen(false); resetTemplateForm(); fetchTemplates();
    } catch (err) {
      addToast({ type: "error", title: err instanceof Error ? err.message : "Erreur" });
    } finally { setTplSubmitting(false); }
  };

  const handleEditTemplate = async () => {
    if (!selectedTemplate || !tplName || !tplContent) return;
    setTplSubmitting(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTemplate.id, name: tplName, type: tplType, subject: tplSubject || null, content: tplContent, variables: tplVariables, isActive: tplIsActive, isDefault: tplIsDefault }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erreur"); }
      addToast({ type: "success", title: lang === "en" ? "Template updated" : "Template mis à jour" });
      setTplEditOpen(false); setSelectedTemplate(null); fetchTemplates();
    } catch (err) {
      addToast({ type: "error", title: err instanceof Error ? err.message : "Erreur" });
    } finally { setTplSubmitting(false); }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    setTplSubmitting(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTemplate.id }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erreur"); }
      addToast({ type: "success", title: lang === "en" ? "Template deleted" : "Template supprimé" });
      setTplDeleteOpen(false); setSelectedTemplate(null); fetchTemplates();
    } catch (err) {
      addToast({ type: "error", title: err instanceof Error ? err.message : "Erreur" });
    } finally { setTplSubmitting(false); }
  };

  const toggleVariable = (key: string) => {
    setTplVariables((prev) => prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]);
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

        {/* ═══ Documents Tab ═══ */}
        {activeTab === "documents" && docsConfig && (
          <TabDocuments
            config={docsConfig} setConfig={setDocsConfig}
            lang={lang}
            subTab={docsSubTab} setSubTab={setDocsSubTab}
            paramsSaving={docsParamsSaving} handleSaveParams={handleDocsSaveParams}
            integrationSaving={docsIntegrationSaving} handleSaveIntegration={handleDocsSaveIntegration}
            docsImapPass={docsImapPass} setDocsImapPass={setDocsImapPass}
            importRunning={docsImportRunning} handleManualImport={handleDocsManualImport}
            importResult={docsImportResult}
            templates={templates} templatesLoading={templatesLoading}
            openCreate={openCreateTemplate} openEdit={openEditTemplate}
            openDelete={(tpl: TemplateItem) => { setSelectedTemplate(tpl); setTplDeleteOpen(true); }}
          />
        )}

        {/* Save button (not for documents tab - it has its own) */}
        {activeTab !== "documents" && (
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
        )}
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

      {/* ═══ Template Create Dialog ═══ */}
      <Dialog
        open={tplCreateOpen}
        onClose={() => { setTplCreateOpen(false); resetTemplateForm(); }}
        title={lang === "en" ? "New Template" : "Nouveau template"}
        maxWidth="lg"
      >
        <TemplateFormFields
          lang={lang} tplName={tplName} setTplName={setTplName}
          tplType={tplType} setTplType={setTplType}
          tplSubject={tplSubject} setTplSubject={setTplSubject}
          tplContent={tplContent} setTplContent={setTplContent}
          tplVariables={tplVariables} toggleVariable={toggleVariable}
          tplIsActive={tplIsActive} setTplIsActive={setTplIsActive}
          tplIsDefault={tplIsDefault} setTplIsDefault={setTplIsDefault}
        />
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => { setTplCreateOpen(false); resetTemplateForm(); }} disabled={tplSubmitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {lang === "en" ? "Cancel" : "Annuler"}
          </button>
          <button onClick={handleCreateTemplate} disabled={tplSubmitting || !tplName || !tplContent}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}>
            {tplSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {lang === "en" ? "Create" : "Créer"}
          </button>
        </div>
      </Dialog>

      {/* ═══ Template Edit Dialog ═══ */}
      <Dialog
        open={tplEditOpen}
        onClose={() => { setTplEditOpen(false); setSelectedTemplate(null); }}
        title={lang === "en" ? "Edit Template" : "Modifier le template"}
        description={selectedTemplate?.name}
        maxWidth="lg"
      >
        <TemplateFormFields
          lang={lang} tplName={tplName} setTplName={setTplName}
          tplType={tplType} setTplType={setTplType}
          tplSubject={tplSubject} setTplSubject={setTplSubject}
          tplContent={tplContent} setTplContent={setTplContent}
          tplVariables={tplVariables} toggleVariable={toggleVariable}
          tplIsActive={tplIsActive} setTplIsActive={setTplIsActive}
          tplIsDefault={tplIsDefault} setTplIsDefault={setTplIsDefault}
        />
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => { setTplEditOpen(false); setSelectedTemplate(null); }} disabled={tplSubmitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            {lang === "en" ? "Cancel" : "Annuler"}
          </button>
          <button onClick={handleEditTemplate} disabled={tplSubmitting || !tplName || !tplContent}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}>
            {tplSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {lang === "en" ? "Save" : "Enregistrer"}
          </button>
        </div>
      </Dialog>

      {/* ═══ Template Delete Confirm ═══ */}
      <ConfirmDialog
        open={tplDeleteOpen}
        onClose={() => { setTplDeleteOpen(false); setSelectedTemplate(null); }}
        onConfirm={handleDeleteTemplate}
        title={lang === "en" ? "Delete Template" : "Supprimer le template"}
        message={
          selectedTemplate
            ? lang === "en"
              ? `Are you sure you want to delete "${selectedTemplate.name}"?`
              : `Êtes-vous sûr de vouloir supprimer "${selectedTemplate.name}" ?`
            : ""
        }
        confirmLabel={lang === "en" ? "Delete" : "Supprimer"}
        loading={tplSubmitting}
      />
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

function TabInfo({ form, setForm, logoPreview, fileInputRef, handleLogoUpload, handleRemoveLogo, uploadingLogo, company, lang }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  form: { enforce2FA: boolean; inactivityTimeoutMin: number; auditRetentionDays: number; trialModeEnabled: boolean; privacyPolicyUrl: string; csvSeparator: string };
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

      {/* CSV separator */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {lang === "en" ? "CSV export separator" : "Séparateur exports CSV"}
        </label>
        <select
          value={form.csvSeparator}
          onChange={(e) => upd("csvSeparator", e.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
        >
          <option value=",">{lang === "en" ? "Comma (,)" : "Virgule (,)"}</option>
          <option value=";">{lang === "en" ? "Semicolon (;)" : "Point-virgule (;)"}</option>
          <option value="|">{lang === "en" ? "Pipe (|)" : "Pipe (|)"}</option>
          <option value={"\t"}>{lang === "en" ? "Tab (\\t)" : "Tabulation (\\t)"}</option>
        </select>
        <p className="text-xs text-gray-400">
          {lang === "en"
            ? "Field separator for all CSV exports (affects opening in Excel/Google Sheets). Default: comma."
            : "Séparateur de champ pour tous les exports CSV (impacte l'ouverture dans Excel/Google Sheets). Par défaut : virgule."}
        </p>
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

// ─── Template Form Fields (shared between create/edit) ───

function TemplateFormFields({ lang, tplName, setTplName, tplType, setTplType, tplSubject, setTplSubject, tplContent, setTplContent, tplVariables, toggleVariable, tplIsActive, setTplIsActive, tplIsDefault, setTplIsDefault }: {
  lang: string;
  tplName: string; setTplName: (v: string) => void;
  tplType: string; setTplType: (v: string) => void;
  tplSubject: string; setTplSubject: (v: string) => void;
  tplContent: string; setTplContent: (v: string) => void;
  tplVariables: string[]; toggleVariable: (key: string) => void;
  tplIsActive: boolean; setTplIsActive: (v: boolean) => void;
  tplIsDefault: boolean; setTplIsDefault: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {lang === "en" ? "Template Name" : "Nom du template"} *
        </label>
        <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)}
          placeholder={lang === "en" ? "e.g., Standard Payslip" : "ex. Fiche de paie standard"}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {lang === "en" ? "Document Type" : "Type de document"} *
          </label>
          <select value={tplType} onChange={(e) => setTplType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none">
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{lang === "en" ? DOC_TYPE_CONFIG[t].en : DOC_TYPE_CONFIG[t].fr}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {lang === "en" ? "Subject (optional)" : "Sujet (optionnel)"}
          </label>
          <input type="text" value={tplSubject} onChange={(e) => setTplSubject(e.target.value)}
            placeholder={lang === "en" ? "Email subject" : "Sujet d'email"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {lang === "en" ? "Available Variables" : "Variables disponibles"}
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_VARIABLES.map((v) => {
            const selected = tplVariables.includes(v.key);
            return (
              <button key={v.key} type="button" onClick={() => toggleVariable(v.key)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected ? "bg-[#1B3A5C] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                <code className="font-mono">{`{{${v.key}}}`}</code>
                <span className="text-[10px] opacity-70">{lang === "en" ? v.en : v.fr}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {lang === "en" ? "Content (HTML)" : "Contenu (HTML)"} *
        </label>
        <textarea value={tplContent} onChange={(e) => setTplContent(e.target.value)} rows={12}
          placeholder={lang === "en" ? "Enter HTML content..." : "Saisissez le contenu HTML..."}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#1B3A5C] focus:outline-none"
          spellCheck={false} />
        <p className="mt-1 text-xs text-gray-400">
          {lang === "en" ? "Use {{variable_name}} syntax for dynamic values" : "Utilisez la syntaxe {{nom_variable}} pour les valeurs dynamiques"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <DocToggle checked={tplIsActive} onChange={setTplIsActive} label={lang === "en" ? "Active" : "Actif"} />
        <DocToggle checked={tplIsDefault} onChange={setTplIsDefault}
          label={lang === "en" ? "Default template" : "Template par défaut"}
          description={lang === "en" ? "Used automatically for this document type" : "Utilisé automatiquement pour ce type de document"} />
      </div>
    </div>
  );
}

// ─── Toggle for documents section ───

function DocToggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? "bg-[#1B3A5C]" : "bg-gray-200"
        }`}>
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`} />
      </button>
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// ─── TAB: Documents ───

function TabDocuments({ config, setConfig, lang, subTab, setSubTab, paramsSaving, handleSaveParams, integrationSaving, handleSaveIntegration, docsImapPass, setDocsImapPass, importRunning, handleManualImport, importResult, templates, templatesLoading, openCreate, openEdit, openDelete }: {
  config: DocsConfig; setConfig: (fn: DocsConfig | ((prev: DocsConfig | null) => DocsConfig | null)) => void;
  lang: string;
  subTab: "params" | "templates" | "integration"; setSubTab: (t: "params" | "templates" | "integration") => void;
  paramsSaving: boolean; handleSaveParams: () => void;
  integrationSaving: boolean; handleSaveIntegration: () => void;
  docsImapPass: string; setDocsImapPass: (v: string) => void;
  importRunning: boolean; handleManualImport: () => void;
  importResult: { success: boolean; processed: number; created: number; errors: string[] } | null;
  templates: TemplateItem[]; templatesLoading: boolean;
  openCreate: () => void; openEdit: (tpl: TemplateItem) => void; openDelete: (tpl: TemplateItem) => void;
}) {
  const subTabs: { id: "params" | "templates" | "integration"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "params", label: lang === "en" ? "Parameters" : "Paramètres", icon: ToggleLeft },
    { id: "templates", label: "Templates", icon: LayoutTemplate },
    { id: "integration", label: lang === "en" ? "Integration" : "Intégration", icon: Plug },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">{lang === "en" ? "Documents Module Settings" : "Configuration du module Documents"}</h3>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setSubTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-white text-[#1B3A5C] shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
              aria-selected={isActive} role="tab">
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Parameters sub-tab */}
      {subTab === "params" && (
        <div className="space-y-6 rounded-lg border border-gray-200 bg-gray-50/30 p-5">
          <DocToggle
            checked={config.documentsModuleEnabled}
            onChange={(v) => setConfig({ ...config, documentsModuleEnabled: v })}
            label={lang === "en" ? "Enable Documents Module" : "Activer le module Documents"}
            description={lang === "en" ? "When disabled, employees cannot access their documents" : "Lorsque désactivé, les employés ne peuvent pas accéder à leurs documents"}
          />
          <div className="border-t border-gray-100 pt-5">
            <DocToggle
              checked={config.documentsAiEnabled}
              onChange={(v) => setConfig({ ...config, documentsAiEnabled: v })}
              label={lang === "en" ? "Enable AI Document Processing" : "Activer l'IA Documents"}
              description={lang === "en" ? "Use AI to automatically classify and extract metadata from uploaded documents" : "Utiliser l'IA pour classifier automatiquement et extraire les métadonnées des documents téléversés"}
            />
          </div>
          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button onClick={handleSaveParams} disabled={paramsSaving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}>
              {paramsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {lang === "en" ? "Save" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* Templates sub-tab */}
      {subTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#1B3A5C" }}>
              <Plus className="h-4 w-4" />
              {lang === "en" ? "New Template" : "Nouveau template"}
            </button>
          </div>

          {templatesLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-16 text-center">
              <LayoutTemplate className="h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                {lang === "en" ? "No templates yet. Create your first template." : "Aucun template. Créez votre premier template."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => {
                const typeConf = DOC_TYPE_CONFIG[tpl.type] ?? { fr: tpl.type, en: tpl.type, color: "#6B7280" };
                return (
                  <div key={tpl.id} className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: typeConf.color }} />
                        <h3 className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">{tpl.name}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {tpl.isDefault && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />}
                        {!tpl.isActive && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            {lang === "en" ? "Inactive" : "Inactif"}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{lang === "en" ? typeConf.en : typeConf.fr}</p>
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                      <pre className="max-h-20 overflow-hidden text-[11px] text-gray-500 whitespace-pre-wrap font-mono leading-relaxed">
                        {tpl.content.slice(0, 200)}{tpl.content.length > 200 ? "..." : ""}
                      </pre>
                    </div>
                    {tpl.variables.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {tpl.variables.map((v) => (
                          <span key={v} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono text-blue-600">{`{{${v}}}`}</span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-end gap-1 border-t border-gray-100 pt-3">
                      <button onClick={() => openEdit(tpl)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                        title={lang === "en" ? "Edit" : "Modifier"} aria-label={`${lang === "en" ? "Edit" : "Modifier"} ${tpl.name}`}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => openDelete(tpl)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title={lang === "en" ? "Delete" : "Supprimer"} aria-label={`${lang === "en" ? "Delete" : "Supprimer"} ${tpl.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Integration sub-tab */}
      {subTab === "integration" && (
        <div className="space-y-6 rounded-lg border border-gray-200 bg-gray-50/30 p-5">
          {/* IMAP Configuration */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {lang === "en" ? "Automatic Email Import" : "Import automatique par e-mail"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {lang === "en"
                ? "The system polls an IMAP mailbox every hour for emails with PDF attachments. Documents are automatically created using OCR text extraction."
                : "Le système interroge une boîte IMAP toutes les heures pour les e-mails avec pièces jointes PDF. Les documents sont créés automatiquement via extraction OCR."}
            </p>

            <div className="rounded-lg bg-white border border-gray-200 p-4 space-y-4">
              <h4 className="text-xs font-semibold text-gray-600">{lang === "en" ? "IMAP Configuration" : "Configuration IMAP"}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{lang === "en" ? "IMAP Host" : "Hôte IMAP"}</label>
                  <input type="text" value={config.docsImapHost ?? ""} onChange={(e) => setConfig({ ...config, docsImapHost: e.target.value || null })}
                    placeholder="imap.gmail.com" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Port</label>
                  <input type="number" value={config.docsImapPort ?? 993} onChange={(e) => setConfig({ ...config, docsImapPort: parseInt(e.target.value) || 993 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{lang === "en" ? "Username / Email" : "Utilisateur / Email"}</label>
                  <input type="text" value={config.docsImapUser ?? ""} onChange={(e) => setConfig({ ...config, docsImapUser: e.target.value || null })}
                    placeholder="documents@company.com" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{lang === "en" ? "Password" : "Mot de passe"}</label>
                  <input type="password" value={docsImapPass} onChange={(e) => setDocsImapPass(e.target.value)}
                    placeholder={config.docsImapPassConfigured ? (lang === "en" ? "••••••• (configured)" : "••••••• (configuré)") : (lang === "en" ? "Enter password" : "Saisir le mot de passe")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none" />
                  {config.docsImapPassConfigured && !docsImapPass && (
                    <p className="mt-1 text-xs text-emerald-600">
                      {lang === "en" ? "Password is configured. Leave empty to keep current." : "Mot de passe configuré. Laisser vide pour conserver l'actuel."}
                    </p>
                  )}
                </div>
              </div>
              <DocToggle checked={config.docsImapSecure} onChange={(v) => setConfig({ ...config, docsImapSecure: v })}
                label="SSL/TLS" description={lang === "en" ? "Use secure connection (required for port 993)" : "Connexion sécurisée (obligatoire pour le port 993)"} />
              <p className="text-[11px] text-gray-400">
                {lang === "en" ? "The cron job runs automatically every hour. You can also trigger it manually below." : "Le cron s'exécute automatiquement toutes les heures. Vous pouvez aussi le déclencher manuellement ci-dessous."}
              </p>
            </div>

            {/* Manual import trigger */}
            <div className="mt-4 flex items-center gap-3">
              <button onClick={handleManualImport} disabled={importRunning}
                className="inline-flex items-center gap-2 rounded-lg border border-[#1B3A5C] px-4 py-2 text-sm font-medium text-[#1B3A5C] transition-colors hover:bg-[#1B3A5C]/5 disabled:opacity-50">
                {importRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {lang === "en" ? "Run Import Now" : "Lancer l'import maintenant"}
              </button>
              {importResult && (
                <div className={`text-sm ${importResult.success ? "text-emerald-600" : "text-red-600"}`}>
                  <div className="flex items-center gap-2">
                    {importResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span>
                      {importResult.success
                        ? lang === "en" ? `${importResult.processed} processed, ${importResult.created} created` : `${importResult.processed} traité(s), ${importResult.created} créé(s)`
                        : importResult.errors[0] || (lang === "en" ? "Import failed" : "Échec")}
                    </span>
                  </div>
                  {!importResult.success && importResult.errors.length > 1 && (
                    <ul className="mt-1 ml-6 list-disc text-xs text-red-500 space-y-0.5">
                      {importResult.errors.slice(1).map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5" />

          {/* Notification email */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{lang === "en" ? "Document Notifications" : "Notifications documents"}</h3>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{lang === "en" ? "Notification Email" : "Email de notification"}</label>
              <input type="email" value={config.documentsNotifyEmail ?? ""}
                onChange={(e) => setConfig({ ...config, documentsNotifyEmail: e.target.value || null })}
                placeholder={lang === "en" ? "hr@company.com" : "rh@entreprise.com"}
                className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none" />
              <p className="mt-1 text-xs text-gray-400">
                {lang === "en" ? "Receives a notification when documents are uploaded or archived" : "Reçoit une notification lorsque des documents sont téléversés ou archivés"}
              </p>
            </div>
          </div>

          {/* Webhook */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{lang === "en" ? "ERP Webhook Integration" : "Intégration webhook ERP"}</h3>
            <div className="space-y-4">
              <DocToggle checked={config.documentsWebhookEnabled}
                onChange={(v) => setConfig({ ...config, documentsWebhookEnabled: v })}
                label={lang === "en" ? "Enable Webhook" : "Activer le webhook"}
                description={lang === "en" ? "Send document events to an external system" : "Envoyer les événements documents à un système externe"} />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{lang === "en" ? "Webhook URL" : "URL du webhook"}</label>
                <input type="url" value={config.documentsWebhookUrl ?? ""}
                  onChange={(e) => setConfig({ ...config, documentsWebhookUrl: e.target.value || null })}
                  placeholder="https://erp.example.com/api/webhooks/documents"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#1B3A5C] focus:outline-none"
                  disabled={!config.documentsWebhookEnabled} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{lang === "en" ? "Webhook Secret (HMAC)" : "Secret webhook (HMAC)"}</label>
                <input type="password" value={config.documentsWebhookSecret ?? ""}
                  onChange={(e) => setConfig({ ...config, documentsWebhookSecret: e.target.value || null })}
                  placeholder={lang === "en" ? "Secret key for signing" : "Clé secrète pour la signature"}
                  className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#1B3A5C] focus:outline-none"
                  disabled={!config.documentsWebhookEnabled} />
                <p className="mt-1 text-xs text-gray-400">
                  {lang === "en" ? "Used to sign webhook payloads with HMAC-SHA256" : "Utilisé pour signer les payloads du webhook avec HMAC-SHA256"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button onClick={handleSaveIntegration} disabled={integrationSaving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}>
              {integrationSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {lang === "en" ? "Save" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
