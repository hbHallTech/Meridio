"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { officeSchema, type OfficeInput } from "@/lib/validators";

interface CompanyData {
  id: string;
  name: string;
}

interface OfficeData {
  id: string;
  name: string;
  country: string;
  city: string;
  companyId: string;
  defaultAnnualLeave: number;
  defaultOfferedDays: number;
  maxCarryOverDays: number;
  minNoticeDays: number;
  carryOverDeadline: string;
  probationMonths: number;
  sickLeaveJustifFromDay: number;
  workingDays: string[];
  createdAt: string;
  company: { name: string } | null;
  _count: { users: number; teams: number };
}

const ALL_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const dayLabels: Record<string, string> = {
  MON: "Lun",
  TUE: "Mar",
  WED: "Mer",
  THU: "Jeu",
  FRI: "Ven",
  SAT: "Sam",
  SUN: "Dim",
};

const defaultValues: OfficeInput = {
  name: "",
  country: "CH",
  city: "",
  companyId: "",
  defaultAnnualLeave: 25,
  defaultOfferedDays: 0,
  minNoticeDays: 2,
  maxCarryOverDays: 10,
  carryOverDeadline: "03-31",
  probationMonths: 3,
  sickLeaveJustifFromDay: 2,
  workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
};

export default function AdminOfficesPage() {
  const { addToast } = useToast();
  const [offices, setOffices] = useState<OfficeData[]>([]);
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<OfficeData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingOffice, setDeletingOffice] = useState<OfficeData | null>(null);

  // Working days managed separately since react-hook-form checkboxes need manual handling
  const [workingDays, setWorkingDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OfficeInput>({
    resolver: zodResolver(officeSchema),
    defaultValues,
  });

  const fetchOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/offices");
      if (!res.ok) throw new Error("Erreur de chargement des bureaux");
      const data = await res.json();
      setOffices(data);
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les bureaux" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/company");
      if (!res.ok) throw new Error("Erreur de chargement des entreprises");
      const data = await res.json();
      // API may return array or single object
      setCompanies(Array.isArray(data) ? data : [data]);
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les entreprises" });
    }
  }, [addToast]);

  useEffect(() => {
    fetchOffices();
    fetchCompanies();
  }, [fetchOffices, fetchCompanies]);

  function openCreateDialog() {
    setEditingOffice(null);
    reset(defaultValues);
    setWorkingDays(["MON", "TUE", "WED", "THU", "FRI"]);
    setDialogOpen(true);
  }

  function openEditDialog(office: OfficeData) {
    setEditingOffice(office);
    reset({
      name: office.name,
      country: office.country,
      city: office.city,
      companyId: office.companyId,
      defaultAnnualLeave: office.defaultAnnualLeave,
      defaultOfferedDays: office.defaultOfferedDays,
      minNoticeDays: office.minNoticeDays,
      maxCarryOverDays: office.maxCarryOverDays,
      carryOverDeadline: office.carryOverDeadline,
      probationMonths: office.probationMonths,
      sickLeaveJustifFromDay: office.sickLeaveJustifFromDay,
      workingDays: office.workingDays,
    });
    setWorkingDays(office.workingDays);
    setDialogOpen(true);
  }

  function openDeleteDialog(office: OfficeData) {
    setDeletingOffice(office);
    setConfirmOpen(true);
  }

  function toggleWorkingDay(day: string) {
    setWorkingDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      setValue("workingDays", next, { shouldValidate: true });
      return next;
    });
  }

  async function onSubmit(data: OfficeInput) {
    setSaving(true);
    try {
      const payload = { ...data, workingDays };
      const isEdit = !!editingOffice;
      const res = await fetch("/api/admin/offices", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: editingOffice.id, ...payload } : payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        throw new Error(err.error || "Erreur inconnue");
      }

      addToast({
        type: "success",
        title: isEdit ? "Bureau mis à jour" : "Bureau créé",
        message: `Le bureau "${data.name}" a été ${isEdit ? "mis à jour" : "créé"} avec succès.`,
      });
      setDialogOpen(false);
      await fetchOffices();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingOffice) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/offices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingOffice.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        throw new Error(err.error || "Erreur inconnue");
      }

      addToast({
        type: "success",
        title: "Bureau supprimé",
        message: `Le bureau "${deletingOffice.name}" a été supprimé.`,
      });
      setConfirmOpen(false);
      setDeletingOffice(null);
      await fetchOffices();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Impossible de supprimer le bureau",
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des bureaux</h1>
          <p className="mt-1 text-sm text-gray-500">
            {offices.length} bureau{offices.length !== 1 ? "x" : ""} enregistr&eacute;{offices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau bureau
        </button>
      </div>

      {/* Cards */}
      {offices.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun bureau trouv&eacute;.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {offices.map((office) => (
            <div
              key={office.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
              onClick={() => openEditDialog(office)}
            >
              {/* Office header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{office.name}</h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {office.city}, {office.country}
                    {office.company && (
                      <span className="ml-2 text-gray-400">— {office.company.name}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(office);
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(office);
                    }}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
                  >
                    <Building2 className="h-5 w-5" style={{ color: "#00BCD4" }} />
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Cong&eacute; annuel</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{office.defaultAnnualLeave}j</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Jours offerts</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{office.defaultOfferedDays}j</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Report max</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{office.maxCarryOverDays}j</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">P&eacute;riode d&apos;essai</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{office.probationMonths} mois</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Pr&eacute;avis min</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{office.minNoticeDays}j</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">&Eacute;quipes</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{office._count.teams}</p>
                </div>
              </div>

              {/* Working days */}
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Jours ouvr&eacute;s :</span>
                <div className="flex gap-1">
                  {office.workingDays.map((day) => (
                    <span
                      key={day}
                      className="inline-flex rounded px-2 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: "rgba(27,58,92,0.1)", color: "#1B3A5C" }}
                    >
                      {dayLabels[day] ?? day}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingOffice ? "Modifier le bureau" : "Nouveau bureau"}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              {...register("name")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              placeholder="Bureau de Gen&egrave;ve"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          {/* Pays & Ville */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
              <select
                {...register("country")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              >
                <option value="CH">Suisse (CH)</option>
                <option value="TN">Tunisie (TN)</option>
              </select>
              {errors.country && <p className="mt-1 text-xs text-red-600">{errors.country.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input
                {...register("city")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
                placeholder="Gen&egrave;ve"
              />
              {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city.message}</p>}
            </div>
          </div>

          {/* Entreprise */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
            <select
              {...register("companyId")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
            >
              <option value="">S&eacute;lectionner une entreprise</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.companyId && <p className="mt-1 text-xs text-red-600">{errors.companyId.message}</p>}
          </div>

          {/* Numeric fields grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cong&eacute; annuel</label>
              <input
                type="number"
                {...register("defaultAnnualLeave", { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
              {errors.defaultAnnualLeave && <p className="mt-1 text-xs text-red-600">{errors.defaultAnnualLeave.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jours offerts</label>
              <input
                type="number"
                {...register("defaultOfferedDays", { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
              {errors.defaultOfferedDays && <p className="mt-1 text-xs text-red-600">{errors.defaultOfferedDays.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report max</label>
              <input
                type="number"
                {...register("maxCarryOverDays", { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
              {errors.maxCarryOverDays && <p className="mt-1 text-xs text-red-600">{errors.maxCarryOverDays.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pr&eacute;avis min (jours)</label>
              <input
                type="number"
                {...register("minNoticeDays", { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
              {errors.minNoticeDays && <p className="mt-1 text-xs text-red-600">{errors.minNoticeDays.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">P&eacute;riode essai (mois)</label>
              <input
                type="number"
                {...register("probationMonths", { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
              {errors.probationMonths && <p className="mt-1 text-xs text-red-600">{errors.probationMonths.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Justif maladie (jour)</label>
              <input
                type="number"
                {...register("sickLeaveJustifFromDay", { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              />
              {errors.sickLeaveJustifFromDay && <p className="mt-1 text-xs text-red-600">{errors.sickLeaveJustifFromDay.message}</p>}
            </div>
          </div>

          {/* Deadline report */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deadline report (MM-JJ)</label>
            <input
              {...register("carryOverDeadline")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]"
              placeholder="03-31"
            />
            {errors.carryOverDeadline && <p className="mt-1 text-xs text-red-600">{errors.carryOverDeadline.message}</p>}
          </div>

          {/* Working days checkboxes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jours ouvr&eacute;s</label>
            <div className="flex flex-wrap gap-3">
              {ALL_DAYS.map((day) => (
                <label
                  key={day}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    workingDays.includes(day)
                      ? "border-[#1B3A5C] bg-[#1B3A5C]/5 text-[#1B3A5C] font-medium"
                      : "border-gray-300 text-gray-500 hover:border-gray-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={workingDays.includes(day)}
                    onChange={() => toggleWorkingDay(day)}
                    className="sr-only"
                  />
                  {dayLabels[day]}
                </label>
              ))}
            </div>
            {errors.workingDays && <p className="mt-1 text-xs text-red-600">{errors.workingDays.message}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingOffice ? "Enregistrer" : "Cr\u00e9er"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDeletingOffice(null);
        }}
        onConfirm={handleDelete}
        title="Supprimer le bureau"
        message={`\u00cates-vous s\u00fbr de vouloir supprimer le bureau "${deletingOffice?.name}" ? Cette action est irr\u00e9versible.`}
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}
