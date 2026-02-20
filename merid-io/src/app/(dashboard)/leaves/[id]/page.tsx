"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  Loader2,
  CalendarDays,
  Clock,
  FileText,
  Download,
  Send,
  XCircle,
  Pencil,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  User,
} from "lucide-react";

// ─── Types ───

interface ApproverInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ApprovalStep {
  id: string;
  stepType: string;
  stepOrder: number;
  action: string | null;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
  approver: ApproverInfo;
}

interface LeaveDetail {
  id: string;
  startDate: string;
  endDate: string;
  startHalfDay: string;
  endHalfDay: string;
  totalDays: number;
  status: string;
  reason: string | null;
  exceptionalReason: string | null;
  attachmentUrls: string[];
  isCompanyClosure: boolean;
  createdAt: string;
  updatedAt: string;
  leaveType: {
    id: string;
    code: string;
    label_fr: string;
    label_en: string;
    color: string;
    requiresAttachment: boolean;
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvalSteps: ApprovalStep[];
}

// ─── Constants ───

const STATUS_CONFIG: Record<
  string,
  { label_fr: string; label_en: string; bg: string; text: string; icon: typeof CheckCircle }
> = {
  DRAFT: { label_fr: "Brouillon", label_en: "Draft", bg: "bg-gray-100", text: "text-gray-700", icon: FileText },
  PENDING_MANAGER: {
    label_fr: "En attente (Manager)",
    label_en: "Pending (Manager)",
    bg: "bg-amber-100",
    text: "text-amber-700",
    icon: Clock,
  },
  PENDING_HR: {
    label_fr: "En attente (RH)",
    label_en: "Pending (HR)",
    bg: "bg-amber-100",
    text: "text-amber-700",
    icon: Clock,
  },
  APPROVED: {
    label_fr: "Approuvé",
    label_en: "Approved",
    bg: "bg-green-100",
    text: "text-green-700",
    icon: CheckCircle,
  },
  REFUSED: {
    label_fr: "Refusé",
    label_en: "Refused",
    bg: "bg-red-100",
    text: "text-red-700",
    icon: XCircle,
  },
  CANCELLED: {
    label_fr: "Annulé",
    label_en: "Cancelled",
    bg: "bg-gray-100",
    text: "text-gray-500",
    icon: XCircle,
  },
  RETURNED: {
    label_fr: "Renvoyé",
    label_en: "Returned",
    bg: "bg-blue-100",
    text: "text-blue-700",
    icon: RotateCcw,
  },
};

const HALF_DAY_LABELS: Record<string, { fr: string; en: string }> = {
  MORNING: { fr: "Matin", en: "Morning" },
  AFTERNOON: { fr: "Après-midi", en: "Afternoon" },
  FULL_DAY: { fr: "Journée complète", en: "Full day" },
};

const STEP_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  MANAGER: { fr: "Manager", en: "Manager" },
  HR: { fr: "Ressources Humaines", en: "Human Resources" },
};

const ACTION_CONFIG: Record<string, { label_fr: string; label_en: string; color: string; icon: typeof CheckCircle }> = {
  APPROVED: { label_fr: "Approuvé", label_en: "Approved", color: "text-green-600", icon: CheckCircle },
  REFUSED: { label_fr: "Refusé", label_en: "Refused", color: "text-red-600", icon: XCircle },
  RETURNED: { label_fr: "Renvoyé", label_en: "Returned", color: "text-blue-600", icon: RotateCcw },
};

