"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import {
  Bell,
  Mail,
  Server,
  Shield,
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
  Send,
  Save,
} from "lucide-react";

interface Settings {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpFrom: string;
  hasPassword: boolean;
  notifyNewLeaveRequest: boolean;
  notifyLeaveApproved: boolean;
  notifyLeaveRejected: boolean;
  notifyLeaveNeedsRevision: boolean;
  notifyLeaveReminder: boolean;
  notifyAnnualClosure: boolean;
  notifyPasswordChanged: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface ToggleConfig {
  key: keyof Pick<
    Settings,
    | "notifyNewLeaveRequest"
    | "notifyLeaveApproved"
    | "notifyLeaveRejected"
    | "notifyLeaveNeedsRevision"
    | "notifyLeaveReminder"
    | "notifyAnnualClosure"
    | "notifyPasswordChanged"
  >;
  labelFr: string;
  labelEn: string;
  descFr: string;
  descEn: string;
  color: string;
}

const TOGGLES: ToggleConfig[] = [
  {
    key: "notifyNewLeaveRequest",
    labelFr: "Nouvelle demande de congé",
    labelEn: "New leave request",
    descFr: "Notifier l'approbateur lorsqu'une nouvelle demande est soumise",
    descEn: "Notify approver when a new request is submitted",
    color: "#3B82F6",
  },
  {
    key: "notifyLeaveApproved",
    labelFr: "Demande approuvée",
    labelEn: "Request approved",
    descFr: "Notifier l'employé lorsque sa demande est approuvée",
    descEn: "Notify employee when their request is approved",
    color: "#10B981",
  },
  {
    key: "notifyLeaveRejected",
    labelFr: "Demande refusée",
    labelEn: "Request rejected",
    descFr: "Notifier l'employé lorsque sa demande est refusée",
    descEn: "Notify employee when their request is rejected",
    color: "#EF4444",
  },
  {
    key: "notifyLeaveNeedsRevision",
    labelFr: "Demande renvoyée",
    labelEn: "Request returned",
    descFr: "Notifier l'employé lorsque sa demande nécessite des modifications",
    descEn: "Notify employee when their request needs revision",
    color: "#F59E0B",
  },
  {
    key: "notifyLeaveReminder",
    labelFr: "Rappel d'approbation",
    labelEn: "Approval reminder",
    descFr: "Envoyer un rappel aux approbateurs pour les demandes en attente (+48h)",
    descEn: "Send reminder to approvers for pending requests (+48h)",
    color: "#F97316",
  },
  {
    key: "notifyAnnualClosure",
    labelFr: "Fermeture annuelle",
    labelEn: "Annual closure",
    descFr: "Notifier les employés lors de la planification d'une fermeture",
    descEn: "Notify employees when a closure is scheduled",
    color: "#6366F1",
  },
  {
    key: "notifyPasswordChanged",
    labelFr: "Changement de mot de passe",
    labelEn: "Password changed",
    descFr: "Notifier l'utilisateur lorsque son mot de passe est modifié",
    descEn: "Notify user when their password is changed",
    color: "#6B7280",
  },
];

export default function NotificationSettingsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = (session?.user?.language ?? "fr") as "fr" | "en";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // SMTP form
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("no-reply@meridio.fr");
  const [hasPassword, setHasPassword] = useState(false);

