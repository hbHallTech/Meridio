"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { leaveRequestSchema, type LeaveRequestInput } from "@/lib/validators";
import { useToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import {
  ArrowLeft,
  CalendarDays,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  Info,
  FileText,
  Send,
  Save,
} from "lucide-react";

// ---------- Types ----------

interface LeaveTypeOption {
  id: string;
  code: string;
  label_fr: string;
  label_en: string;
  color: string;
  requiresAttachment: boolean;
  attachmentFromDay: number | null;
  deductsFromBalance: boolean;
  balanceType: string | null;
}

interface ExceptionalRule {
  id: string;
  reason_fr: string;
  reason_en: string;
  maxDays: number;
}

interface OfficeConfig {
  minNoticeDays: number;
  sickLeaveJustifFromDay: number;
  workingDays: string[];
}

interface BalanceInfo {
  total: number;
  used: number;
  pending: number;
  remaining: number;
}

interface FormData {
  leaveTypes: LeaveTypeOption[];
  balances: Record<string, BalanceInfo>;
  exceptionalRules: ExceptionalRule[];
  publicHolidays: string[];
  officeConfig: OfficeConfig;
  probation: { endDate: string } | null;
}

// ---------- Helpers ----------

const DAY_MAP: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

function calculateDaysClient(
  startDate: string,
  endDate: string,
  startHalfDay: string,
  endHalfDay: string,
  workingDays: string[],
  publicHolidays: string[]
): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  const workingSet = new Set(workingDays.map((d) => DAY_MAP[d] ?? -1));
  const holidaySet = new Set(
    publicHolidays.map((h) => new Date(h).toISOString().split("T")[0])
  );

  let total = 0;
  const current = new Date(start);

  while (current <= end) {
    const dow = current.getDay();
    const ds = current.toISOString().split("T")[0];

    if (workingSet.has(dow) && !holidaySet.has(ds)) {
      if (current.getTime() === start.getTime() && current.getTime() === end.getTime()) {
        total += startHalfDay === "MORNING" || startHalfDay === "AFTERNOON" ? 0.5
          : endHalfDay === "MORNING" || endHalfDay === "AFTERNOON" ? 0.5
          : 1;
      } else if (current.getTime() === start.getTime()) {
        total += startHalfDay === "AFTERNOON" ? 0.5 : 1;
      } else if (current.getTime() === end.getTime()) {
        total += endHalfDay === "MORNING" ? 0.5 : 1;
      } else {
        total += 1;
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return total;
}

function formatDateLong(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const HALF_DAY_OPTIONS = [
  { value: "FULL_DAY", label_fr: "Journée complète", label_en: "Full day" },
  { value: "MORNING", label_fr: "Matin", label_en: "Morning" },
  { value: "AFTERNOON", label_fr: "Après-midi", label_en: "Afternoon" },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

// ---------- Component ----------

export default function NewLeavePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = useLocale();

  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LeaveRequestInput>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leaveTypeConfigId: "",
      startDate: "",
      endDate: "",
      startHalfDay: "FULL_DAY",
      endHalfDay: "FULL_DAY",
      reason: "",
      exceptionalReason: "",
    },
  });

  const watchLeaveType = watch("leaveTypeConfigId");
  const watchStartDate = watch("startDate");
  const watchEndDate = watch("endDate");
  const watchStartHalf = watch("startHalfDay");
  const watchEndHalf = watch("endHalfDay");
  const watchExceptionalReason = watch("exceptionalReason");

  // Fetch form data
  useEffect(() => {
    fetch("/api/leaves/form-data")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFormData(d))
      .catch(() => setFormData(null))
      .finally(() => setLoading(false));
  }, []);

  // Calculate days on change
  useEffect(() => {
    if (!formData || !watchStartDate || !watchEndDate) {
      setCalculatedDays(0);
      return;
    }
    const days = calculateDaysClient(
      watchStartDate,
      watchEndDate,
      watchStartHalf,
      watchEndHalf,
      formData.officeConfig.workingDays,
      formData.publicHolidays
    );
    setCalculatedDays(days);
  }, [watchStartDate, watchEndDate, watchStartHalf, watchEndHalf, formData]);

  // Derived state
  const selectedLeaveType = formData?.leaveTypes.find(
    (lt) => lt.id === watchLeaveType
  );
  const isExceptional = selectedLeaveType?.code === "EXCEPTIONAL";
  const isSick = selectedLeaveType?.code === "SICK";
  const selectedExceptionalRule = formData?.exceptionalRules.find(
    (r) => r.id === watchExceptionalReason
  );

  // Balance info for selected leave type
  const balanceInfo =
    selectedLeaveType?.deductsFromBalance && selectedLeaveType.balanceType
      ? formData?.balances[selectedLeaveType.balanceType] ?? null
      : null;
  const remainingAfter = balanceInfo
    ? balanceInfo.remaining - calculatedDays
    : null;

  // Warnings
  const noticeDaysWarning = (() => {
    if (!formData || !watchStartDate) return false;
    const start = new Date(watchStartDate);
    const now = new Date();
    const diffMs = start.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays < formData.officeConfig.minNoticeDays;
  })();

  const sickJustifWarning =
    isSick &&
    formData &&
    calculatedDays >= formData.officeConfig.sickLeaveJustifFromDay;

  const attachmentRequired =
    selectedLeaveType?.requiresAttachment ||
    (isSick &&
      formData &&
      selectedLeaveType?.attachmentFromDay != null &&
      calculatedDays >= selectedLeaveType.attachmentFromDay);

  // File handling
  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const validFiles: File[] = [];
      for (const file of Array.from(newFiles)) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          addToast({
            type: "error",
            title: lang === "en" ? "Invalid file type" : "Type de fichier invalide",
            message: file.name,
          });
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          addToast({
            type: "error",
            title: lang === "en" ? "File too large (max 5MB)" : "Fichier trop volumineux (max 5Mo)",
            message: file.name,
          });
          continue;
        }
        validFiles.push(file);
      }
      setFiles((prev) => [...prev, ...validFiles]);
    },
    [addToast, lang]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit handler
  const onSubmit = async (values: LeaveRequestInput, action: "draft" | "submit") => {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("leaveTypeConfigId", values.leaveTypeConfigId);
      fd.append("startDate", values.startDate);
      fd.append("endDate", values.endDate);
      fd.append("startHalfDay", values.startHalfDay);
      fd.append("endHalfDay", values.endHalfDay);
      fd.append("reason", values.reason ?? "");
      fd.append("exceptionalReason", values.exceptionalReason ?? "");
      fd.append("action", action);
      for (const file of files) {
        fd.append("attachments", file);
      }

      const res = await fetch("/api/leaves", { method: "POST", body: fd });
      const result = await res.json();

      if (!res.ok) {
        addToast({
          type: "error",
          title: lang === "en" ? "Error" : "Erreur",
          message: result.error,
        });
        return;
      }

      addToast({
        type: "success",
        title:
          action === "submit"
            ? lang === "en"
              ? "Request submitted"
              : "Demande soumise"
            : lang === "en"
              ? "Draft saved"
              : "Brouillon enregistré",
      });
      router.push("/leaves");
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Network error" : "Erreur réseau",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        {lang === "en"
          ? "Unable to load the form."
          : "Impossible de charger le formulaire."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/leaves"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "New Leave Request" : "Nouvelle demande de congé"}
          </h1>
          <p className="text-sm text-gray-500">
            {lang === "en"
              ? "Fill in the details below to request time off."
              : "Remplissez les informations ci-dessous pour demander un congé."}
          </p>
        </div>
      </div>

      {/* Probation alert */}
      {formData.probation && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {lang === "en" ? "Trial period" : "Période d'essai"}
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              {lang === "en"
                ? `You are on probation until ${formatDateLong(formData.probation.endDate, "en")}. Leave requests are not possible during this period.`
                : `Vous êtes en période d'essai jusqu'au ${formatDateLong(formData.probation.endDate, "fr")}. Les demandes de congé ne sont pas possibles pendant cette période.`}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={(e) => e.preventDefault()}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {/* Leave type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {lang === "en" ? "Leave type" : "Type de congé"} *
          </label>
          <select
            {...register("leaveTypeConfigId")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          >
            <option value="">
              {lang === "en" ? "Select a leave type" : "Sélectionnez un type de congé"}
            </option>
            {formData.leaveTypes.map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lang === "en" ? lt.label_en : lt.label_fr}
              </option>
            ))}
          </select>
          {errors.leaveTypeConfigId && (
            <p className="mt-1 text-xs text-red-600">{errors.leaveTypeConfigId.message}</p>
          )}
        </div>

        {/* Exceptional reason */}
        {isExceptional && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Reason" : "Motif du congé exceptionnel"} *
            </label>
            <select
              {...register("exceptionalReason")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            >
              <option value="">
                {lang === "en" ? "Select a reason" : "Sélectionnez un motif"}
              </option>
              {formData.exceptionalRules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {lang === "en" ? rule.reason_en : rule.reason_fr} (max {rule.maxDays}j)
                </option>
              ))}
            </select>
            {selectedExceptionalRule && (
              <p className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                <Info className="h-3 w-3" />
                {lang === "en"
                  ? `Maximum ${selectedExceptionalRule.maxDays} day(s) allowed`
                  : `Maximum ${selectedExceptionalRule.maxDays} jour(s) autorisé(s)`}
              </p>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Start date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Start date" : "Date de début"} *
            </label>
            <input
              type="date"
              {...register("startDate")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            />
            {errors.startDate && (
              <p className="mt-1 text-xs text-red-600">{errors.startDate.message}</p>
            )}
          </div>

          {/* Start half-day */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Period" : "Période"}
            </label>
            <select
              {...register("startHalfDay")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            >
              {HALF_DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === "en" ? opt.label_en : opt.label_fr}
                </option>
              ))}
            </select>
          </div>

          {/* End date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "End date" : "Date de fin"} *
            </label>
            <input
              type="date"
              {...register("endDate")}
              min={watchStartDate || undefined}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            />
            {errors.endDate && (
              <p className="mt-1 text-xs text-red-600">{errors.endDate.message}</p>
            )}
          </div>

          {/* End half-day */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Period" : "Période"}
            </label>
            <select
              {...register("endHalfDay")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            >
              {HALF_DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {lang === "en" ? opt.label_en : opt.label_fr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Day calculation summary */}
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              {lang === "en" ? "Working days:" : "Jours ouvrés :"}
            </span>
            <span className="text-lg font-bold" style={{ color: "#1B3A5C" }}>
              {calculatedDays}
            </span>
          </div>

          {/* Balance remaining in real-time */}
          {balanceInfo && (
            <div className="ml-auto flex items-center gap-2 text-sm">
              <span className="text-gray-500">
                {lang === "en" ? "Balance:" : "Solde :"}
              </span>
              <span className="font-semibold text-gray-700">
                {balanceInfo.remaining}j
              </span>
              {calculatedDays > 0 && (
                <>
                  <span className="text-gray-400">→</span>
                  <span
                    className={`font-semibold ${
                      remainingAfter != null && remainingAfter < 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {remainingAfter != null ? remainingAfter : balanceInfo.remaining}j
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Warnings */}
        {noticeDaysWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-700">
              {lang === "en"
                ? `Warning: this request is made with less than ${formData.officeConfig.minNoticeDays} days' notice.`
                : `Attention : cette demande est faite avec moins de ${formData.officeConfig.minNoticeDays} jours de préavis.`}
            </p>
          </div>
        )}

        {sickJustifWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-700">
              {lang === "en"
                ? `A medical certificate is required for sick leave of ${formData.officeConfig.sickLeaveJustifFromDay}+ days.`
                : `Un justificatif médical est requis pour un arrêt maladie de ${formData.officeConfig.sickLeaveJustifFromDay} jours ou plus.`}
            </p>
          </div>
        )}

        {remainingAfter != null && remainingAfter < 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">
              {lang === "en"
                ? "Insufficient balance for this request."
                : "Solde insuffisant pour cette demande."}
            </p>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {lang === "en" ? "Reason (optional)" : "Motif (optionnel)"}
          </label>
          <textarea
            {...register("reason")}
            rows={3}
            placeholder={
              lang === "en"
                ? "Add a note for your manager..."
                : "Ajoutez une note pour votre manager..."
            }
            className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
          />
        </div>

        {/* File upload */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {lang === "en" ? "Attachments" : "Justificatifs"}
            {attachmentRequired && <span className="ml-1 text-red-500">*</span>}
          </label>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
              dragOver
                ? "border-[#1B3A5C] bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <Upload className="h-6 w-6 text-gray-400" />
            <p className="text-sm text-gray-500">
              {lang === "en"
                ? "Drag & drop files here or click to browse"
                : "Glissez-déposez vos fichiers ici ou cliquez pour parcourir"}
            </p>
            <p className="text-xs text-gray-400">
              {lang === "en"
                ? "Images or PDF, max 5MB"
                : "Images ou PDF, max 5Mo"}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* File list */}
          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((file, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="truncate text-sm text-gray-700">{file.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {(file.size / 1024).toFixed(0)} Ko
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={submitting || !!formData.probation}
            onClick={handleSubmit((v) => onSubmit(v, "draft"))}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {lang === "en" ? "Save as draft" : "Enregistrer en brouillon"}
          </button>

          <button
            type="button"
            disabled={
              submitting ||
              !!formData.probation ||
              (remainingAfter != null && remainingAfter < 0)
            }
            onClick={handleSubmit((v) => onSubmit(v, "submit"))}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {lang === "en" ? "Submit" : "Soumettre"}
          </button>
        </div>
      </form>
    </div>
  );
}
