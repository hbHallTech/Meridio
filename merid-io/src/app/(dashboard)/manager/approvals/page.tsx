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

interface ApprovalStep {
  id: string;
  stepType: string;
  action: string | null;
  approver: { firstName: string; lastName: string };
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
  user: { id: string; firstName: string; lastName: string; email: string };
  leaveTypeConfig: { id: string; label_fr: string; label_en: string; color: string };
  approvalSteps: ApprovalStep[];
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

const HALF_DAY_LABELS: Record<string, { fr: string; en: string }> = {
  MORNING: { fr: "matin", en: "AM" },
  AFTERNOON: { fr: "après-midi", en: "PM" },
};

function fmtDate(d: string, l: string) {
  return new Date(d).toLocaleDateString(l === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });
}

export default function ManagerApprovalsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<"APPROVED" | "REFUSED" | "RETURNED">("APPROVED");
  const [modalItemId, setModalItemId] = useState("");
  const [modalComment, setModalComment] = useState("");

  const fetchApprovals = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manager/approvals?page=${page}&limit=10`);
      if (res.ok) { const d = await res.json(); setItems(d.items); setPagination(d.pagination); }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Load error" : "Erreur de chargement" });
    } finally { setLoading(false); }
  }, [addToast, lang]);

  useEffect(() => { fetchApprovals(1); }, [fetchApprovals]);

  const openModal = (id: string, action: "APPROVED" | "REFUSED" | "RETURNED") => {
    setModalItemId(id); setModalAction(action); setModalComment(""); setModalOpen(true);
  };

  const handleAction = async () => {
    if ((modalAction === "REFUSED" || modalAction === "RETURNED") && !modalComment.trim()) {
      addToast({ type: "error", title: lang === "en" ? "Comment required" : "Commentaire requis" });
      return;
    }
    setActionLoading(modalItemId);
    try {
      const res = await fetch(`/api/manager/approvals/${modalItemId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: modalAction, comment: modalComment.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { addToast({ type: "error", title: "Erreur", message: d.error }); return; }
      const labels = {
        APPROVED: lang === "en" ? "Request approved" : "Demande approuvee",
        REFUSED: lang === "en" ? "Request refused" : "Demande refusee",
        RETURNED: lang === "en" ? "Request returned" : "Demande renvoyee",
      };
      addToast({ type: "success", title: labels[modalAction] });
      setModalOpen(false);
      fetchApprovals(pagination.page);
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur reseau" });
    } finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{lang === "en" ? "Manager Approvals" : "Approbations Manager"}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {lang === "en" ? `${pagination.total} request(s) pending` : `${pagination.total} demande(s) en attente`}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Inbox className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p className="text-sm text-gray-400">{lang === "en" ? "No pending approvals." : "Aucune approbation en attente."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Employee" : "Employe"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Type" : "Type"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Dates" : "Dates"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Duration" : "Duree"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Submitted" : "Soumis le"}</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const startHalf = HALF_DAY_LABELS[item.startHalfDay];
                  const endHalf = HALF_DAY_LABELS[item.endHalfDay];
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <p className="font-medium text-gray-900">{item.user.firstName} {item.user.lastName}</p>
                        <p className="text-xs text-gray-400">{item.user.email}</p>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.leaveTypeConfig.color }} />
                          <span className="font-medium text-gray-900">{lang === "en" ? item.leaveTypeConfig.label_en : item.leaveTypeConfig.label_fr}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                        {fmtDate(item.startDate, lang)}
                        {startHalf && <span className="ml-1 text-xs text-gray-400">({lang === "en" ? startHalf.en : startHalf.fr})</span>}
                        {item.startDate !== item.endDate && (
                          <><span className="mx-1 text-gray-400">&rarr;</span>{fmtDate(item.endDate, lang)}
                            {endHalf && <span className="ml-1 text-xs text-gray-400">({lang === "en" ? endHalf.en : endHalf.fr})</span>}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">{item.totalDays} {lang === "en" ? (item.totalDays > 1 ? "days" : "day") : (item.totalDays > 1 ? "jours" : "jour")}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-500">{new Date(item.createdAt).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/leaves/${item.id}`} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title={lang === "en" ? "View" : "Voir"}><Eye className="h-4 w-4" /></Link>
                          <button onClick={() => openModal(item.id, "APPROVED")} disabled={actionLoading === item.id} className="rounded-md p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-50" title={lang === "en" ? "Approve" : "Approuver"}><CheckCircle className="h-4 w-4" /></button>
                          <button onClick={() => openModal(item.id, "RETURNED")} disabled={actionLoading === item.id} className="rounded-md p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50" title={lang === "en" ? "Return" : "Renvoyer"}><RotateCcw className="h-4 w-4" /></button>
                          <button onClick={() => openModal(item.id, "REFUSED")} disabled={actionLoading === item.id} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title={lang === "en" ? "Refuse" : "Refuser"}><XCircle className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <p className="text-sm text-gray-500">{lang === "en" ? `Page ${pagination.page} of ${pagination.totalPages}` : `Page ${pagination.page} sur ${pagination.totalPages}`}</p>
            <div className="flex gap-1">
              <button onClick={() => fetchApprovals(pagination.page - 1)} disabled={pagination.page <= 1} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => fetchApprovals(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              {modalAction === "APPROVED" ? (lang === "en" ? "Approve request" : "Approuver la demande") : modalAction === "REFUSED" ? (lang === "en" ? "Refuse request" : "Refuser la demande") : (lang === "en" ? "Return request" : "Renvoyer la demande")}
            </h3>
            <textarea value={modalComment} onChange={(e) => setModalComment(e.target.value)} placeholder={lang === "en" ? "Comment (optional for approval)" : "Commentaire (optionnel pour approbation)"} rows={3} className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{lang === "en" ? "Cancel" : "Annuler"}</button>
              <button onClick={handleAction} disabled={actionLoading !== null} className={`rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 ${modalAction === "APPROVED" ? "bg-green-600" : modalAction === "REFUSED" ? "bg-red-600" : "bg-amber-600"}`}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : modalAction === "APPROVED" ? (lang === "en" ? "Approve" : "Approuver") : modalAction === "REFUSED" ? (lang === "en" ? "Refuse" : "Refuser") : (lang === "en" ? "Return" : "Renvoyer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