  // Toggles
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    notifyNewLeaveRequest: true,
    notifyLeaveApproved: true,
    notifyLeaveRejected: true,
    notifyLeaveNeedsRevision: true,
    notifyLeaveReminder: true,
    notifyAnnualClosure: true,
    notifyPasswordChanged: true,
  });

  // Metadata
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notification-settings");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const s: Settings = data.settings;

      setSmtpHost(s.smtpHost);
      setSmtpPort(s.smtpPort);
      setSmtpSecure(s.smtpSecure);
      setSmtpUser(s.smtpUser);
      setSmtpFrom(s.smtpFrom);
      setHasPassword(s.hasPassword);
      setUpdatedAt(s.updatedAt);
      setUpdatedBy(s.updatedBy);

      setToggles({
        notifyNewLeaveRequest: s.notifyNewLeaveRequest,
        notifyLeaveApproved: s.notifyLeaveApproved,
        notifyLeaveRejected: s.notifyLeaveRejected,
        notifyLeaveNeedsRevision: s.notifyLeaveNeedsRevision,
        notifyLeaveReminder: s.notifyLeaveReminder,
        notifyAnnualClosure: s.notifyAnnualClosure,
        notifyPasswordChanged: s.notifyPasswordChanged,
      });
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Failed to load settings" : "Erreur de chargement",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, lang]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSaveSmtp() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpFrom,
      };
      // Only include password if user typed something
      if (smtpPassword) {
        payload.smtpPassword = smtpPassword;
      }

      const res = await fetch("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();

      setSmtpPassword("");
      setHasPassword(true);
      addToast({
        type: "success",
        title: lang === "en" ? "SMTP settings saved" : "Configuration SMTP enregistrée",
      });
      fetchSettings();
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Failed to save" : "Erreur lors de la sauvegarde",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const payload: Record<string, unknown> = {
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
      };
      if (smtpPassword) {
        payload.smtpPassword = smtpPassword;
      }

      const res = await fetch("/api/admin/notification-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast({
          type: "error",
          title: lang === "en" ? "Connection failed" : "Connexion échouée",
          message: data.error,
        });
        return;
      }

      addToast({
        type: "success",
        title: lang === "en" ? "Connection successful" : "Connexion réussie",
        message: data.message,
      });
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Connection test failed" : "Test de connexion échoué",
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleToggleChange(key: string, value: boolean) {
    setToggles((prev) => ({ ...prev, [key]: value }));

    try {
      const res = await fetch("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      if (!res.ok) throw new Error();

      addToast({
        type: "success",
        title: lang === "en" ? "Setting updated" : "Paramètre mis à jour",
      });
    } catch {
      // Revert on error
      setToggles((prev) => ({ ...prev, [key]: !value }));
      addToast({
        type: "error",
        title: lang === "en" ? "Failed to update" : "Erreur de mise à jour",
      });
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: "#1B3A5C" }}
        >
          <Bell className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Notification Settings" : "Paramètres des notifications"}
          </h1>
          <p className="text-sm text-gray-500">
            {lang === "en"
              ? "Configure email delivery and notification preferences"
              : "Configurer l'envoi d'emails et les préférences de notification"}
          </p>
        </div>
      </div>

      {updatedAt && (
        <p className="text-xs text-gray-400">
          {lang === "en" ? "Last updated" : "Dernière modification"} :{" "}
          {new Date(updatedAt).toLocaleString(lang === "en" ? "en-US" : "fr-FR")}
          {updatedBy && ` — ${lang === "en" ? "by" : "par"} ${updatedBy}`}
        </p>
      )}

      {/* ─── SMTP Configuration ─── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <Server className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "SMTP Configuration" : "Configuration SMTP"}
          </h2>
        </div>

        <div className="space-y-4 p-6">
          {/* Host + Port */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "SMTP Host" : "Hôte SMTP"}
              </label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.office365.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Port</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
            </div>
          </div>

          {/* User + Password */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Username" : "Utilisateur"}
              </label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Password" : "Mot de passe"}
                {hasPassword && !smtpPassword && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                    <Shield className="h-3 w-3" />
                    {lang === "en" ? "Stored (encrypted)" : "Enregistré (chiffré)"}
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={hasPassword ? "••••••••" : ""}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* From + Secure */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "From Address" : "Adresse expéditeur"}
              </label>
              <input
                type="text"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                placeholder="no-reply@meridio.fr"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
                />
                <span className="text-sm text-gray-700">
                  {lang === "en" ? "Use SSL/TLS" : "Utiliser SSL/TLS"}
                </span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <button
              onClick={handleSaveSmtp}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {lang === "en" ? "Save SMTP settings" : "Enregistrer la configuration"}
            </button>

            <button
              onClick={handleTestConnection}
              disabled={testing || !smtpHost || !smtpUser}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {lang === "en" ? "Test connection" : "Tester la connexion"}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Notification Toggles ─── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <Mail className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Notification Types" : "Types de notifications"}
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {TOGGLES.map((toggle) => {
            const enabled = toggles[toggle.key] ?? true;

            return (
              <div
                key={toggle.key}
                className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${toggle.color}15` }}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: toggle.color }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {lang === "en" ? toggle.labelEn : toggle.labelFr}
                    </p>
                    <p className="text-xs text-gray-500">
                      {lang === "en" ? toggle.descEn : toggle.descFr}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleChange(toggle.key, !enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enabled ? "bg-[#1B3A5C]" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Status summary */}
        <div className="border-t border-gray-100 px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            {Object.values(toggles).filter(Boolean).length} / {TOGGLES.length}{" "}
            {lang === "en" ? "notification types active" : "types de notifications actifs"}
          </div>
        </div>
      </div>
    </div>
  );
}
