"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  ArrowLeft,
  Mail,
  Building2,
  Users,
  Calendar,
  Shield,
  Clock,
  FileText,
  History,
} from "lucide-react";

// ─── Types ───

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  isActive: boolean;
  hireDate: string;
  language: string;
  profilePictureUrl: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
  office: { id: string; name: string; city: string } | null;
  team: { id: string; name: string } | null;
  managedTeam: { id: string; name: string } | null;
}

interface Balance {
  id: string;
  balanceType: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  carriedOverDays: number;
  year: number;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  reason: string | null;
  createdAt: string;
  leaveTypeConfig: {
    code: string;
    label_fr: string;
    label_en: string;
    color: string;
  };
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
  user: { firstName: string; lastName: string };
}

const ROLE_COLORS: Record<string, string> = {
  EMPLOYEE: "bg-gray-100 text-gray-700",
  MANAGER: "bg-blue-100 text-blue-700",
  HR: "bg-purple-100 text-purple-700",
  ADMIN: "bg-red-100 text-red-700",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_MANAGER: "bg-amber-100 text-amber-700",
  PENDING_HR: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-700",
  REFUSED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  RETURNED: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS_FR: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_MANAGER: "En attente Manager",
  PENDING_HR: "En attente RH",
  APPROVED: "Approuvé",
  REFUSED: "Refusé",
  CANCELLED: "Annulé",
  RETURNED: "Renvoyé",
};

const STATUS_LABELS_EN: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_MANAGER: "Pending Manager",
  PENDING_HR: "Pending HR",
  APPROVED: "Approved",
  REFUSED: "Refused",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

const ACTION_LABELS_FR: Record<string, string> = {
  USER_CREATED: "Utilisateur créé",
  USER_UPDATED: "Utilisateur modifié",
  USER_DEACTIVATED: "Utilisateur désactivé",
  USER_REACTIVATED: "Utilisateur réactivé",
  LEAVE_SUBMITTED: "Demande soumise",
  LEAVE_APPROVED: "Demande approuvée",
  LEAVE_REFUSED: "Demande refusée",
  LEAVE_CANCELLED: "Demande annulée",
  LEAVE_RETURNED: "Demande renvoyée",
  BALANCE_ADJUSTED: "Solde ajusté",
  DELEGATION_CREATED: "Délégation créée",
  DELEGATION_CANCELLED: "Délégation annulée",
  PASSWORD_CHANGED: "Mot de passe modifié",
};

const ACTION_LABELS_EN: Record<string, string> = {
  USER_CREATED: "User created",
  USER_UPDATED: "User updated",
  USER_DEACTIVATED: "User deactivated",
  USER_REACTIVATED: "User reactivated",
  LEAVE_SUBMITTED: "Leave submitted",
  LEAVE_APPROVED: "Leave approved",
  LEAVE_REFUSED: "Leave refused",
  LEAVE_CANCELLED: "Leave cancelled",
  LEAVE_RETURNED: "Leave returned",
  BALANCE_ADJUSTED: "Balance adjusted",
  DELEGATION_CREATED: "Delegation created",
  DELEGATION_CANCELLED: "Delegation cancelled",
  PASSWORD_CHANGED: "Password changed",
};

// ─── Component ───

