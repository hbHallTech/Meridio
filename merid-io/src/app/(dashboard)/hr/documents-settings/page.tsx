"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import {
  Loader2,
  Settings,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Save,
  LayoutTemplate,
  Plug,
  ToggleLeft,
  Star,
  Mail,
  Play,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ─── Types ───

interface CompanyConfig {
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

type TabId = "params" | "templates" | "integration";

// ─── Toggle component ───

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? "bg-[#1B3A5C]" : "bg-gray-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// ─── Page Component ───

export default function DocumentsSettingsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  const [activeTab, setActiveTab] = useState<TabId>("params");
  const [loading, setLoading] = useState(true);

  // ─── Parameters tab state ───
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [paramsSaving, setParamsSaving] = useState(false);

  // ─── Templates tab state ───
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Template form
  const [tplName, setTplName] = useState("");
  const [tplType, setTplType] = useState<string>("FICHE_PAIE");
  const [tplSubject, setTplSubject] = useState("");
  const [tplContent, setTplContent] = useState("");
  const [tplVariables, setTplVariables] = useState<string[]>([]);
  const [tplIsActive, setTplIsActive] = useState(true);
  const [tplIsDefault, setTplIsDefault] = useState(false);

  // ─── Integration tab state ───
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [docsImapPass, setDocsImapPass] = useState("");
  const [importRunning, setImportRunning] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    processed: number;
    created: number;
    errors: string[];
  } | null>(null);

  // ─── Fetch company config ───
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/company");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setConfig({
            id: data.id,
            documentsModuleEnabled: data.documentsModuleEnabled ?? false,
            documentsAiEnabled: data.documentsAiEnabled ?? false,
            documentsNotifyEmail: data.documentsNotifyEmail ?? null,
            documentsWebhookUrl: data.documentsWebhookUrl ?? null,
            documentsWebhookSecret: data.documentsWebhookSecret ?? null,
            documentsWebhookEnabled: data.documentsWebhookEnabled ?? false,
            docsImapHost: data.docsImapHost ?? null,
            docsImapPort: data.docsImapPort ?? 993,
            docsImapUser: data.docsImapUser ?? null,
            docsImapSecure: data.docsImapSecure ?? true,
            docsImapPassConfigured: data.docsImapPassConfigured ?? false,
          });
        }
      }
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Error loading config" : "Erreur de chargement",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, lang]);

  // ─── Fetch templates ───
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/admin/templates");
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Error loading templates" : "Erreur de chargement des templates",
      });
    } finally {
      setTemplatesLoading(false);
    }
  }, [addToast, lang]);

  useEffect(() => {
    fetchConfig();
    fetchTemplates();
  }, [fetchConfig, fetchTemplates]);

  // ─── Save params ───
  const handleSaveParams = async () => {
    if (!config) return;
    setParamsSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: config.id,
          tab: "documents",
          documentsModuleEnabled: config.documentsModuleEnabled,
          documentsAiEnabled: config.documentsAiEnabled,
        }),
      });
      if (res.ok) {
        addToast({
          type: "success",
          title: lang === "en" ? "Settings saved" : "Paramètres enregistrés",
          message: lang === "en" ? "Your changes have been saved successfully." : "Vos modifications ont été enregistrées avec succès.",
        });
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Network error" : "Erreur réseau",
      });
    } finally {
      setParamsSaving(false);
    }
  };

  // ─── Save integration ───
  const handleSaveIntegration = async () => {
    if (!config) return;
    setIntegrationSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: config.id,
          tab: "documents",
          documentsNotifyEmail: config.documentsNotifyEmail,
          documentsWebhookUrl: config.documentsWebhookUrl,
          documentsWebhookSecret: config.documentsWebhookSecret,
          documentsWebhookEnabled: config.documentsWebhookEnabled,
          docsImapHost: config.docsImapHost,
          docsImapPort: config.docsImapPort,
          docsImapUser: config.docsImapUser,
          docsImapSecure: config.docsImapSecure,
          ...(docsImapPass ? { docsImapPass } : {}),
        }),
      });
      if (res.ok) {
        // Update local state: mark password as configured if one was sent
        if (docsImapPass) {
          setConfig((prev) => prev ? { ...prev, docsImapPassConfigured: true } : prev);
          setDocsImapPass("");
        }
        addToast({
          type: "success",
          title: lang === "en" ? "Integration saved" : "Intégration enregistrée",
          message: lang === "en" ? "Your changes have been saved successfully." : "Vos modifications ont été enregistrées avec succès.",
        });
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Network error" : "Erreur réseau",
      });
    } finally {
      setIntegrationSaving(false);
    }
  };

  // ─── Manual email import trigger ───
  const handleManualImport = async () => {
    setImportRunning(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/import-documents", { method: "POST" });

      // Handle non-JSON responses (Vercel timeout page, server crash, etc.)
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server error (${res.status})`);
      }

      const data = await res.json();
      setImportResult({
        success: data.success ?? false,
        processed: data.processed ?? 0,
        created: data.created ?? 0,
        errors: data.errors ?? [],
      });
      if (data.success && data.created > 0) {
        addToast({
          type: "success",
          title: lang === "en"
            ? `${data.created} document(s) imported`
            : `${data.created} document(s) importé(s)`,
        });
      } else if (data.success && data.created === 0) {
        addToast({
          type: "info",
          title: lang === "en" ? "No new documents found" : "Aucun nouveau document trouvé",
        });
      } else {
        addToast({
          type: "error",
          title: data.error || (lang === "en" ? "Import failed" : "Échec de l'import"),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      addToast({
        type: "error",
        title: message.includes("Server error")
          ? (lang === "en" ? message : `Erreur serveur — vérifiez les paramètres IMAP`)
          : (lang === "en" ? "Network error" : "Erreur réseau"),
      });
    } finally {
      setImportRunning(false);
    }
  };

  // ─── Template CRUD ───
  const resetTemplateForm = () => {
    setTplName("");
    setTplType("FICHE_PAIE");
    setTplSubject("");
    setTplContent("");
    setTplVariables([]);
    setTplIsActive(true);
    setTplIsDefault(false);
  };

  const openCreate = () => {
    resetTemplateForm();
    setCreateOpen(true);
  };

  const openEditTemplate = (tpl: TemplateItem) => {
    setSelectedTemplate(tpl);
    setTplName(tpl.name);
    setTplType(tpl.type);
    setTplSubject(tpl.subject ?? "");
    setTplContent(tpl.content);
    setTplVariables(tpl.variables);
    setTplIsActive(tpl.isActive);
    setTplIsDefault(tpl.isDefault);
    setEditOpen(true);
  };

  const handleCreateTemplate = async () => {
    if (!tplName || !tplContent) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tplName,
          type: tplType,
          subject: tplSubject || undefined,
          content: tplContent,
          variables: tplVariables,
          isActive: tplIsActive,
          isDefault: tplIsDefault,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({
        type: "success",
        title: lang === "en" ? "Template created" : "Template créé",
      });
      setCreateOpen(false);
      resetTemplateForm();
      fetchTemplates();
    } catch (err) {
      addToast({
        type: "error",
        title: err instanceof Error ? err.message : "Erreur",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTemplate = async () => {
    if (!selectedTemplate || !tplName || !tplContent) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTemplate.id,
          name: tplName,
          type: tplType,
          subject: tplSubject || null,
          content: tplContent,
          variables: tplVariables,
          isActive: tplIsActive,
          isDefault: tplIsDefault,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({
        type: "success",
        title: lang === "en" ? "Template updated" : "Template mis à jour",
      });
      setEditOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (err) {
      addToast({
        type: "error",
        title: err instanceof Error ? err.message : "Erreur",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteTemplate = (tpl: TemplateItem) => {
    setSelectedTemplate(tpl);
    setDeleteOpen(true);
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedTemplate.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({
        type: "success",
        title: lang === "en" ? "Template deleted" : "Template supprimé",
      });
      setDeleteOpen(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (err) {
      addToast({
        type: "error",
        title: err instanceof Error ? err.message : "Erreur",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleVariable = (key: string) => {
    setTplVariables((prev) =>
      prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key]
    );
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
      id: "params",
      label: lang === "en" ? "Parameters" : "Paramètres",
      icon: ToggleLeft,
    },
    {
      id: "templates",
      label: "Templates",
      icon: LayoutTemplate,
    },
    {
      id: "integration",
      label: lang === "en" ? "Integration" : "Intégration",
      icon: Plug,
    },
  ];

  // ─── Template form component (shared between create/edit) ───
  const TemplateFormFields = () => (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {lang === "en" ? "Template Name" : "Nom du template"} *
        </label>
        <input
          type="text"
          value={tplName}
          onChange={(e) => setTplName(e.target.value)}
          placeholder={lang === "en" ? "e.g., Standard Payslip" : "ex. Fiche de paie standard"}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
        />
      </div>

      {/* Type + Subject row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {lang === "en" ? "Document Type" : "Type de document"} *
          </label>
          <select
            value={tplType}
            onChange={(e) => setTplType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {lang === "en" ? DOC_TYPE_CONFIG[t].en : DOC_TYPE_CONFIG[t].fr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {lang === "en" ? "Subject (optional)" : "Sujet (optionnel)"}
          </label>
          <input
            type="text"
            value={tplSubject}
            onChange={(e) => setTplSubject(e.target.value)}
            placeholder={lang === "en" ? "Email subject" : "Sujet d'email"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
          />
        </div>
      </div>

      {/* Variables */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {lang === "en" ? "Available Variables" : "Variables disponibles"}
        </label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_VARIABLES.map((v) => {
            const selected = tplVariables.includes(v.key);
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => toggleVariable(v.key)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-[#1B3A5C] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <code className="font-mono">{`{{${v.key}}}`}</code>
                <span className="text-[10px] opacity-70">{lang === "en" ? v.en : v.fr}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content (HTML editor area) */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {lang === "en" ? "Content (HTML)" : "Contenu (HTML)"} *
        </label>
        <textarea
          value={tplContent}
          onChange={(e) => setTplContent(e.target.value)}
          rows={12}
          placeholder={lang === "en" ? "Enter HTML content..." : "Saisissez le contenu HTML..."}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#1B3A5C] focus:outline-none"
          spellCheck={false}
        />
        <p className="mt-1 text-xs text-gray-400">
          {lang === "en"
            ? "Use {{variable_name}} syntax for dynamic values"
            : "Utilisez la syntaxe {{nom_variable}} pour les valeurs dynamiques"}
        </p>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap items-center gap-6">
        <Toggle
          checked={tplIsActive}
          onChange={setTplIsActive}
          label={lang === "en" ? "Active" : "Actif"}
        />
        <Toggle
          checked={tplIsDefault}
          onChange={setTplIsDefault}
          label={lang === "en" ? "Default template" : "Template par défaut"}
          description={
            lang === "en"
              ? "Used automatically for this document type"
              : "Utilisé automatiquement pour ce type de document"
          }
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Documents Module Settings" : "Configuration du module Documents"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? "Manage parameters, templates, and integrations"
              : "Gérer les paramètres, templates et intégrations"}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
        >
          <Settings className="h-5 w-5" style={{ color: "#00BCD4" }} />
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white text-[#1B3A5C] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              aria-selected={isActive}
              role="tab"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ Parameters Tab ═══ */}
      {activeTab === "params" && config && (
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-5">
            <Toggle
              checked={config.documentsModuleEnabled}
              onChange={(v) => setConfig({ ...config, documentsModuleEnabled: v })}
              label={lang === "en" ? "Enable Documents Module" : "Activer le module Documents"}
              description={
                lang === "en"
                  ? "When disabled, employees cannot access their documents"
                  : "Lorsque désactivé, les employés ne peuvent pas accéder à leurs documents"
              }
            />

            <div className="border-t border-gray-100 pt-5">
              <Toggle
                checked={config.documentsAiEnabled}
                onChange={(v) => setConfig({ ...config, documentsAiEnabled: v })}
                label={lang === "en" ? "Enable AI Document Processing" : "Activer l'IA Documents"}
                description={
                  lang === "en"
                    ? "Use AI to automatically classify and extract metadata from uploaded documents"
                    : "Utiliser l'IA pour classifier automatiquement et extraire les métadonnées des documents téléversés"
                }
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              onClick={handleSaveParams}
              disabled={paramsSaving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {paramsSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {lang === "en" ? "Save" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Templates Tab ═══ */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {templates.length} template{templates.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#1B3A5C" }}
            >
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
                {lang === "en"
                  ? "No templates yet. Create your first template."
                  : "Aucun template. Créez votre premier template."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => {
                const typeConf = DOC_TYPE_CONFIG[tpl.type] ?? {
                  fr: tpl.type,
                  en: tpl.type,
                  color: "#6B7280",
                };
                return (
                  <div
                    key={tpl.id}
                    className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: typeConf.color }}
                        />
                        <h3 className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">
                          {tpl.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {tpl.isDefault && (
                          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                        )}
                        {!tpl.isActive && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            {lang === "en" ? "Inactive" : "Inactif"}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Type label */}
                    <p className="mt-1 text-xs text-gray-400">
                      {lang === "en" ? typeConf.en : typeConf.fr}
                    </p>
                    {/* Content preview */}
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                      <pre className="max-h-20 overflow-hidden text-[11px] text-gray-500 whitespace-pre-wrap font-mono leading-relaxed">
                        {tpl.content.slice(0, 200)}
                        {tpl.content.length > 200 ? "..." : ""}
                      </pre>
                    </div>
                    {/* Variables */}
                    {tpl.variables.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {tpl.variables.map((v) => (
                          <span
                            key={v}
                            className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono text-blue-600"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Actions */}
                    <div className="mt-3 flex items-center justify-end gap-1 border-t border-gray-100 pt-3">
                      <button
                        onClick={() => openEditTemplate(tpl)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                        title={lang === "en" ? "Edit" : "Modifier"}
                        aria-label={`${lang === "en" ? "Edit" : "Modifier"} ${tpl.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openDeleteTemplate(tpl)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title={lang === "en" ? "Delete" : "Supprimer"}
                        aria-label={`${lang === "en" ? "Delete" : "Supprimer"} ${tpl.name}`}
                      >
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

      {/* ═══ Integration Tab ═══ */}
      {activeTab === "integration" && config && (
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Email import section */}
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

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-4">
              <h4 className="text-xs font-semibold text-gray-600">
                {lang === "en" ? "IMAP Configuration" : "Configuration IMAP"}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {lang === "en" ? "IMAP Host" : "Hôte IMAP"}
                  </label>
                  <input
                    type="text"
                    value={config.docsImapHost ?? ""}
                    onChange={(e) => setConfig({ ...config, docsImapHost: e.target.value || null })}
                    placeholder="imap.gmail.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {lang === "en" ? "Port" : "Port"}
                  </label>
                  <input
                    type="number"
                    value={config.docsImapPort ?? 993}
                    onChange={(e) => setConfig({ ...config, docsImapPort: parseInt(e.target.value) || 993 })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {lang === "en" ? "Username / Email" : "Utilisateur / Email"}
                  </label>
                  <input
                    type="text"
                    value={config.docsImapUser ?? ""}
                    onChange={(e) => setConfig({ ...config, docsImapUser: e.target.value || null })}
                    placeholder="documents@company.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {lang === "en" ? "Password" : "Mot de passe"}
                  </label>
                  <input
                    type="password"
                    value={docsImapPass}
                    onChange={(e) => setDocsImapPass(e.target.value)}
                    placeholder={config.docsImapPassConfigured
                      ? (lang === "en" ? "••••••• (configured)" : "••••••• (configuré)")
                      : (lang === "en" ? "Enter password" : "Saisir le mot de passe")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
                  />
                  {config.docsImapPassConfigured && !docsImapPass && (
                    <p className="mt-1 text-xs text-emerald-600">
                      {lang === "en" ? "Password is configured. Leave empty to keep current." : "Mot de passe configuré. Laisser vide pour conserver l'actuel."}
                    </p>
                  )}
                </div>
              </div>
              <Toggle
                checked={config.docsImapSecure}
                onChange={(v) => setConfig({ ...config, docsImapSecure: v })}
                label={lang === "en" ? "SSL/TLS" : "SSL/TLS"}
                description={lang === "en" ? "Use secure connection (required for port 993)" : "Connexion sécurisée (obligatoire pour le port 993)"}
              />
              <p className="text-[11px] text-gray-400">
                {lang === "en"
                  ? "The cron job runs automatically every hour. You can also trigger it manually below."
                  : "Le cron s'exécute automatiquement toutes les heures. Vous pouvez aussi le déclencher manuellement ci-dessous."}
              </p>
            </div>

            {/* Manual import trigger */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleManualImport}
                disabled={importRunning}
                className="inline-flex items-center gap-2 rounded-lg border border-[#1B3A5C] px-4 py-2 text-sm font-medium text-[#1B3A5C] transition-colors hover:bg-[#1B3A5C]/5 disabled:opacity-50"
              >
                {importRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {lang === "en" ? "Run Import Now" : "Lancer l'import maintenant"}
              </button>
              {importResult && (
                <div className={`text-sm ${importResult.success ? "text-emerald-600" : "text-red-600"}`}>
                  <div className="flex items-center gap-2">
                    {importResult.success ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {importResult.success
                        ? lang === "en"
                          ? `${importResult.processed} processed, ${importResult.created} created`
                          : `${importResult.processed} traité(s), ${importResult.created} créé(s)`
                        : importResult.errors[0] || (lang === "en" ? "Import failed" : "Échec")}
                    </span>
                  </div>
                  {!importResult.success && importResult.errors.length > 1 && (
                    <ul className="mt-1 ml-6 list-disc text-xs text-red-500 space-y-0.5">
                      {importResult.errors.slice(1).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5" />

          {/* Notification email */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {lang === "en" ? "Document Notifications" : "Notifications documents"}
            </h3>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Notification Email" : "Email de notification"}
              </label>
              <input
                type="email"
                value={config.documentsNotifyEmail ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, documentsNotifyEmail: e.target.value || null })
                }
                placeholder={lang === "en" ? "hr@company.com" : "rh@entreprise.com"}
                className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">
                {lang === "en"
                  ? "Receives a notification when documents are uploaded or archived"
                  : "Reçoit une notification lorsque des documents sont téléversés ou archivés"}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {lang === "en" ? "ERP Webhook Integration" : "Intégration webhook ERP"}
            </h3>

            <div className="space-y-4">
              <Toggle
                checked={config.documentsWebhookEnabled}
                onChange={(v) => setConfig({ ...config, documentsWebhookEnabled: v })}
                label={lang === "en" ? "Enable Webhook" : "Activer le webhook"}
                description={
                  lang === "en"
                    ? "Send document events (create, update, delete) to an external system"
                    : "Envoyer les événements documents (création, modification, suppression) à un système externe"
                }
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {lang === "en" ? "Webhook URL" : "URL du webhook"}
                </label>
                <input
                  type="url"
                  value={config.documentsWebhookUrl ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, documentsWebhookUrl: e.target.value || null })
                  }
                  placeholder="https://erp.example.com/api/webhooks/documents"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#1B3A5C] focus:outline-none"
                  disabled={!config.documentsWebhookEnabled}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {lang === "en" ? "Webhook Secret (HMAC)" : "Secret webhook (HMAC)"}
                </label>
                <input
                  type="password"
                  value={config.documentsWebhookSecret ?? ""}
                  onChange={(e) =>
                    setConfig({ ...config, documentsWebhookSecret: e.target.value || null })
                  }
                  placeholder={lang === "en" ? "Secret key for signing" : "Clé secrète pour la signature"}
                  className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-[#1B3A5C] focus:outline-none"
                  disabled={!config.documentsWebhookEnabled}
                />
                <p className="mt-1 text-xs text-gray-400">
                  {lang === "en"
                    ? "Used to sign webhook payloads with HMAC-SHA256"
                    : "Utilisé pour signer les payloads du webhook avec HMAC-SHA256"}
                </p>
              </div>

              {config.documentsWebhookEnabled && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
                  <h4 className="text-xs font-semibold text-blue-700 mb-2">
                    {lang === "en" ? "Webhook Payload Format" : "Format du payload webhook"}
                  </h4>
                  <pre className="text-[11px] text-blue-600 font-mono whitespace-pre-wrap">
{`{
  "event": "document.created",
  "timestamp": "2026-02-22T10:30:00Z",
  "data": {
    "id": "...",
    "name": "Fiche_Paie_02-2026.pdf",
    "type": "FICHE_PAIE",
    "userId": "...",
    "metadata": { "mois": "02", "annee": "2026" }
  }
}`}
                  </pre>
                  <p className="mt-2 text-[11px] text-blue-500">
                    {lang === "en"
                      ? "Events: document.created, document.updated, document.deleted, document.archived"
                      : "Événements : document.created, document.updated, document.deleted, document.archived"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-100 pt-4">
            <button
              onClick={handleSaveIntegration}
              disabled={integrationSaving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {integrationSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {lang === "en" ? "Save" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Create Template Dialog ═══ */}
      <Dialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetTemplateForm();
        }}
        title={lang === "en" ? "New Template" : "Nouveau template"}
        maxWidth="lg"
      >
        <TemplateFormFields />
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setCreateOpen(false);
              resetTemplateForm();
            }}
            disabled={submitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {lang === "en" ? "Cancel" : "Annuler"}
          </button>
          <button
            onClick={handleCreateTemplate}
            disabled={submitting || !tplName || !tplContent}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {lang === "en" ? "Create" : "Créer"}
          </button>
        </div>
      </Dialog>

      {/* ═══ Edit Template Dialog ═══ */}
      <Dialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedTemplate(null);
        }}
        title={lang === "en" ? "Edit Template" : "Modifier le template"}
        description={selectedTemplate?.name}
        maxWidth="lg"
      >
        <TemplateFormFields />
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setEditOpen(false);
              setSelectedTemplate(null);
            }}
            disabled={submitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {lang === "en" ? "Cancel" : "Annuler"}
          </button>
          <button
            onClick={handleEditTemplate}
            disabled={submitting || !tplName || !tplContent}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {lang === "en" ? "Save" : "Enregistrer"}
          </button>
        </div>
      </Dialog>

      {/* ═══ Delete Confirm ═══ */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedTemplate(null);
        }}
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
        loading={submitting}
      />
    </div>
  );
}
