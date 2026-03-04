"use client";

import { useState, useEffect } from "react";
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

export default function TenantListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
