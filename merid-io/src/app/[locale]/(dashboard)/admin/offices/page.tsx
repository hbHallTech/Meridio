"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  Building2,
  MapPin,
  Users,
  Calendar,
  Eye,
  Plus,
  X,
} from "lucide-react";

interface OfficeRow {
  id: string;
  name: string;
  country: string;
  city: string;
  defaultAnnualLeave: number;
  defaultOfferedDays: number;
  workingDays: string[];
  company: { id: string; name: string };
  _count: { users: number; teams: number };
}

const DAY_LABELS: Record<string, string> = {
  MON: "Lun", TUE: "Mar", WED: "Mer", THU: "Jeu", FRI: "Ven", SAT: "Sam", SUN: "Dim",
};

const DAY_LABELS_EN: Record<string, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun",
};

export default function AdminOfficesPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const router = useRouter();
  const lang = useLocale();

  const [offices, setOffices] = useState<OfficeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    country: "",
    city: "",
    companyId: "",
  });
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  const fetchOffices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/offices");
      if (res.ok) {
        const data = await res.json();
        setOffices(data.offices);
        const seen = new Map<string, string>();
        for (const o of data.offices) {
          if (o.company) seen.set(o.company.id, o.company.name);
        }
        setCompanies(Array.from(seen, ([id, name]) => ({ id, name })));
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error loading offices" : "Erreur de chargement" });
    } finally {
      setLoading(false);
    }
  }, [addToast, lang]);

  useEffect(() => {
    fetchOffices();
  }, [fetchOffices]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.country.trim() || !createForm.city.trim() || !createForm.companyId) {
      addToast({ type: "error", title: lang === "en" ? "Fill all required fields" : "Remplissez tous les champs obligatoires" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        const office = await res.json();
        addToast({ type: "success", title: lang === "en" ? "Office created" : "Bureau créé" });
        setShowCreate(false);
        setCreateForm({ name: "", country: "", city: "", companyId: "" });
        router.push(`/admin/offices/${office.id}`);
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const daysLabel = lang === "en" ? DAY_LABELS_EN : DAY_LABELS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Office Management" : "Gestion des bureaux"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? `${offices.length} office${offices.length > 1 ? "s" : ""}`
              : `${offices.length} bureau${offices.length > 1 ? "x" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#15304D] transition-colors"
        >
          <Plus className="h-4 w-4" />
          {lang === "en" ? "New office" : "Nouveau bureau"}
        </button>
      </div>

      {/* Office cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {offices.map((office) => (
          <div
            key={office.id}
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(`/admin/offices/${office.id}`)}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{office.name}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {office.city}, {office.country}
                </p>
              </div>
              <button className="rounded-lg p-1.5 text-gray-400 group-hover:bg-gray-100 group-hover:text-[#1B3A5C] transition-colors">
                <Eye className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="h-4 w-4 text-gray-400" />
                <span>{office._count.users} {lang === "en" ? "users" : "utilisateurs"}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span>{office._count.teams} {lang === "en" ? "teams" : "équipes"}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>{office.defaultAnnualLeave}j {lang === "en" ? "annual" : "annuels"}</span>
              </div>
              {office.defaultOfferedDays > 0 && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4 text-cyan-400" />
                  <span>{office.defaultOfferedDays}j {lang === "en" ? "offered" : "offerts"}</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {office.workingDays.map((d) => (
                <span
                  key={d}
                  className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600"
                >
                  {daysLabel[d] ?? d}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {offices.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-2 text-gray-500">{lang === "en" ? "No offices configured" : "Aucun bureau configuré"}</p>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {lang === "en" ? "New office" : "Nouveau bureau"}
              </h2>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Name *" : "Nom *"}
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder={lang === "en" ? "e.g. Geneva Office" : "ex. Bureau de Genève"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "Country *" : "Pays *"}
                  </label>
                  <input
                    type="text"
                    value={createForm.country}
                    onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })}
                    placeholder="CH"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {lang === "en" ? "City *" : "Ville *"}
                  </label>
                  <input
                    type="text"
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    placeholder={lang === "en" ? "Geneva" : "Genève"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {lang === "en" ? "Company *" : "Entreprise *"}
                </label>
                <select
                  value={createForm.companyId}
                  onChange={(e) => setCreateForm({ ...createForm, companyId: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                  required
                >
                  <option value="">{lang === "en" ? "Select…" : "Sélectionner…"}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {lang === "en" ? "Cancel" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304D] disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {lang === "en" ? "Create & configure" : "Créer & configurer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