export default function UserProfilePage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const lang = session?.user?.language ?? "fr";

  const [user, setUser] = useState<UserProfile | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"info" | "balances" | "leaves" | "audit">("info");

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setBalances(data.balances);
        setLeaveRequests(data.leaveRequests);
        setAuditLogs(data.auditLogs);
      } else {
        addToast({ type: "error", title: lang === "en" ? "User not found" : "Utilisateur non trouvé" });
        router.push("/admin/users");
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setLoading(false);
    }
  }, [userId, addToast, lang, router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return lang === "en"
      ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const fmtDateTime = (d: string) => {
    const date = new Date(d);
    return lang === "en"
      ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) return null;

  const annualBalance = balances.find((b) => b.balanceType === "ANNUAL");
  const offeredBalance = balances.find((b) => b.balanceType === "OFFERED");

  const tabs = [
    { key: "info" as const, label: lang === "en" ? "Personal Info" : "Infos personnelles", icon: FileText },
    { key: "balances" as const, label: lang === "en" ? "Balances" : "Soldes", icon: Calendar },
    { key: "leaves" as const, label: lang === "en" ? "Leave History" : "Historique congés", icon: Clock },
    { key: "audit" as const, label: lang === "en" ? "Audit Log" : "Journal d'audit", icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Back button + Header */}
      <div>
        <button
          onClick={() => router.push("/admin/users")}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "en" ? "Back to users" : "Retour aux utilisateurs"}
        </button>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1B3A5C] text-xl font-bold text-white">
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {user.firstName} {user.lastName}
              </h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`} />
                {user.isActive ? (lang === "en" ? "Active" : "Actif") : (lang === "en" ? "Inactive" : "Inactif")}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">{user.email}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {user.roles.map((r) => (
                <span key={r} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r] ?? "bg-gray-100 text-gray-700"}`}>
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "border-[#1B3A5C] text-[#1B3A5C]"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── Tab: Personal Info ─── */}
      {activeTab === "info" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              {lang === "en" ? "Personal Information" : "Informations personnelles"}
            </h3>
            <dl className="space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <dt className="text-xs font-medium text-gray-500">Email</dt>
                  <dd className="text-sm text-gray-900">{user.email}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <dt className="text-xs font-medium text-gray-500">{lang === "en" ? "Office" : "Bureau"}</dt>
                  <dd className="text-sm text-gray-900">
                    {user.office ? `${user.office.name} — ${user.office.city}` : "—"}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <dt className="text-xs font-medium text-gray-500">{lang === "en" ? "Team" : "Équipe"}</dt>
                  <dd className="text-sm text-gray-900">{user.team?.name ?? "—"}</dd>
                </div>
              </div>
              {user.managedTeam && (
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-4 w-4 text-gray-400" />
                  <div>
                    <dt className="text-xs font-medium text-gray-500">{lang === "en" ? "Manages team" : "Gère l'équipe"}</dt>
                    <dd className="text-sm text-gray-900">{user.managedTeam.name}</dd>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 text-gray-400" />
                <div>
                  <dt className="text-xs font-medium text-gray-500">{lang === "en" ? "Hire date" : "Date d'embauche"}</dt>
                  <dd className="text-sm text-gray-900">{fmtDate(user.hireDate)}</dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              {lang === "en" ? "Account Details" : "Détails du compte"}
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-gray-500">{lang === "en" ? "Language" : "Langue"}</dt>
                <dd className="text-sm text-gray-900">{user.language === "en" ? "English" : "Français"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{lang === "en" ? "Roles" : "Rôles"}</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {user.roles.map((r) => (
                    <span key={r} className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[r]}`}>
                      {r}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{lang === "en" ? "Account created" : "Compte créé"}</dt>
                <dd className="text-sm text-gray-900">{fmtDateTime(user.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{lang === "en" ? "Last password change" : "Dernier changement de mot de passe"}</dt>
                <dd className="text-sm text-gray-900">
                  {user.passwordChangedAt ? fmtDateTime(user.passwordChangedAt) : (lang === "en" ? "Never" : "Jamais")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">{lang === "en" ? "Last updated" : "Dernière modification"}</dt>
                <dd className="text-sm text-gray-900">{fmtDateTime(user.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* ─── Tab: Balances ─── */}
      {activeTab === "balances" && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Annual */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Calendar className="h-4 w-4 text-blue-600" />
              {lang === "en" ? "Annual Leave" : "Congés annuels"} {new Date().getFullYear()}
            </h3>
            {annualBalance ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{lang === "en" ? "Total" : "Total"}</span>
                  <span className="font-semibold text-gray-900">
                    {annualBalance.totalDays + annualBalance.carriedOverDays} {lang === "en" ? "days" : "jours"}
                  </span>
                </div>
                {annualBalance.carriedOverDays > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">{lang === "en" ? "Carried over" : "Reportés"}</span>
                    <span className="text-sm text-gray-600">{annualBalance.carriedOverDays}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{lang === "en" ? "Used" : "Utilisés"}</span>
                  <span className="text-sm text-red-600">{annualBalance.usedDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{lang === "en" ? "Pending" : "En attente"}</span>
                  <span className="text-sm text-amber-600">{annualBalance.pendingDays}</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">{lang === "en" ? "Remaining" : "Restants"}</span>
                    <span className="text-lg font-bold text-green-600">
                      {annualBalance.totalDays + annualBalance.carriedOverDays - annualBalance.usedDays - annualBalance.pendingDays}
                    </span>
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{
                      width: `${Math.min(
                        ((annualBalance.usedDays + annualBalance.pendingDays) /
                          (annualBalance.totalDays + annualBalance.carriedOverDays)) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">{lang === "en" ? "No balance" : "Aucun solde"}</p>
            )}
          </div>

          {/* Offered */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Calendar className="h-4 w-4 text-cyan-600" />
              {lang === "en" ? "Offered Days" : "Jours offerts"} {new Date().getFullYear()}
            </h3>
            {offeredBalance ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{lang === "en" ? "Total" : "Total"}</span>
                  <span className="font-semibold text-gray-900">
                    {offeredBalance.totalDays} {lang === "en" ? "days" : "jours"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{lang === "en" ? "Used" : "Utilisés"}</span>
                  <span className="text-sm text-red-600">{offeredBalance.usedDays}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">{lang === "en" ? "Pending" : "En attente"}</span>
                  <span className="text-sm text-amber-600">{offeredBalance.pendingDays}</span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">{lang === "en" ? "Remaining" : "Restants"}</span>
                    <span className="text-lg font-bold text-green-600">
                      {offeredBalance.totalDays - offeredBalance.usedDays - offeredBalance.pendingDays}
                    </span>
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{
                      width: offeredBalance.totalDays > 0
                        ? `${Math.min(((offeredBalance.usedDays + offeredBalance.pendingDays) / offeredBalance.totalDays) * 100, 100)}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">{lang === "en" ? "No balance" : "Aucun solde"}</p>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab: Leave History ─── */}
      {activeTab === "leaves" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-700">{lang === "en" ? "Type" : "Type"}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">{lang === "en" ? "Period" : "Période"}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">{lang === "en" ? "Days" : "Jours"}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">{lang === "en" ? "Status" : "Statut"}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">{lang === "en" ? "Submitted" : "Soumise le"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaveRequests.map((lr) => (
                  <tr key={lr.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lr.leaveTypeConfig.color }} />
                        <span className="text-gray-900">
                          {lang === "en" ? lr.leaveTypeConfig.label_en : lr.leaveTypeConfig.label_fr}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {fmtDate(lr.startDate)} → {fmtDate(lr.endDate)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{lr.totalDays}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[lr.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {lang === "en" ? STATUS_LABELS_EN[lr.status] ?? lr.status : STATUS_LABELS_FR[lr.status] ?? lr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(lr.createdAt)}</td>
                  </tr>
                ))}
                {leaveRequests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      {lang === "en" ? "No leave requests" : "Aucune demande de congé"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Tab: Audit Log ─── */}
      {activeTab === "audit" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-700">{lang === "en" ? "Date" : "Date"}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">{lang === "en" ? "Action" : "Action"}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">{lang === "en" ? "Performed by" : "Effectué par"}</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">{lang === "en" ? "Details" : "Détails"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {lang === "en"
                          ? ACTION_LABELS_EN[log.action] ?? log.action
                          : ACTION_LABELS_FR[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.user.firstName} {log.user.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {log.newValue && (
                        <span className="font-mono">
                          {Object.entries(log.newValue)
                            .filter(([k]) => !["passwordHash"].includes(k))
                            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                            .join(", ")
                            .slice(0, 100)}
                          {JSON.stringify(log.newValue).length > 100 ? "…" : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                      {lang === "en" ? "No audit entries" : "Aucune entrée d'audit"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
