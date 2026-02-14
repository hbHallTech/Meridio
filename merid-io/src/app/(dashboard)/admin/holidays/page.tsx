"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";

interface OfficeData {
  id: string;
  name: string;
}

interface HolidayData {
  id: string;
  officeId: string;
  date: string;
  name_fr: string;
  name_en: string | null;
  type: string;
  office: OfficeData | null;
}

interface FormData {
  date: string;
  name_fr: string;
  name_en: string;
  type: string;
  officeId: string;
}

const defaultForm: FormData = {
  date: "",
  name_fr: "",
  name_en: "",
  type: "PUBLIC",
  officeId: "",
};

const typeConfig: Record<string, { label: string; bg: string; text: string }> = {
  PUBLIC: { label: "Public", bg: "bg-blue-100", text: "text-blue-700" },
  RELIGIOUS: { label: "Religieux", bg: "bg-purple-100", text: "text-purple-700" },
  NATIONAL: { label: "National", bg: "bg-amber-100", text: "text-amber-700" },
};

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

export default function AdminHolidaysPage() {
  const { addToast } = useToast();
  const [holidays, setHolidays] = useState<HolidayData[]>([]);
  const [offices, setOffices] = useState<OfficeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HolidayData | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<HolidayData | null>(null);

  const fetchHolidays = useCallback(async (year: number) => {
    try {
      const res = await fetch(`/api/admin/holidays?year=${year}`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setHolidays(data);
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les jours fériés" });
    }
  }, [addToast]);

  const fetchOffices = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/offices");
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setOffices(data.map((o: OfficeData & Record<string, unknown>) => ({ id: o.id, name: o.name })));
    } catch {
      addToast({ type: "error", title: "Erreur", message: "Impossible de charger les bureaux" });
    }
  }, [addToast]);

  useEffect(() => {
    Promise.all([fetchHolidays(selectedYear), fetchOffices()]).finally(() => setLoading(false));
  }, [fetchHolidays, fetchOffices, selectedYear]);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (item: HolidayData) => {
    setEditingItem(item);
    setForm({
      date: new Date(item.date).toISOString().split("T")[0],
      name_fr: item.name_fr,
      name_en: item.name_en || "",
      type: item.type,
      officeId: item.officeId,
    });
    setDialogOpen(true);
  };

  const openDelete = (item: HolidayData) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...(editingItem ? { id: editingItem.id } : {}),
        date: form.date,
        name_fr: form.name_fr,
        name_en: form.name_en || null,
        type: form.type,
        officeId: form.officeId,
      };

      const res = await fetch("/api/admin/holidays", {
        method: editingItem ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(err.error || "Erreur serveur");
      }

      addToast({
        type: "success",
        title: editingItem ? "Jour férié modifié" : "Jour férié créé",
        message: `"${form.name_fr}" a été ${editingItem ? "modifié" : "créé"} avec succès`,
      });
      setDialogOpen(false);
      await fetchHolidays(selectedYear);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/holidays", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingItem.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(err.error || "Erreur serveur");
      }

      addToast({
        type: "success",
        title: "Jour férié supprimé",
        message: `"${deletingItem.name_fr}" a été supprimé`,
      });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      await fetchHolidays(selectedYear);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erreur",
        message: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split("\n");

      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes("date") ? 1 : 0;
      let successCount = 0;
      let errorCount = 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(";");
        if (parts.length < 4) {
          errorCount++;
          continue;
        }

        const [date, nom_fr, nom_en, type, office_id] = parts.map((p) => p.trim());

        try {
          const res = await fetch("/api/admin/holidays", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date,
              name_fr: nom_fr,
              name_en: nom_en || null,
              type: type || "PUBLIC",
              officeId: office_id,
            }),
          });

          if (res.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        addToast({
          type: "success",
          title: "Import CSV terminé",
          message: `${successCount} jour(s) férié(s) importé(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ""}`,
        });
      }
      if (errorCount > 0 && successCount === 0) {
        addToast({
          type: "error",
          title: "Erreur d'import",
          message: `${errorCount} ligne(s) en erreur. Vérifiez le format CSV: date;nom_fr;nom_en;type;office_id`,
        });
      }

      await fetchHolidays(selectedYear);
    } catch {
      addToast({
        type: "error",
        title: "Erreur",
        message: "Impossible de lire le fichier CSV",
      });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Jours fériés</h1>
          <p className="mt-1 text-sm text-gray-500">
            {holidays.length} jour{holidays.length !== 1 ? "s" : ""} férié{holidays.length !== 1 ? "s" : ""} en {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import CSV
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-[#1B3A5C] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#15304d] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Ajouter jour férié
          </button>
        </div>
      </div>

      {/* Year Selector */}
      <div className="flex items-center gap-2">
        {YEARS.map((year) => (
          <button
            key={year}
            onClick={() => handleYearChange(year)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedYear === year
                ? "bg-[#1B3A5C] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {/* Table */}
      {holidays.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun jour férié enregistré pour {selectedYear}.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Date</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Nom FR</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Nom EN</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Type</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Bureau</th>
                  <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {holidays.map((h) => {
                  const d = new Date(h.date);
                  const dateStr = d.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                  const cfg = typeConfig[h.type] ?? {
                    label: h.type,
                    bg: "bg-gray-100",
                    text: "text-gray-700",
                  };
                  return (
                    <tr key={h.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-6 py-4 text-gray-900 capitalize">{dateStr}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">{h.name_fr}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">{h.name_en ?? "—"}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">{h.office?.name ?? "—"}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(h)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDelete(h)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingItem ? "Modifier le jour férié" : "Ajouter un jour férié"}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom FR *</label>
              <input
                type="text"
                value={form.name_fr}
                onChange={(e) => setForm({ ...form, name_fr: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
                placeholder="ex: Fête nationale"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom EN</label>
              <input
                type="text"
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
                placeholder="ex: National Day"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
              >
                <option value="PUBLIC">Public</option>
                <option value="RELIGIOUS">Religieux</option>
                <option value="NATIONAL">National</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bureau *</label>
              <select
                value={form.officeId}
                onChange={(e) => setForm({ ...form, officeId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
              >
                <option value="">Sélectionner un bureau</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingItem ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingItem(null); }}
        onConfirm={handleDelete}
        title="Supprimer le jour férié"
        message={`Êtes-vous sûr de vouloir supprimer "${deletingItem?.name_fr}" du ${deletingItem ? new Date(deletingItem.date).toLocaleDateString("fr-FR") : ""} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        loading={deleting}
      />
    </div>
  );
}
