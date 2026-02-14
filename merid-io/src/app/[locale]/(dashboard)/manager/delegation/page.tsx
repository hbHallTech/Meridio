"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  PlusCircle,
  ArrowLeftRight,
  XCircle,
  CheckCircle2,
  Clock,
  History,
} from "lucide-react";

// ─── Types ───

interface Colleague {
  id: string;
  firstName: string;
  lastName: string;
}

interface DelegationItem {
  id: string;
  toUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  startDate: string;
  endDate: string;
  isActive: boolean;
  isCurrentlyActive: boolean;
  isPast: boolean;
  createdAt: string;
}

// ─── Helpers ───

function formatDate(dateStr: string, lang: string): string {
  return new Date(dateStr).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ───

export default function DelegationPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = useLocale();

  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Confirm cancel state
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const fetchDelegations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/manager/delegations");
      if (res.ok) {
        const data = await res.json();
        setDelegations(data.delegations);
        setColleagues(data.colleagues);
      }
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Error" : "Erreur",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, lang]);

  useEffect(() => {
    fetchDelegations();
  }, [fetchDelegations]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!toUserId) {
      errors.toUserId = lang === "en" ? "Select a colleague" : "Sélectionnez un collègue";
    }
    if (!startDate) {
      errors.startDate = lang === "en" ? "Start date is required" : "La date de début est requise";
    }
    if (!endDate) {
      errors.endDate = lang === "en" ? "End date is required" : "La date de fin est requise";
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errors.endDate = lang === "en" ? "End date must be after start date" : "La date de fin doit être après la date de début";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/manager/delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, startDate, endDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      addToast({
        type: "success",
        title: lang === "en" ? "Delegation created" : "Délégation créée",
      });
      setShowForm(false);
      setToUserId("");
      setStartDate("");
      setEndDate("");
      setFormErrors({});
      fetchDelegations();
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      const res = await fetch(`/api/manager/delegations/${id}`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) {
        addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur", message: data.error });
        return;
      }
      addToast({
        type: "success",
        title: lang === "en" ? "Delegation cancelled" : "Délégation annulée",
      });
      setConfirmCancel(null);
      fetchDelegations();
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Network error" : "Erreur réseau" });
    } finally {
      setCancelling(null);
    }
  };

  const activeDelegations = delegations.filter((d) => d.isActive && !d.isPast);
  const pastDelegations = delegations.filter((d) => !d.isActive || d.isPast);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Delegation" : "Délégation"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? "Delegate your approval rights to a colleague"
              : "Déléguez vos droits d'approbation à un collègue"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1B3A5C" }}
        >
          <PlusCircle className="h-4 w-4" />
          {lang === "en" ? "New delegation" : "Nouvelle délégation"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            {lang === "en" ? "Create a delegation" : "Créer une délégation"}
          </h3>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "Colleague" : "Collègue"}
                </label>
                <select
                  value={toUserId}
                  onChange={(e) => {
                    setToUserId(e.target.value);
                    if (formErrors.toUserId) setFormErrors((prev) => ({ ...prev, toUserId: "" }));
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    formErrors.toUserId
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300 focus:border-[#1B3A5C] focus:ring-[#1B3A5C]"
                  }`}
                >
                  <option value="">
                    {lang === "en" ? "Select a colleague..." : "Sélectionner un collègue..."}
                  </option>
                  {colleagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
                {formErrors.toUserId && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.toUserId}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "Start date" : "Date de début"}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (formErrors.startDate) setFormErrors((prev) => ({ ...prev, startDate: "" }));
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    formErrors.startDate
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300 focus:border-[#1B3A5C] focus:ring-[#1B3A5C]"
                  }`}
                />
                {formErrors.startDate && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.startDate}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  {lang === "en" ? "End date" : "Date de fin"}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (formErrors.endDate) setFormErrors((prev) => ({ ...prev, endDate: "" }));
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    formErrors.endDate
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-300 focus:border-[#1B3A5C] focus:ring-[#1B3A5C]"
                  }`}
                />
                {formErrors.endDate && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.endDate}</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#1B3A5C" }}
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "en" ? "Create" : "Créer"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormErrors({});
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {lang === "en" ? "Cancel" : "Annuler"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Active delegations */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Clock className="h-4 w-4" />
              {lang === "en" ? "Active & upcoming delegations" : "Délégations actives et à venir"}
              {activeDelegations.length > 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                  {activeDelegations.length}
                </span>
              )}
            </h2>

            {activeDelegations.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
                <ArrowLeftRight className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  {lang === "en"
                    ? "No active delegation."
                    : "Aucune délégation active."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeDelegations.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B3A5C] text-sm font-bold text-white">
                        {d.toUser.firstName[0]}
                        {d.toUser.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {d.toUser.firstName} {d.toUser.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(d.startDate, lang)} &rarr; {formatDate(d.endDate, lang)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.isCurrentlyActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          <CheckCircle2 className="h-3 w-3" />
                          {lang === "en" ? "Active" : "Active"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          <Clock className="h-3 w-3" />
                          {lang === "en" ? "Upcoming" : "À venir"}
                        </span>
                      )}
                      {confirmCancel === d.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {lang === "en" ? "Confirm?" : "Confirmer ?"}
                          </span>
                          <button
                            onClick={() => handleCancel(d.id)}
                            disabled={cancelling === d.id}
                            className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {cancelling === d.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {lang === "en" ? "Yes" : "Oui"}
                          </button>
                          <button
                            onClick={() => setConfirmCancel(null)}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            {lang === "en" ? "No" : "Non"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmCancel(d.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {lang === "en" ? "Cancel" : "Annuler"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past delegations */}
          {pastDelegations.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <History className="h-4 w-4" />
                {lang === "en" ? "Past delegations" : "Délégations passées"}
              </h2>
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                      <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                        {lang === "en" ? "Delegate" : "Délégataire"}
                      </th>
                      <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                        {lang === "en" ? "Period" : "Période"}
                      </th>
                      <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                        {lang === "en" ? "Status" : "Statut"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pastDelegations.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50/50">
                        <td className="whitespace-nowrap px-6 py-3 text-gray-900">
                          {d.toUser.firstName} {d.toUser.lastName}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-gray-600">
                          {formatDate(d.startDate, lang)} &rarr; {formatDate(d.endDate, lang)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3">
                          {!d.isActive ? (
                            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                              {lang === "en" ? "Cancelled" : "Annulée"}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                              {lang === "en" ? "Expired" : "Expirée"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
