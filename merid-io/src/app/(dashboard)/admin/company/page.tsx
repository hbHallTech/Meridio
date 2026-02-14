"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Building, MapPin, Save, Users } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";

interface OfficeData {
  id: string;
  name: string;
  country: string;
  city: string;
  _count: { users: number };
}

interface CompanyData {
  id: string;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { offices: number };
  offices: OfficeData[];
}

export default function AdminCompanyPage() {
  const { addToast } = useToast();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/company");
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setCompany(data);
      if (data) {
        setEditName(data.name);
        setEditLogoUrl(data.logoUrl ?? "");
      }
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur de chargement",
        message: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  useEffect(() => {
    fetchCompany().finally(() => setLoading(false));
  }, [fetchCompany]);

  const handleSave = async () => {
    if (!company) return;
    if (!editName.trim()) {
      addToast({ type: "error", title: "Erreur", message: "Le nom de l'entreprise est requis" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: company.id,
          name: editName.trim(),
          logoUrl: editLogoUrl.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      const updated = await res.json();
      setCompany(updated);

      addToast({
        type: "success",
        title: "Entreprise mise à jour",
        message: "Les informations de l'entreprise ont été sauvegardées avec succès",
      });
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur",
        message: e instanceof Error ? e.message : "Erreur lors de la sauvegarde",
      });
    } finally {
      setSaving(false);
    }
  };

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

      {/* Company info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Informations de l&apos;entreprise</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {company._count.offices} bureau{company._count.offices !== 1 ? "x" : ""}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nom de l&apos;entreprise
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              URL du logo
            </label>
            <input
              type="text"
              value={editLogoUrl}
              onChange={(e) => setEditLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-6 pt-2">
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

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      {/* Offices */}
      {company.offices.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Bureaux</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {company.offices.map((office) => (
              <Link
                key={office.id}
                href="/admin/offices"
                className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
                  >
                    <MapPin className="h-5 w-5" style={{ color: "#00BCD4" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{office.name}</p>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {office.city}, {office.country}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      <span>
                        {office._count.users} utilisateur{office._count.users !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
