"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Building, MapPin, Save, Users, Upload, Trash2, Globe } from "lucide-react";
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
  websiteUrl: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { offices: number };
  offices: OfficeData[];
}

export default function AdminCompanyPage() {
  const { addToast } = useToast();
  const pathname = usePathname();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/company", { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      setCompany(data);
      if (data) {
        setEditName(data.name);
        setEditWebsiteUrl(data.websiteUrl ?? "");
        setLogoPreview(data.logoUrl);
      }
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur de chargement",
        message: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  }, [addToast]);

  // Refetch when navigating back to this page
  useEffect(() => {
    fetchCompany().finally(() => setLoading(false));
  }, [fetchCompany, pathname]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: "error", title: "Erreur", message: "Fichier trop volumineux (max 2Mo)" });
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      addToast({ type: "error", title: "Erreur", message: "Format invalide. Utilisez JPG, PNG, WebP ou SVG." });
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      formData.append("companyId", company.id);

      const res = await fetch("/api/admin/company/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      const data = await res.json();
      setLogoPreview(data.logoUrl);
      setCompany((prev) => prev ? { ...prev, logoUrl: data.logoUrl } : prev);

      addToast({
        type: "success",
        title: "Logo mis à jour",
        message: "Le logo de l'entreprise a été mis à jour avec succès",
      });
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur",
        message: e instanceof Error ? e.message : "Erreur lors de l'upload",
      });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    if (!company) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: company.id, logoUrl: "" }),
      });
      if (!res.ok) throw new Error("Erreur lors de la suppression du logo");

      setLogoPreview(null);
      setCompany((prev) => prev ? { ...prev, logoUrl: null } : prev);
      addToast({ type: "success", title: "Logo supprimé", message: "Le logo a été supprimé" });
    } catch (e) {
      addToast({
        type: "error",
        title: "Erreur",
        message: e instanceof Error ? e.message : "Erreur",
      });
    } finally {
      setSaving(false);
    }
  };

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
          websiteUrl: editWebsiteUrl.trim(),
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
        {/* Logo section */}
        <div className="flex items-start gap-5 mb-6">
          <div className="relative group">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt={company.name}
                className="h-20 w-20 rounded-xl object-contain border border-gray-200 bg-white p-1"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-xl text-2xl font-bold text-white"
                style={{ backgroundColor: "#1B3A5C" }}
              >
                {company.name.charAt(0).toUpperCase()}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Informations de l&apos;entreprise</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {company._count.offices} bureau{company._count.offices !== 1 ? "x" : ""}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploadingLogo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {logoPreview ? "Changer le logo" : "Ajouter un logo"}
              </button>
              {logoPreview && (
                <button
                  onClick={handleRemoveLogo}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">JPG, PNG, WebP ou SVG. Max 2Mo.</p>
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

          {/* Website URL */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Site web
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={editWebsiteUrl}
                onChange={(e) => setEditWebsiteUrl(e.target.value)}
                placeholder="https://www.halley-technologies.ch"
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
              />
            </div>
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
