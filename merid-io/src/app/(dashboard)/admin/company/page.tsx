"use client";

import { useEffect, useState } from "react";
import { Loader2, Building, MapPin } from "lucide-react";

interface CompanyData {
  id: string;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { offices: number };
  offices: {
    id: string;
    name: string;
    country: string;
    city: string;
  }[];
}

export default function AdminCompanyPage() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCompany(d))
      .catch(() => setCompany(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paramètres entreprise</h1>
            <p className="mt-1 text-sm text-gray-500">Configuration de l&apos;entreprise</p>
          </div>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
          >
            <Building className="h-5 w-5" style={{ color: "#1B3A5C" }} />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucune entreprise configurée.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres entreprise</h1>
          <p className="mt-1 text-sm text-gray-500">Configuration de l&apos;entreprise</p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
        >
          <Building className="h-5 w-5" style={{ color: "#1B3A5C" }} />
        </div>
      </div>

      {/* Company card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {company._count.offices} bureau{company._count.offices !== 1 ? "x" : ""}
            </p>
          </div>
        </div>

        {/* Dates */}
        <div className="mt-5 flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500">Créé le</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900">
              {new Date(company.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Mis à jour le</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900">
              {new Date(company.updatedAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Offices */}
      {company.offices.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Bureaux</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {company.offices.map((office) => (
              <div
                key={office.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
                  >
                    <MapPin className="h-5 w-5" style={{ color: "#00BCD4" }} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{office.name}</p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {office.city}, {office.country}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