function formatDate(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ───

export default function LeaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";
  const id = params.id as string;
  const from = searchParams.get("from"); // "manager" | "hr" | null

  const [data, setData] = useState<LeaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Approval modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<"APPROVED" | "REFUSED" | "RETURNED">("APPROVED");
  const [modalComment, setModalComment] = useState("");

  useEffect(() => {
    fetch(`/api/leaves/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Determine viewer's role context
  const currentUserId = session?.user?.id;
  const isOwner = data ? data.user.id === currentUserId : false;

  // Check if the current user is an approver on a pending step
  const pendingApproverStep = data?.approvalSteps.find(
    (s) => s.approver.id === currentUserId && s.action === null
  );
  const isApprover = !!pendingApproverStep;
  const approverStepType = pendingApproverStep?.stepType; // "MANAGER" | "HR"

  // Determine the API endpoint for approval actions based on step type
  const approvalApiBase =
    approverStepType === "HR"
      ? `/api/hr/approvals/${id}/action`
      : `/api/manager/approvals/${id}/action`;

  // Can the approver take action? Only if the status matches their step
  const canApprove =
    isApprover &&
    ((approverStepType === "MANAGER" && data?.status === "PENDING_MANAGER") ||
      (approverStepType === "HR" && data?.status === "PENDING_HR"));

  // Back link based on context
  const backHref =
    from === "manager"
      ? "/manager/approvals"
      : from === "hr"
        ? "/hr/approvals"
        : "/leaves";

  // Owner actions (cancel, submit, edit)
  const handleOwnerAction = async (action: "cancel" | "submit") => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: result.error });
        return;
      }
      addToast({
        type: "success",
        title:
          action === "cancel"
            ? lang === "en" ? "Request cancelled" : "Demande annulée"
            : lang === "en" ? "Request submitted" : "Demande soumise",
      });
      router.push("/leaves");
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setActionLoading(false);
    }
  };

  // Approval action handler
  const openApprovalModal = (action: "APPROVED" | "REFUSED" | "RETURNED") => {
    setModalAction(action);
    setModalComment("");
    setModalOpen(true);
  };

  const handleApprovalAction = async () => {
    if ((modalAction === "REFUSED" || modalAction === "RETURNED") && !modalComment.trim()) {
      addToast({
        type: "error",
        title: lang === "en" ? "Comment required" : "Commentaire requis",
        message:
          lang === "en"
            ? "Please provide a reason for refusal or return."
            : "Veuillez fournir un motif pour le refus ou le renvoi.",
      });
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(approvalApiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modalAction,
          comment: modalComment.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: result.error });
        return;
      }

      const labels = {
        APPROVED: lang === "en" ? "Request approved" : "Demande approuvée",
        REFUSED: lang === "en" ? "Request refused" : "Demande refusée",
        RETURNED: lang === "en" ? "Request returned" : "Demande renvoyée",
      };
      addToast({ type: "success", title: labels[modalAction] });
      setModalOpen(false);
      router.push(backHref);
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        {lang === "en" ? "Request not found." : "Demande introuvable."}
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[data.status] ?? {
    label_fr: data.status,
    label_en: data.status,
    bg: "bg-gray-100",
    text: "text-gray-700",
    icon: FileText,
  };
  const StatusIcon = statusCfg.icon;

  const canEdit = isOwner && (data.status === "DRAFT" || data.status === "RETURNED");
  const canCancel = isOwner && ["DRAFT", "PENDING_MANAGER", "PENDING_HR"].includes(data.status);
  const canSubmit = isOwner && (data.status === "DRAFT" || data.status === "RETURNED");

  const startHalf = HALF_DAY_LABELS[data.startHalfDay] ?? HALF_DAY_LABELS.FULL_DAY;
  const endHalf = HALF_DAY_LABELS[data.endHalfDay] ?? HALF_DAY_LABELS.FULL_DAY;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {lang === "en" ? data.leaveType.label_en : data.leaveType.label_fr}
            </h1>
            <p className="text-sm text-gray-500">
              {lang === "en" ? "Request" : "Demande"} #{data.id.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm font-semibold ${statusCfg.bg} ${statusCfg.text}`}
        >
          <StatusIcon className="h-4 w-4" />
          {lang === "en" ? statusCfg.label_en : statusCfg.label_fr}
        </span>
      </div>

      {/* Employee info — shown when viewing as approver */}
      {!isOwner && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B3A5C] text-white text-sm font-semibold">
            {data.user.firstName.charAt(0)}
            {data.user.lastName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {data.user.firstName} {data.user.lastName}
            </p>
            <p className="text-xs text-gray-500">
              {lang === "en" ? "Employee" : "Employé"}
            </p>
          </div>
        </div>
      )}

      {/* Main info card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {/* Dates */}
          <div className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <CalendarDays className="h-4 w-4" />
              {lang === "en" ? "Period" : "Période"}
            </div>
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDate(data.startDate, lang)}
                </p>
                <p className="text-xs text-gray-500">
                  {lang === "en" ? startHalf.en : startHalf.fr}
                </p>
              </div>
              {data.startDate !== data.endDate && (
                <>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span>→</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(data.endDate, lang)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {lang === "en" ? endHalf.en : endHalf.fr}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Clock className="h-4 w-4" />
              {lang === "en" ? "Details" : "Détails"}
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {lang === "en" ? "Duration" : "Durée"}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {data.totalDays}{" "}
                  {lang === "en"
                    ? data.totalDays > 1 ? "days" : "day"
                    : data.totalDays > 1 ? "jours" : "jour"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {lang === "en" ? "Type" : "Type"}
                </span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: data.leaveType.color }}
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {lang === "en" ? data.leaveType.label_en : data.leaveType.label_fr}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {lang === "en" ? "Created" : "Créée le"}
                </span>
                <span className="text-sm text-gray-700">
                  {formatDateTime(data.createdAt, lang)}
                </span>
              </div>
              {data.isCompanyClosure && (
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                  {lang === "en" ? "Company closure" : "Fermeture entreprise"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reason */}
        {(data.reason || data.exceptionalReason) && (
          <div className="border-t border-gray-100 p-6">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Reason" : "Motif"}
            </p>
            {data.exceptionalReason && (
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {data.exceptionalReason}
              </p>
            )}
            {data.reason && (
              <p className="mt-1 text-sm text-gray-700">{data.reason}</p>
            )}
          </div>
        )}

        {/* Attachments */}
        {data.attachmentUrls.length > 0 && (
          <div className="border-t border-gray-100 p-6">
            <p className="text-sm font-medium text-gray-500">
              {lang === "en" ? "Attachments" : "Justificatifs"}
            </p>
            <ul className="mt-3 space-y-2">
              {data.attachmentUrls.map((url, idx) => {
                const fileName = url.split("/").pop() ?? `piece-jointe-${idx + 1}`;
                const proxyUrl = `/api/attachments?url=${encodeURIComponent(url)}`;
                return (
                  <li
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <a
                      href={proxyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 truncate hover:underline"
                    >
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="truncate text-sm text-blue-700">{fileName}</span>
                    </a>
                    <a
                      href={proxyUrl}
                      download={fileName}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title={lang === "en" ? "Download" : "Télécharger"}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Approval timeline */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          {lang === "en" ? "Validation Timeline" : "Chronologie de validation"}
        </h2>

        {data.approvalSteps.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">
            {data.status === "DRAFT"
              ? lang === "en"
                ? "This request has not been submitted yet."
                : "Cette demande n'a pas encore été soumise."
              : lang === "en"
                ? "No approval steps recorded yet."
                : "Aucune étape de validation enregistrée."}
          </p>
        ) : (
          <div className="relative mt-6 ml-4">
            {/* Vertical line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" />

            <div className="space-y-6">
              {data.approvalSteps.map((step) => {
                const actionCfg = step.action ? ACTION_CONFIG[step.action] : null;
                const ActionIcon = actionCfg?.icon ?? Clock;
                const isPending = !step.action;
                const stepLabel = STEP_TYPE_LABELS[step.stepType] ?? {
                  fr: step.stepType,
                  en: step.stepType,
                };

                return (
                  <div key={step.id} className="relative pl-8">
                    {/* Dot */}
                    <div
                      className={`absolute left-0 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                        isPending
                          ? "border-gray-300 bg-white"
                          : actionCfg
                            ? step.action === "APPROVED"
                              ? "border-green-200 bg-green-50"
                              : step.action === "REFUSED"
                                ? "border-red-200 bg-red-50"
                                : "border-blue-200 bg-blue-50"
                            : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      {isPending ? (
                        <Clock className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ActionIcon className={`h-4 w-4 ${actionCfg?.color ?? "text-gray-400"}`} />
                      )}
                    </div>

                    {/* Content */}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {lang === "en" ? `Step ${step.stepOrder}` : `Étape ${step.stepOrder}`}
                          {" — "}
                          {lang === "en" ? stepLabel.en : stepLabel.fr}
                        </p>
                        {actionCfg && (
                          <span className={`text-xs font-semibold ${actionCfg.color}`}>
                            {lang === "en" ? actionCfg.label_en : actionCfg.label_fr}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <User className="h-3 w-3" />
                        <span>
                          {isPending
                            ? lang === "en"
                              ? `Awaiting ${step.approver.firstName} ${step.approver.lastName}`
                              : `En attente de ${step.approver.firstName} ${step.approver.lastName}`
                            : `${step.approver.firstName} ${step.approver.lastName}`}
                        </span>
                        {step.decidedAt && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{formatDateTime(step.decidedAt, lang)}</span>
                          </>
                        )}
                      </div>

                      {step.comment && (
                        <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                          &ldquo;{step.comment}&rdquo;
                        </div>
                      )}

                      {isPending && !step.decidedAt && (
                        <p className="mt-1 text-xs italic text-gray-400">
                          {lang === "en" ? "Awaiting decision" : "En attente de décision"}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Approver action buttons — shown only when current user is the pending approver */}
      {canApprove && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            {lang === "en" ? "Your Decision" : "Votre décision"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? "Review the request above and take action."
              : "Examinez la demande ci-dessus et prenez une décision."}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => openApprovalModal("APPROVED")}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {lang === "en" ? "Approve" : "Approuver"}
            </button>
            <button
              onClick={() => openApprovalModal("RETURNED")}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              {lang === "en" ? "Return for revision" : "Renvoyer pour révision"}
            </button>
            <button
              onClick={() => openApprovalModal("REFUSED")}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              {lang === "en" ? "Refuse" : "Refuser"}
            </button>
          </div>
        </div>
      )}

      {/* Owner action buttons — only shown to the leave owner */}
      {isOwner && (canEdit || canSubmit || canCancel) && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {canEdit && (
            <Link
              href={`/leaves/new?edit=${data.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              {lang === "en" ? "Edit" : "Modifier"}
            </Link>
          )}

          {canCancel && (
            <button
              onClick={() => handleOwnerAction("cancel")}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {lang === "en" ? "Cancel request" : "Annuler la demande"}
            </button>
          )}

          {canSubmit && (
            <button
              onClick={() => handleOwnerAction("submit")}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {lang === "en" ? "Submit" : "Soumettre"}
            </button>
          )}
        </div>
      )}

      {/* Approval action modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              {modalAction === "APPROVED"
                ? lang === "en" ? "Approve request" : "Approuver la demande"
                : modalAction === "REFUSED"
                  ? lang === "en" ? "Refuse request" : "Refuser la demande"
                  : lang === "en" ? "Return request" : "Renvoyer la demande"}
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              {modalAction === "APPROVED"
                ? lang === "en"
                  ? "Are you sure you want to approve this leave request?"
                  : "Êtes-vous sûr de vouloir approuver cette demande de congé ?"
                : modalAction === "REFUSED"
                  ? lang === "en"
                    ? "Please provide a reason for refusing this request."
                    : "Veuillez fournir un motif de refus."
                  : lang === "en"
                    ? "Please explain what needs to be revised."
                    : "Veuillez expliquer ce qui doit être révisé."}
            </p>

            <textarea
              value={modalComment}
              onChange={(e) => setModalComment(e.target.value)}
              placeholder={
                lang === "en"
                  ? modalAction === "APPROVED"
                    ? "Comment (optional)"
                    : "Comment (required)"
                  : modalAction === "APPROVED"
                    ? "Commentaire (optionnel)"
                    : "Commentaire (requis)"
              }
              rows={3}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            />

            {(modalAction === "REFUSED" || modalAction === "RETURNED") && !modalComment.trim() && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {lang === "en" ? "A comment is required." : "Un commentaire est requis."}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
              <button
                onClick={handleApprovalAction}
                disabled={actionLoading}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${
                  modalAction === "APPROVED"
                    ? "bg-green-600"
                    : modalAction === "REFUSED"
                      ? "bg-red-600"
                      : "bg-amber-500"
                }`}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : modalAction === "APPROVED"
                  ? lang === "en" ? "Approve" : "Approuver"
                  : modalAction === "REFUSED"
                    ? lang === "en" ? "Refuse" : "Refuser"
                    : lang === "en" ? "Return" : "Renvoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
