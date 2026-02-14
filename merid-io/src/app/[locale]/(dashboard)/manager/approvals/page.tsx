"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  History,
  Download,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";

// ─── Types ───

interface ApprovalUser {
  id: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
}

interface LeaveTypeInfo {
  id: string;
  code: string;
  label_fr: string;
  label_en: string;
  color: string;
}

interface ApprovalStepInfo {
  id: string;
  stepType: string;
  stepOrder: number;
  action: string | null;
  comment: string | null;
  decidedAt: string | null;
  approver: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface ApprovalRequest {
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
  createdAt: string;
  user: ApprovalUser;
  leaveType: LeaveTypeInfo;
  approvalSteps: ApprovalStepInfo[];
  isDelegated?: boolean;
  delegatedFromName?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Constants ───

const STATUS_CONFIG: Record<
  string,
  { label_fr: string; label_en: string; bg: string; text: string }
> = {
  DRAFT: { label_fr: "Brouillon", label_en: "Draft", bg: "bg-gray-100", text: "text-gray-700" },
  PENDING_MANAGER: {
    label_fr: "En attente (Manager)",
    label_en: "Pending (Manager)",
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  PENDING_HR: {
    label_fr: "En attente (RH)",
    label_en: "Pending (HR)",
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  APPROVED: { label_fr: "Approuvé", label_en: "Approved", bg: "bg-green-100", text: "text-green-700" },
  REFUSED: { label_fr: "Refusé", label_en: "Refused", bg: "bg-red-100", text: "text-red-700" },
  CANCELLED: { label_fr: "Annulé", label_en: "Cancelled", bg: "bg-gray-100", text: "text-gray-500" },
  RETURNED: { label_fr: "Renvoyé", label_en: "Returned", bg: "bg-blue-100", text: "text-blue-700" },
};

const HALF_DAY_LABELS: Record<string, { fr: string; en: string }> = {
  MORNING: { fr: "matin", en: "AM" },
  AFTERNOON: { fr: "après-midi", en: "PM" },
};

function formatDate(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
  });
}

// ─── Modal Component ───

function CommentModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmColor,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmColor: string;
  loading: boolean;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setComment("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!comment.trim()) {
      setError("Le motif est obligatoire");
      return;
    }
    onConfirm(comment.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
        <div className="mt-4">
          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (error) setError("");
            }}
            placeholder="Saisissez le motif..."
            rows={3}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              error
                ? "border-red-300 focus:ring-red-500"
                : "border-gray-300 focus:ring-[#1B3A5C]"
            }`}
            autoFocus
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmColor}`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───

