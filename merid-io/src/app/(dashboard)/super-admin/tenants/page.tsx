"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Users,
  Search,
  Globe,
  MapPin,
  Loader2,
  ExternalLink,
  Clock,
  UserCheck,
  UserCog,
  X,
  Eye,
  AlertTriangle,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  city: string | null;
  country: string;
  websiteUrl: string | null;
  createdAt: string;
  officeCount: number;
  userCount: number;
  activeUserCount: number;
  lastActivity: string | null;
  offices: { id: string; name: string; city: string; userCount: number }[];
}

interface ImpersonateModal {
  tenant: Tenant;
  readOnly: boolean;
}

export default function TenantListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [impersonateModal, setImpersonateModal] = useState<ImpersonateModal | null>(null);
  const [impersonateLoading, setImpersonateLoading] = useState(false);

  useEffect(() => {
    async function fetchTenants() {
      setLoading(true);
      try {
        const params = search ? `?search=${encodeURIComponent(search)}` : "";
        const res = await fetch(`/api/super-admin/tenants${params}`);
        if (res.ok) setTenants(await res.json());
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchTenants, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search]);

  const handleImpersonate = useCallback(async () => {
    if (!impersonateModal) return;
    setImpersonateLoading(true);

    try {
      const res = await fetch("/api/super-admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: impersonateModal.tenant.id,
          readOnly: impersonateModal.readOnly,
        }),
      });

      const data = await res.json();
      if (res.ok && data.impersonateUrl) {
        // Redirect to the impersonation URL in a new tab
        window.open(data.impersonateUrl, "_blank");
        setImpersonateModal(null);
      } else {
        alert(data.error || "Erreur lors de l'impersonation");
      }
    } catch {
      alert("Erreur réseau");
    } finally {
      setImpersonateLoading(false);
    }
  }, [impersonateModal]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tenants.length} organisation(s) sur la plateforme
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un tenant..."
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">Aucun tenant trouvé</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-5 py-3 font-semibold text-gray-600">Organisation</th>
                  <th className="px-5 py-3 font-semibold text-gray-600">Localisation</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 text-center">Bureaux</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 text-center">Utilisateurs</th>
                  <th className="px-5 py-3 font-semibold text-gray-600">Dernière activité</th>
                  <th className="px-5 py-3 font-semibold text-gray-600">Créé le</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1B3A5C]/10 text-[#1B3A5C] font-bold text-sm">
                          {tenant.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{tenant.name}</p>
                          {tenant.websiteUrl && (
                            <a
                              href={tenant.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1B3A5C]"
                            >
                              <Globe className="h-3 w-3" />
                              {tenant.websiteUrl.replace(/^https?:\/\//, "")}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 text-gray-600">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        {tenant.city || "-"}, {tenant.country}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        <Building2 className="h-3 w-3" />
                        {tenant.officeCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <UserCheck className="h-3 w-3" />
                          {tenant.activeUserCount}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          <Users className="h-3 w-3" />
                          {tenant.userCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {tenant.lastActivity ? (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          {new Date(tenant.lastActivity).toLocaleDateString("fr-CH", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(tenant.createdAt).toLocaleDateString("fr-CH", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setImpersonateModal({ tenant, readOnly: false })}
                          title="Impersonner (lecture/écriture)"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                        >
                          <UserCog className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setImpersonateModal({ tenant, readOnly: true })}
                          title="Impersonner (lecture seule)"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Impersonation confirmation modal */}
      {impersonateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Impersonation
                </h3>
              </div>
              <button
                onClick={() => setImpersonateModal(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Vous êtes sur le point d&apos;impersonner le tenant :
              </p>
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="font-semibold text-gray-900">
                  {impersonateModal.tenant.name}
                </p>
                <p className="text-sm text-gray-500">
                  {impersonateModal.tenant.userCount} utilisateur(s) &middot;{" "}
                  {impersonateModal.tenant.officeCount} bureau(x)
                </p>
              </div>

              <div className={`rounded-lg p-3 text-sm ${
                impersonateModal.readOnly
                  ? "bg-blue-50 border border-blue-200 text-blue-800"
                  : "bg-amber-50 border border-amber-200 text-amber-800"
              }`}>
                {impersonateModal.readOnly ? (
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 shrink-0" />
                    <span>Mode <strong>lecture seule</strong> — aucune modification possible</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Mode <strong>lecture/écriture</strong> — les modifications affecteront le tenant</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500">
                Cette action est journalisée. Un onglet s&apos;ouvrira avec la session du tenant.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setImpersonateModal(null)}
                disabled={impersonateLoading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleImpersonate}
                disabled={impersonateLoading}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  impersonateModal.readOnly
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {impersonateLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCog className="h-4 w-4" />
                )}
                Impersonner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
