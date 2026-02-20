"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  CheckCircle,
  XCircle,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";

// ─── Types ───

interface ApprovalStep {
  id: string;
  stepType: string;
  stepOrder: number;
  action: string | null;
  comment: string | null;
  decidedAt: string | null;
  approver: { firstName: string; lastName: string };
}

interface LeaveTypeInfo {
  id: string;
  code: string;
  label_fr: string;
  label_en: string;
  color: string;
}

interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ApprovalItem {
  id: string;
  startDate: string;
  endDate: string;
  startHalfDay: string;
  endHalfDay: string;
  totalDays: number;
  status: string;
  reason: string | null;
  createdAt: string;
  user: UserInfo;
  leaveTypeConfig: LeaveTypeInfo;
  approvalSteps: ApprovalStep[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ───

const HALF_DAY_LABELS: Record<string, { fr: string; en: string }> = {
  MORNING: { fr: "matin", en: "AM" },
  AFTERNOON: { fr: "après-midi", en: "PM" },
};

function formatDateShort(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(
    lang === "en" ? "en-GB" : "fr-FR",
    { day: "numeric", month: "short" }
  );
}

function formatDate(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(
    lang === "en" ? "en-GB" : "fr-FR",
    { day: "numeric", month: "short", year: "numeric" }
  );
}

// ─── Component ───

export default function HRApprovalsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<"APPROVED" | "REFUSED" | "RETURNED">("APPROVED");
  const [modalItemId, setModalItemId] = useState("");
  const [modalComment, setModalComment] = useState("");

  const fetchApprovals = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/hr/approvals?page=${page}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
          setPagination(data.pagination);
        }
      } catch {
        addToast({
          type: "error",
          title: lang === "en" ? "Load error" : "Erreur de chargement",
        });
      } finally {
        setLoading(false);
      }
    },
    [addToast, lang]
  );

  useEffect(() => {
    fetchApprovals(pagination.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = (id: string, action: "APPROVED" | "REFUSED" | "RETURNED") => {
    setModalItemId(id);
    setModalAction(action);
    setModalComment("");
    setModalOpen(true);
  };

  const handleAction = async () => {
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

    setActionLoading(modalItemId);
    try {
      const res = await fetch(`/api/hr/approvals/${modalItemId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modalAction,
          comment: modalComment.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }

      const labels = {
        APPROVED: lang === "en" ? "Request approved" : "Demande approuvée",
        REFUSED: lang === "en" ? "Request refused" : "Demande refusée",
        RETURNED: lang === "en" ? "Request returned" : "Demande renvoyée",
      };

      addToast({ type: "success", title: labels[modalAction] });
      setModalOpen(false);
      fetchApprovals(pagination.page);
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Network error" : "Erreur réseau",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const goToPage = (p: number) => {
    fetchApprovals(p);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {lang === "en" ? "HR Approvals" : "Approbations RH"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {lang === "en"
            ? `${pagination.total} request(s) pending HR approval`
            : `${pagination.total} demande(s) en attente d'approbation RH`}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Inbox className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm text-gray-400">
              {lang === "en"
                ? "No leave request pending HR approval."
                : "Aucune demande en attente d'approbation RH."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Employee" : "Employé"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Type" : "Type"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Dates" : "Dates"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Duration" : "Durée"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Manager decision" : "Décision manager"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Submitted" : "Soumis le"}
                  </th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                    {lang === "en" ? "Actions" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const startHalf = HALF_DAY_LABELS[item.startHalfDay];
                  const endHalf = HALF_DAY_LABELS[item.endHalfDay];

                  // Find the manager step (if any)
                  const managerStep = item.approvalSteps.find(
                    (s) => s.stepType === "MANAGER" && s.action !== null
                  );

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {item.user.firstName} {item.user.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{item.user.email}</p>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.leaveTypeConfig.color }}
                          />
                          <span className="font-medium text-gray-900">
                            {lang === "en"
                              ? item.leaveTypeConfig.label_en
                              : item.leaveTypeConfig.label_fr}
                          </span>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        <span>{formatDateShort(item.startDate, lang)}</span>
                        {startHalf && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({lang === "en" ? startHalf.en : startHalf.fr})
                          </span>
                        )}
                        {item.startDate !== item.endDate && (
                          <>
                            <span className="mx-1 text-gray-400">&rarr;</span>
                            <span>{formatDateShort(item.endDate, lang)}</span>
                            {endHalf && (
                              <span className="ml-1 text-xs text-gray-400">
                                ({lang === "en" ? endHalf.en : endHalf.fr})
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {item.totalDays}{" "}
                        {lang === "en"
                          ? item.totalDays > 1 ? "days" : "day"
                          : item.totalDays > 1 ? "jours" : "jour"}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        {managerStep ? (
                          <div className="flex items-center gap-1.5">
                            {managerStep.action === "APPROVED" && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            <span className="text-xs text-gray-500">
                              {managerStep.approver.firstName} {managerStep.approver.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                        {formatDate(item.createdAt, lang)}
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/leaves/${item.id}?from=hr`}
                            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title={lang === "en" ? "View" : "Voir"}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          <button
                            onClick={() => openModal(item.id, "APPROVED")}
                            disabled={actionLoading === item.id}
                            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
                            title={lang === "en" ? "Approve" : "Approuver"}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => openModal(item.id, "RETURNED")}
                            disabled={actionLoading === item.id}
                            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                            title={lang === "en" ? "Return" : "Renvoyer"}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => openModal(item.id, "REFUSED")}
                            disabled={actionLoading === item.id}
                            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title={lang === "en" ? "Refuse" : "Refuser"}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
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
      </div>

      {/* Action modal */}
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
                  : "Êtes-vous sûr de vouloir approuver cette demande ?"
                : modalAction === "REFUSED"
                  ? lang === "en"
                    ? "Please provide a reason for refusing this request."
                    : "Veuillez fournir un motif de refus."
                  : lang === "en"
                    ? "Please provide a reason for returning this request."
                    : "Veuillez fournir un motif de renvoi."}
            </p>

            <textarea
              value={modalComment}
              onChange={(e) => setModalComment(e.target.value)}
              placeholder={
                lang === "en"
                  ? "Comment (optional for approval)"
                  : "Commentaire (optionnel pour approbation)"
              }
              rows={3}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading !== null}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${
                  modalAction === "APPROVED"
                    ? "bg-green-600"
                    : modalAction === "REFUSED"
                      ? "bg-red-600"
                      : "bg-amber-600"
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