export default function ManagerApprovalsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = useLocale();

  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Modal state
  const [modal, setModal] = useState<{
    type: "refuse" | "return";
    requestId: string;
  } | null>(null);

  // Fetch approvals
  const fetchApprovals = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("tab", tab);
        params.set("page", String(page));
        params.set("limit", "10");

        const res = await fetch(`/api/manager/approvals?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
          setPagination(data.pagination);
        } else {
          addToast({
            type: "error",
            title: lang === "en" ? "Error" : "Erreur",
            message: lang === "en" ? "Failed to load approvals" : "Impossible de charger les approbations",
          });
        }
      } catch {
        addToast({
          type: "error",
          title: lang === "en" ? "Network error" : "Erreur réseau",
        });
      } finally {
        setLoading(false);
      }
    },
    [tab, addToast, lang]
  );

  useEffect(() => {
    fetchApprovals(1);
  }, [fetchApprovals]);

  // ─── Actions ───

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`/api/leaves/${requestId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      addToast({
        type: "success",
        title: lang === "en" ? "Request approved" : "Demande approuvée",
      });
      fetchApprovals(pagination.page);
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefuse = async (comment: string) => {
    if (!modal) return;
    setActionLoading(modal.requestId);
    try {
      const res = await fetch(`/api/leaves/${modal.requestId}/refuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      addToast({
        type: "success",
        title: lang === "en" ? "Request refused" : "Demande refusée",
      });
      setModal(null);
      fetchApprovals(pagination.page);
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReturn = async (comment: string) => {
    if (!modal) return;
    setActionLoading(modal.requestId);
    try {
      const res = await fetch(`/api/leaves/${modal.requestId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      addToast({
        type: "success",
        title: lang === "en" ? "Request returned to draft" : "Demande renvoyée en brouillon",
      });
      setModal(null);
      fetchApprovals(pagination.page);
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setActionLoading(null);
    }
  };

  const goToPage = (p: number) => {
    fetchApprovals(p);
  };

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === "en" ? "Approvals" : "Approbations"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {lang === "en"
            ? "Manage your team's leave requests"
            : "Gérez les demandes de congé de votre équipe"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setTab("pending")}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "pending"
              ? "bg-white text-[#1B3A5C] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock className="h-4 w-4" />
          {lang === "en" ? "Pending" : "En attente"}
          {tab === "pending" && pagination.total > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-700">
              {pagination.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "history"
              ? "bg-white text-[#1B3A5C] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <History className="h-4 w-4" />
          {lang === "en" ? "History" : "Historique"}
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              {tab === "pending" ? (
                <CheckCircle2 className="h-6 w-6 text-gray-400" />
              ) : (
                <History className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <p className="mt-3 text-sm text-gray-500">
              {tab === "pending"
                ? lang === "en"
                  ? "No pending requests. All caught up!"
                  : "Aucune demande en attente. Tout est à jour !"
                : lang === "en"
                  ? "No processed requests yet."
                  : "Aucune demande traitée pour le moment."}
            </p>
          </div>
        ) : (
          items.map((item) => {
            const status = STATUS_CONFIG[item.status] ?? {
              label_fr: item.status,
              label_en: item.status,
              bg: "bg-gray-100",
              text: "text-gray-700",
            };
            const startHalf = HALF_DAY_LABELS[item.startHalfDay];
            const endHalf = HALF_DAY_LABELS[item.endHalfDay];
            const isPending = tab === "pending";
            const isActioning = actionLoading === item.id;

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Delegation indicator */}
                {item.isDelegated && (
                  <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-800">
                    <Shield className="h-4 w-4" />
                    <span>
                      {lang === "en"
                        ? `You are acting as delegate for ${item.delegatedFromName}`
                        : `Vous agissez en tant que délégué de ${item.delegatedFromName}`}
                    </span>
                  </div>
                )}

                <div className="p-5">
                  {/* Top row: Employee + Status */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {item.user.profilePictureUrl ? (
                        <img
                          src={item.user.profilePictureUrl}
                          alt={`${item.user.firstName} ${item.user.lastName}`}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B3A5C] text-sm font-bold text-white">
                          {item.user.firstName[0]}
                          {item.user.lastName[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">
                          {item.user.firstName} {item.user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {lang === "en" ? "Submitted" : "Soumis le"}{" "}
                          {formatDate(item.createdAt, lang)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.bg} ${status.text}`}
                    >
                      {lang === "en" ? status.label_en : status.label_fr}
                    </span>
                  </div>

                  {/* Leave details */}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                    {/* Type */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {lang === "en" ? "Type" : "Type"}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.leaveType.color }}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {lang === "en" ? item.leaveType.label_en : item.leaveType.label_fr}
                        </span>
                      </div>
                    </div>

                    {/* Dates */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {lang === "en" ? "Dates" : "Dates"}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {formatDateShort(item.startDate, lang)}
                        {startHalf && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({lang === "en" ? startHalf.en : startHalf.fr})
                          </span>
                        )}
                        <span className="mx-1 text-gray-400">&rarr;</span>
                        {formatDateShort(item.endDate, lang)}
                        {endHalf && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({lang === "en" ? endHalf.en : endHalf.fr})
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Duration */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {lang === "en" ? "Duration" : "Durée"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        {item.totalDays}{" "}
                        {lang === "en"
                          ? item.totalDays > 1
                            ? "days"
                            : "day"
                          : item.totalDays > 1
                            ? "jours"
                            : "jour"}
                      </p>
                    </div>

                    {/* Reason */}
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                        {lang === "en" ? "Reason" : "Motif"}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {item.exceptionalReason || item.reason || (
                          <span className="italic text-gray-400">
                            {lang === "en" ? "None" : "Aucun"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Attachments */}
                  {item.attachmentUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.attachmentUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {lang === "en" ? "Attachment" : "Pièce jointe"} {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Approval steps history (for history tab) */}
                  {!isPending && item.approvalSteps.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                        {lang === "en" ? "Approval steps" : "Étapes de validation"}
                      </p>
                      <div className="space-y-1.5">
                        {item.approvalSteps.map((step) => (
                          <div key={step.id} className="flex items-center gap-2 text-xs">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                                step.action === "APPROVED"
                                  ? "bg-green-100 text-green-700"
                                  : step.action === "REFUSED"
                                    ? "bg-red-100 text-red-700"
                                    : step.action === "RETURNED"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {step.action ?? (lang === "en" ? "Pending" : "En attente")}
                            </span>
                            <span className="text-gray-500">
                              {step.approver.firstName} {step.approver.lastName}
                            </span>
                            {step.decidedAt && (
                              <span className="text-gray-400">
                                {formatDate(step.decidedAt, lang)}
                              </span>
                            )}
                            {step.comment && (
                              <span className="italic text-gray-500">
                                &mdash; {step.comment}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons (pending tab only) */}
                  {isPending && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                      <button
                        onClick={() => handleApprove(item.id)}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {isActioning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {lang === "en" ? "Approve" : "Approuver"}
                      </button>
                      <button
                        onClick={() => setModal({ type: "refuse", requestId: item.id })}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        {lang === "en" ? "Refuse" : "Refuser"}
                      </button>
                      <button
                        onClick={() => setModal({ type: "return", requestId: item.id })}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {lang === "en" ? "Return to draft" : "Renvoyer en brouillon"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-3">
          <p className="text-sm text-gray-500">
            {lang === "en"
              ? `Page ${pagination.page} of ${pagination.totalPages}`
              : `Page ${pagination.page} sur ${pagination.totalPages}`}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === pagination.totalPages ||
                  Math.abs(p - pagination.page) <= 1
              )
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "..." ? (
                  <span key={`dots-${idx}`} className="px-2 py-1 text-sm text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p as number)}
                    className={`min-w-[32px] rounded-md px-2 py-1 text-sm font-medium transition-colors ${
                      p === pagination.page
                        ? "bg-[#1B3A5C] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Refuse Modal */}
      <CommentModal
        isOpen={modal?.type === "refuse"}
        onClose={() => setModal(null)}
        onConfirm={handleRefuse}
        title={lang === "en" ? "Refuse request" : "Refuser la demande"}
        description={
          lang === "en"
            ? "Please provide a reason for refusing this request."
            : "Veuillez indiquer le motif du refus."
        }
        confirmLabel={lang === "en" ? "Refuse" : "Refuser"}
        confirmColor="bg-red-600 hover:bg-red-700"
        loading={actionLoading !== null}
      />

      {/* Return Modal */}
      <CommentModal
        isOpen={modal?.type === "return"}
        onClose={() => setModal(null)}
        onConfirm={handleReturn}
        title={lang === "en" ? "Return to draft" : "Renvoyer en brouillon"}
        description={
          lang === "en"
            ? "Please provide a reason for returning this request to draft."
            : "Veuillez indiquer le motif du renvoi en brouillon."
        }
        confirmLabel={lang === "en" ? "Return" : "Renvoyer"}
        confirmColor="bg-amber-600 hover:bg-amber-700"
        loading={actionLoading !== null}
      />
    </div>
  );
}
