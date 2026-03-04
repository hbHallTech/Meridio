"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  MapPin,
  Users,
  Briefcase,
  Globe,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  RotateCw,
} from "lucide-react";

interface SignupRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string | null;
  jobTitle: string | null;
  companyName: string;
  activityDomain: string | null;
  website: string | null;
  employeeCount: string | null;
  orgName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  orgPhone: string | null;
  aiNeeds: string | null;
  subsidiaryCount: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  provisionedCompanyId: string | null;
  createdAt: string;
}

interface ApproveResult {
  success: boolean;
  message?: string;
  company?: { id: string; name: string };
  adminUser?: { id: string; email: string };
}

type FilterStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export default function SignupRequestsPage() {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approveResult, setApproveResult] = useState<Record<string, ApproveResult>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<Record<string, string>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "ALL" ? `?status=${filter}` : "";
      const res = await fetch(`/api/super-admin/signup-requests${params}`);
      if (res.ok) {
        setRequests(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pendingIds = requests.filter((r) => r.status === "PENDING").map((r) => r.id);

  const toggleSelectAll = () => {
    if (pendingIds.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingIds));
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm("Approuver cette demande et créer le tenant ?")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/super-admin/signup-requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setApproveResult((prev) => ({ ...prev, [id]: data }));
        fetchRequests();
      } else {
        alert(data.error || "Erreur lors de l'approbation");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Rejeter cette demande ?")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/super-admin/signup-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: rejectNotes[id] || "" }),
      });
      const data = await res.json();
      if (res.ok) {
        fetchRequests();
      } else {
        alert(data.error || "Erreur lors du rejet");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkReject = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Rejeter ${ids.length} demande(s) sélectionnée(s) ?`)) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/super-admin/signup-requests/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", ids }),
      });
      if (res.ok) {
        setSelected(new Set());
        fetchRequests();
      } else {
        const data = await res.json();
        alert(data.error || "Erreur lors du rejet groupé");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleResend = async (id: string) => {
    if (!confirm("Renvoyer l'email de notification ?")) return;
    setResendLoading(id);
    try {
      const res = await fetch(`/api/super-admin/signup-requests/${id}/resend`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResendSuccess((prev) => ({ ...prev, [id]: data.message }));
        setTimeout(() => {
          setResendSuccess((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }, 5000);
      } else {
        alert(data.error || "Erreur lors du renvoi");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setResendLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <Clock className="h-3 w-3" /> En attente
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Approuvée
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
            <XCircle className="h-3 w-3" /> Rejetée
          </span>
        );
      default:
        return null;
    }
  };

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Demandes d&apos;inscription
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez les demandes de nouveaux tenants Meridio
          </p>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {(
          [
            { label: "Total", count: requests.length, color: "#1B3A5C" },
            { label: "En attente", count: pendingCount, color: "#F59E0B" },
            { label: "Approuvées", count: requests.filter((r) => r.status === "APPROVED").length, color: "#10B981" },
            { label: "Rejetées", count: requests.filter((r) => r.status === "REJECTED").length, color: "#EF4444" },
          ] as const
        ).map(({ label, count, color }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>
              {count}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs + bulk actions */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-0">
        <div className="flex gap-2">
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as FilterStatus[]).map((s) => {
            const labels: Record<FilterStatus, string> = {
              ALL: "Toutes",
              PENDING: "En attente",
              APPROVED: "Approuvées",
              REJECTED: "Rejetées",
            };
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  filter === s
                    ? "border-[#1B3A5C] text-[#1B3A5C]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {labels[s]}
                {s === "PENDING" && pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleBulkReject}
            disabled={bulkLoading}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 mb-1"
          >
            {bulkLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Rejeter ({selected.size})
          </button>
        )}
      </div>

      {/* Select all for pending */}
      {pendingIds.length > 1 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={pendingIds.length > 0 && pendingIds.every((id) => selected.has(id))}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C]"
          />
          <span className="text-sm text-gray-500">
            Sélectionner toutes les demandes en attente
          </span>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Aucune demande trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              {/* Summary row */}
              <div className="flex items-center gap-2 p-4">
                {req.status === "PENDING" && (
                  <input
                    type="checkbox"
                    checked={selected.has(req.id)}
                    onChange={() => toggleSelect(req.id)}
                    className="h-4 w-4 rounded border-gray-300 text-[#1B3A5C] focus:ring-[#1B3A5C] shrink-0"
                  />
                )}
                <button
                  onClick={() => toggleExpand(req.id)}
                  className="flex flex-1 items-center gap-4 text-left hover:bg-gray-50 transition-colors rounded-lg -m-1 p-1"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900 truncate">
                        {req.companyName}
                      </span>
                      {statusBadge(req.status)}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {req.email}
                      </span>
                      <span>
                        {req.firstName} {req.lastName}
                      </span>
                      <span className="text-gray-400">
                        {new Date(req.createdAt).toLocaleDateString("fr-CH", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  {expanded.has(req.id) ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Detail panel */}
              {expanded.has(req.id) && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    {/* Contact info */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Contact
                      </h4>
                      <InfoRow icon={Mail} label="Email" value={req.email} />
                      {req.phone && <InfoRow icon={Phone} label="Téléphone" value={req.phone} />}
                      <InfoRow icon={Users} label="Nom" value={`${req.firstName} ${req.lastName || ""}`} />
                      {req.jobTitle && <InfoRow icon={Briefcase} label="Fonction" value={req.jobTitle} />}
                    </div>

                    {/* Company info */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Entreprise
                      </h4>
                      <InfoRow icon={Building2} label="Entreprise" value={req.companyName} />
                      {req.activityDomain && <InfoRow icon={Briefcase} label="Domaine" value={req.activityDomain} />}
                      {req.website && <InfoRow icon={Globe} label="Site web" value={req.website} />}
                      {req.employeeCount && <InfoRow icon={Users} label="Employés" value={req.employeeCount} />}
                    </div>

                    {/* Organization info */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Organisation
                      </h4>
                      {req.orgName && <InfoRow icon={Building2} label="Org" value={req.orgName} />}
                      {req.street && <InfoRow icon={MapPin} label="Adresse" value={req.street} />}
                      {(req.postalCode || req.city) && (
                        <InfoRow icon={MapPin} label="Ville" value={`${req.postalCode || ""} ${req.city || ""}`.trim()} />
                      )}
                      {req.country && <InfoRow icon={Globe} label="Pays" value={req.country} />}
                    </div>

                    {/* Technical info */}
                    {(req.aiNeeds || req.subsidiaryCount) && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Technique
                        </h4>
                        {req.aiNeeds && <InfoRow icon={AlertCircle} label="IA" value={req.aiNeeds} />}
                        {req.subsidiaryCount && <InfoRow icon={Building2} label="Filiales" value={req.subsidiaryCount} />}
                      </div>
                    )}
                  </div>

                  {/* Approve result */}
                  {approveResult[req.id] && (
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <h4 className="font-semibold text-emerald-800 mb-2">
                        Tenant créé avec succès
                      </h4>
                      <div className="space-y-2 text-sm">
                        <p className="text-emerald-700">
                          {approveResult[req.id].message ||
                            `Un email de bienvenue avec un lien de configuration du mot de passe a été envoyé à ${approveResult[req.id].adminUser?.email}.`}
                        </p>
                        <p className="text-emerald-600 text-xs mt-2">
                          L&apos;administrateur recevra un email avec un lien sécurisé pour configurer son mot de passe (valide 24h).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {req.status === "PENDING" && (
                    <div className="mt-4 flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">
                          Notes (optionnel)
                        </label>
                        <input
                          type="text"
                          value={rejectNotes[req.id] || ""}
                          onChange={(e) =>
                            setRejectNotes((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder="Raison du rejet..."
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
                        />
                      </div>
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actionLoading === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approuver
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {actionLoading === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        Rejeter
                      </button>
                    </div>
                  )}

                  {/* Review info for already processed */}
                  {req.status !== "PENDING" && req.reviewedAt && (
                    <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">Traitée le :</span>{" "}
                          {new Date(req.reviewedAt).toLocaleDateString("fr-CH", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {req.reviewNotes && (
                            <p className="mt-1 text-gray-500">Notes : {req.reviewNotes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleResend(req.id)}
                          disabled={resendLoading === req.id}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 shrink-0"
                        >
                          {resendLoading === req.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="h-3.5 w-3.5" />
                          )}
                          Renvoyer l&apos;email
                        </button>
                      </div>
                      {resendSuccess[req.id] && (
                        <p className="mt-2 text-xs text-emerald-600 font-medium">
                          {resendSuccess[req.id]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-gray-400 shrink-0" />
      <span className="text-gray-500 min-w-[80px]">{label} :</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
