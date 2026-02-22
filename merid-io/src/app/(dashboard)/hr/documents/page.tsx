"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import {
  Loader2,
  FileText,
  Download,
  Eye,
  Search,
  Filter,
  X,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  Archive,
  Users,
} from "lucide-react";

// ─── Types ───

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  status: string;
  fileSize: number;
  mimeType: string;
  metadata: { mois?: string; annee?: string } | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { firstName: string; lastName: string } | null;
}

interface DocumentListResponse {
  items: DocumentItem[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Constants ───

const DOC_TYPES = [
  "FICHE_PAIE",
  "ATTESTATION_TRAVAIL",
  "CERTIFICAT_TRAVAIL",
  "CONTRAT",
  "AUTRE",
] as const;

const DOC_TYPE_CONFIG: Record<string, { fr: string; en: string; color: string }> = {
  FICHE_PAIE: { fr: "Fiche de paie", en: "Payslip", color: "#3B82F6" },
  ATTESTATION_TRAVAIL: { fr: "Attestation de travail", en: "Work Certificate", color: "#8B5CF6" },
  CERTIFICAT_TRAVAIL: { fr: "Certificat de travail", en: "Employment Certificate", color: "#06B6D4" },
  CONTRAT: { fr: "Contrat", en: "Contract", color: "#F59E0B" },
  AUTRE: { fr: "Autre", en: "Other", color: "#6B7280" },
};

const DOC_STATUS_CONFIG: Record<string, { fr: string; en: string; bg: string; text: string }> = {
  NOUVEAU: { fr: "Nouveau", en: "New", bg: "bg-blue-100", text: "text-blue-700" },
  OUVERT: { fr: "Ouvert", en: "Opened", bg: "bg-green-100", text: "text-green-700" },
  ARCHIVE: { fr: "Archivé", en: "Archived", bg: "bg-gray-100", text: "text-gray-600" },
};

const MONTHS = [
  { value: "01", fr: "Janvier", en: "January" },
  { value: "02", fr: "Février", en: "February" },
  { value: "03", fr: "Mars", en: "March" },
  { value: "04", fr: "Avril", en: "April" },
  { value: "05", fr: "Mai", en: "May" },
  { value: "06", fr: "Juin", en: "June" },
  { value: "07", fr: "Juillet", en: "July" },
  { value: "08", fr: "Août", en: "August" },
  { value: "09", fr: "Septembre", en: "September" },
  { value: "10", fr: "Octobre", en: "October" },
  { value: "11", fr: "Novembre", en: "November" },
  { value: "12", fr: "Décembre", en: "December" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(d: string, lang: string) {
  return new Date(d).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => String(currentYear - i));
}

// ─── Page Component ───

export default function HRDocumentsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  // Employee list + selection
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Documents
  const [data, setData] = useState<DocumentListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [moisFilter, setMoisFilter] = useState("");
  const [anneeFilter, setAnneeFilter] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [docSearchDebounced, setDocSearchDebounced] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 20;

  // CRUD dialogs
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState<string>("FICHE_PAIE");
  const [uploadMois, setUploadMois] = useState("");
  const [uploadAnnee, setUploadAnnee] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit form
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editMois, setEditMois] = useState("");
  const [editAnnee, setEditAnnee] = useState("");

  // Viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocumentItem | null>(null);

  // Module state
  const [moduleDisabled, setModuleDisabled] = useState(false);

  // ─── Fetch employees ───
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const users = await res.json();
          setEmployees(
            users
              .filter((u: { isActive: boolean }) => u.isActive)
              .map((u: { id: string; firstName: string; lastName: string; email: string }) => ({
                id: u.id,
                firstName: u.firstName,
                lastName: u.lastName,
                email: u.email,
              }))
              .sort((a: EmployeeOption, b: EmployeeOption) =>
                `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
              )
          );
        }
      } catch {
        addToast({
          type: "error",
          title: lang === "en" ? "Error loading employees" : "Erreur chargement employés",
        });
      } finally {
        setEmployeesLoading(false);
      }
    })();
  }, [addToast, lang]);

  // ─── Debounce doc search ───
  useEffect(() => {
    const t = setTimeout(() => setDocSearchDebounced(docSearch), 300);
    return () => clearTimeout(t);
  }, [docSearch]);

  // ─── Fetch documents for selected employee ───
  const fetchDocuments = useCallback(async () => {
    if (!selectedEmployeeId) {
      setData(null);
      return;
    }
    setLoading(true);
    const p = new URLSearchParams();
    p.set("userId", selectedEmployeeId);
    if (typeFilter) p.set("type", typeFilter);
    if (statusFilter) p.set("status", statusFilter);
    if (moisFilter) p.set("mois", moisFilter);
    if (anneeFilter) p.set("annee", anneeFilter);
    if (docSearchDebounced) p.set("search", docSearchDebounced);
    p.set("limit", String(limit));
    p.set("offset", String(page * limit));

    try {
      const res = await fetch(`/api/documents?${p.toString()}`);
      if (res.status === 403) {
        const body = await res.json();
        if (body.error?.includes("désactivé")) {
          setModuleDisabled(true);
          return;
        }
      }
      if (res.ok) {
        setData(await res.json());
      } else {
        addToast({
          type: "error",
          title: lang === "en" ? "Load error" : "Erreur de chargement",
        });
      }
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Network error" : "Erreur réseau",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedEmployeeId, typeFilter, statusFilter, moisFilter, anneeFilter, docSearchDebounced, page, addToast, lang]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [typeFilter, statusFilter, moisFilter, anneeFilter, docSearchDebounced]);

  const clearFilters = () => {
    setTypeFilter("");
    setStatusFilter("");
    setMoisFilter("");
    setAnneeFilter("");
    setDocSearch("");
  };
  const hasFilters = typeFilter || statusFilter || moisFilter || anneeFilter || docSearch;

  // ─── Selected employee info ───
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  // ─── Filtered employee dropdown ───
  const filteredEmployees = employeeSearch
    ? employees.filter(
        (e) =>
          `${e.firstName} ${e.lastName} ${e.email}`
            .toLowerCase()
            .includes(employeeSearch.toLowerCase())
      )
    : employees;

  // ─── Upload handler ───
  const handleUpload = async () => {
    if (!uploadFile || !selectedEmployeeId) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("userId", selectedEmployeeId);
      formData.append("name", uploadName || uploadFile.name);
      formData.append("type", uploadType);
      if (uploadMois || uploadAnnee) {
        formData.append(
          "metadata",
          JSON.stringify({
            ...(uploadMois ? { mois: uploadMois } : {}),
            ...(uploadAnnee ? { annee: uploadAnnee } : {}),
          })
        );
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }

      addToast({
        type: "success",
        title: lang === "en" ? "Document uploaded" : "Document téléversé",
      });
      resetUploadForm();
      setUploadOpen(false);
      fetchDocuments();
    } catch (err) {
      addToast({
        type: "error",
        title: lang === "en" ? "Upload error" : "Erreur de téléversement",
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadName("");
    setUploadType("FICHE_PAIE");
    setUploadMois("");
    setUploadAnnee("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Edit handler ───
  const openEdit = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setEditName(doc.name);
    setEditType(doc.type);
    setEditMois(doc.metadata?.mois ?? "");
    setEditAnnee(doc.metadata?.annee ?? "");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedDoc) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      if (editName !== selectedDoc.name) payload.name = editName;
      if (editType !== selectedDoc.type) payload.type = editType;
      const newMeta: Record<string, string> = {};
      if (editMois) newMeta.mois = editMois;
      if (editAnnee) newMeta.annee = editAnnee;
      payload.metadata = newMeta;

      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }

      addToast({
        type: "success",
        title: lang === "en" ? "Document updated" : "Document mis à jour",
      });
      setEditOpen(false);
      setSelectedDoc(null);
      fetchDocuments();
    } catch (err) {
      addToast({
        type: "error",
        title: lang === "en" ? "Update error" : "Erreur de mise à jour",
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete handler ───
  const openDelete = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }
      addToast({
        type: "success",
        title: lang === "en" ? "Document deleted" : "Document supprimé",
      });
      setDeleteOpen(false);
      setSelectedDoc(null);
      fetchDocuments();
    } catch (err) {
      addToast({
        type: "error",
        title: lang === "en" ? "Delete error" : "Erreur de suppression",
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Archive handler ───
  const handleArchive = async (doc: DocumentItem) => {
    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVE" }),
      });
      if (res.ok) {
        addToast({
          type: "success",
          title: lang === "en" ? "Document archived" : "Document archivé",
        });
        fetchDocuments();
      } else {
        const body = await res.json();
        addToast({ type: "error", title: body.error || "Erreur" });
      }
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Network error" : "Erreur réseau",
      });
    }
  };

  // ─── View document ───
  const handleView = (doc: DocumentItem) => {
    setViewerDoc(doc);
    setViewerOpen(true);
  };

  // ─── Download ───
  const handleDownload = (doc: DocumentItem) => {
    const a = document.createElement("a");
    a.href = `/api/documents/${doc.id}/download?disposition=attachment`;
    a.download = doc.name;
    a.click();
  };

  // ─── Module disabled ───
  if (moduleDisabled) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <FileText className="h-16 w-16 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-700">
          {lang === "en" ? "Documents module is disabled" : "Le module Documents est désactivé"}
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {lang === "en"
            ? "Enable it in Company settings."
            : "Activez-le dans les paramètres Entreprise."}
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "HR Document Management" : "Gestion des documents RH"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? "Upload, manage and distribute employee documents"
              : "Téléverser, gérer et distribuer les documents employés"}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
        >
          <FileText className="h-5 w-5" style={{ color: "#00BCD4" }} />
        </div>
      </div>

      {/* ─── Employee selector ─── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <Users className="h-5 w-5 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">
            {lang === "en" ? "Select Employee" : "Sélectionner un employé"}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Search + dropdown */}
          <div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder={lang === "en" ? "Search employee..." : "Rechercher un employé..."}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-[#1B3A5C] focus:outline-none"
                aria-label={lang === "en" ? "Search employee" : "Rechercher un employé"}
              />
            </div>
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                setSelectedEmployeeId(e.target.value);
                setPage(0);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              aria-label={lang === "en" ? "Employee" : "Employé"}
              disabled={employeesLoading}
            >
              <option value="">
                {employeesLoading
                  ? lang === "en"
                    ? "Loading..."
                    : "Chargement..."
                  : lang === "en"
                    ? "-- Select an employee --"
                    : "-- Sélectionner un employé --"}
              </option>
              {filteredEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.lastName} {emp.firstName} — {emp.email}
                </option>
              ))}
            </select>
          </div>
          {/* Summary + Upload button */}
          <div className="flex items-end justify-between gap-3">
            {selectedEmployee && (
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </p>
                <p className="text-gray-400">{selectedEmployee.email}</p>
                {data && (
                  <p className="mt-1">
                    {data.total} {lang === "en" ? "document(s)" : "document(s)"}
                  </p>
                )}
              </div>
            )}
            {selectedEmployeeId && (
              <button
                onClick={() => {
                  resetUploadForm();
                  setUploadOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: "#1B3A5C" }}
              >
                <Plus className="h-4 w-4" />
                {lang === "en" ? "Upload" : "Téléverser"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Documents section (only if employee selected) ─── */}
      {selectedEmployeeId && (
        <>
          {/* ─── Toolbar: search + filters ─── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder={lang === "en" ? "Search documents..." : "Rechercher un document..."}
                className="rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#1B3A5C] focus:outline-none"
                aria-label={lang === "en" ? "Search documents" : "Rechercher des documents"}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                hasFilters
                  ? "border-[#1B3A5C] bg-blue-50 text-[#1B3A5C]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
              aria-expanded={showFilters}
              aria-controls="hr-doc-filters"
            >
              <Filter className="h-4 w-4" />
              {lang === "en" ? "Filters" : "Filtres"}
            </button>
          </div>

          {/* ─── Filters panel ─── */}
          {showFilters && (
            <div
              id="hr-doc-filters"
              className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              role="region"
              aria-label={lang === "en" ? "Document filters" : "Filtres documents"}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  {lang === "en" ? "Filters" : "Filtres"}
                </h3>
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                  >
                    <X className="h-3 w-3" />
                    {lang === "en" ? "Clear all" : "Tout effacer"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
                  aria-label={lang === "en" ? "Filter by type" : "Filtrer par type"}
                >
                  <option value="">{lang === "en" ? "All types" : "Tous les types"}</option>
                  {Object.entries(DOC_TYPE_CONFIG).map(([key, val]) => (
                    <option key={key} value={key}>
                      {lang === "en" ? val.en : val.fr}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
                  aria-label={lang === "en" ? "Filter by status" : "Filtrer par statut"}
                >
                  <option value="">{lang === "en" ? "All statuses" : "Tous les statuts"}</option>
                  {Object.entries(DOC_STATUS_CONFIG).map(([key, val]) => (
                    <option key={key} value={key}>
                      {lang === "en" ? val.en : val.fr}
                    </option>
                  ))}
                </select>
                <select
                  value={moisFilter}
                  onChange={(e) => setMoisFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
                  aria-label={lang === "en" ? "Filter by month" : "Filtrer par mois"}
                >
                  <option value="">{lang === "en" ? "All months" : "Tous les mois"}</option>
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {lang === "en" ? m.en : m.fr}
                    </option>
                  ))}
                </select>
                <select
                  value={anneeFilter}
                  onChange={(e) => setAnneeFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
                  aria-label={lang === "en" ? "Filter by year" : "Filtrer par année"}
                >
                  <option value="">{lang === "en" ? "All years" : "Toutes les années"}</option>
                  {getYearOptions().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ─── Document table ─── */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <FileText className="h-12 w-12 text-gray-300" />
                <p className="mt-3 text-sm text-gray-400">
                  {hasFilters
                    ? lang === "en"
                      ? "No documents match your filters."
                      : "Aucun document ne correspond aux filtres."
                    : lang === "en"
                      ? "No documents for this employee."
                      : "Aucun document pour cet employé."}
                </p>
                <button
                  onClick={() => {
                    resetUploadForm();
                    setUploadOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  {lang === "en" ? "Upload first document" : "Téléverser un premier document"}
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                        <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                          {lang === "en" ? "Name" : "Nom"}
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                          {lang === "en" ? "Type" : "Type"}
                        </th>
                        <th className="hidden whitespace-nowrap px-6 py-3 font-medium text-gray-500 sm:table-cell">
                          {lang === "en" ? "Period" : "Période"}
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                          {lang === "en" ? "Date" : "Date"}
                        </th>
                        <th className="hidden whitespace-nowrap px-6 py-3 font-medium text-gray-500 md:table-cell">
                          {lang === "en" ? "Size" : "Taille"}
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">
                          {lang === "en" ? "Status" : "Statut"}
                        </th>
                        <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-gray-500">
                          {lang === "en" ? "Actions" : "Actions"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.items.map((doc) => {
                        const typeConf = DOC_TYPE_CONFIG[doc.type] ?? {
                          fr: doc.type,
                          en: doc.type,
                          color: "#6B7280",
                        };
                        const statusConf = DOC_STATUS_CONFIG[doc.status] ?? {
                          fr: doc.status,
                          en: doc.status,
                          bg: "bg-gray-100",
                          text: "text-gray-700",
                        };
                        const period =
                          doc.metadata?.mois && doc.metadata?.annee
                            ? `${MONTHS.find((m) => m.value === doc.metadata!.mois)?.[lang === "en" ? "en" : "fr"] ?? doc.metadata.mois} ${doc.metadata.annee}`
                            : doc.metadata?.annee ?? "—";

                        return (
                          <tr key={doc.id} className="group hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <button
                                onClick={() => handleView(doc)}
                                className="flex items-center gap-2 text-left hover:underline"
                              >
                                <FileText
                                  className="h-4 w-4 shrink-0"
                                  style={{ color: typeConf.color }}
                                />
                                <span className="font-medium text-gray-900 truncate max-w-[200px] lg:max-w-[300px]">
                                  {doc.name}
                                </span>
                                {doc.status === "NOUVEAU" && (
                                  <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-blue-500" />
                                )}
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: typeConf.color }}
                                />
                                <span className="text-gray-600">
                                  {lang === "en" ? typeConf.en : typeConf.fr}
                                </span>
                              </div>
                            </td>
                            <td className="hidden whitespace-nowrap px-6 py-4 text-gray-600 sm:table-cell">
                              {period}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                              {formatDate(doc.createdAt, lang)}
                            </td>
                            <td className="hidden whitespace-nowrap px-6 py-4 text-gray-500 md:table-cell">
                              {formatFileSize(doc.fileSize)}
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusConf.bg} ${statusConf.text}`}
                              >
                                {lang === "en" ? statusConf.en : statusConf.fr}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleView(doc)}
                                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                                  title={lang === "en" ? "View" : "Voir"}
                                  aria-label={`${lang === "en" ? "View" : "Voir"} ${doc.name}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDownload(doc)}
                                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600"
                                  title={lang === "en" ? "Download" : "Télécharger"}
                                  aria-label={`${lang === "en" ? "Download" : "Télécharger"} ${doc.name}`}
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => openEdit(doc)}
                                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                                  title={lang === "en" ? "Edit" : "Modifier"}
                                  aria-label={`${lang === "en" ? "Edit" : "Modifier"} ${doc.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                {doc.status !== "ARCHIVE" && (
                                  <button
                                    onClick={() => handleArchive(doc)}
                                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-purple-50 hover:text-purple-600"
                                    title={lang === "en" ? "Archive" : "Archiver"}
                                    aria-label={`${lang === "en" ? "Archive" : "Archiver"} ${doc.name}`}
                                  >
                                    <Archive className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDelete(doc);
                                  }}
                                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                  title={lang === "en" ? "Delete" : "Supprimer"}
                                  aria-label={`${lang === "en" ? "Delete" : "Supprimer"} ${doc.name}`}
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
                    <p className="text-sm text-gray-500">
                      Page {page + 1} / {totalPages}
                      <span className="ml-2 text-gray-400">({data.total} total)</span>
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={lang === "en" ? "Previous page" : "Page précédente"}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={lang === "en" ? "Next page" : "Page suivante"}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ─── No employee selected placeholder ─── */}
      {!selectedEmployeeId && !employeesLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 py-20 text-center">
          <Users className="h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-500">
            {lang === "en"
              ? "Select an employee to manage their documents"
              : "Sélectionnez un employé pour gérer ses documents"}
          </p>
        </div>
      )}

      {/* ═══ Upload Dialog ═══ */}
      <Dialog
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          resetUploadForm();
        }}
        title={lang === "en" ? "Upload Document" : "Téléverser un document"}
        description={
          selectedEmployee
            ? `${lang === "en" ? "For" : "Pour"} ${selectedEmployee.firstName} ${selectedEmployee.lastName}`
            : undefined
        }
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* File input */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {lang === "en" ? "PDF File" : "Fichier PDF"} *
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setUploadFile(file);
                  if (file && !uploadName) {
                    setUploadName(file.name.replace(/\.pdf$/i, ""));
                  }
                }}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-[#1B3A5C] file:px-3 file:py-1 file:text-xs file:font-medium file:text-white focus:border-[#1B3A5C] focus:outline-none"
              />
              {uploadFile && (
                <span className="text-xs text-gray-400">{formatFileSize(uploadFile.size)}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {lang === "en" ? "PDF only, max 10 MB" : "PDF uniquement, max 10 Mo"}
            </p>
          </div>

          {/* Document name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Document Name" : "Nom du document"} *
            </label>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder={lang === "en" ? "e.g., Payslip February 2026" : "ex. Fiche de paie Février 2026"}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Document Type" : "Type de document"} *
            </label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {lang === "en" ? DOC_TYPE_CONFIG[t].en : DOC_TYPE_CONFIG[t].fr}
                </option>
              ))}
            </select>
          </div>

          {/* Period (month + year) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Month" : "Mois"}
              </label>
              <select
                value={uploadMois}
                onChange={(e) => setUploadMois(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              >
                <option value="">{lang === "en" ? "-- Optional --" : "-- Optionnel --"}</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {lang === "en" ? m.en : m.fr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Year" : "Année"}
              </label>
              <select
                value={uploadAnnee}
                onChange={(e) => setUploadAnnee(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              >
                <option value="">{lang === "en" ? "-- Optional --" : "-- Optionnel --"}</option>
                {getYearOptions().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setUploadOpen(false);
                resetUploadForm();
              }}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {lang === "en" ? "Cancel" : "Annuler"}
            </button>
            <button
              onClick={handleUpload}
              disabled={submitting || !uploadFile || !uploadName}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {lang === "en" ? "Upload" : "Téléverser"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* ═══ Edit Dialog ═══ */}
      <Dialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setSelectedDoc(null);
        }}
        title={lang === "en" ? "Edit Document" : "Modifier le document"}
        description={selectedDoc?.name}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Document Name" : "Nom du document"}
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {lang === "en" ? "Document Type" : "Type de document"}
            </label>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {lang === "en" ? DOC_TYPE_CONFIG[t].en : DOC_TYPE_CONFIG[t].fr}
                </option>
              ))}
            </select>
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Month" : "Mois"}
              </label>
              <select
                value={editMois}
                onChange={(e) => setEditMois(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              >
                <option value="">{lang === "en" ? "-- None --" : "-- Aucun --"}</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {lang === "en" ? m.en : m.fr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {lang === "en" ? "Year" : "Année"}
              </label>
              <select
                value={editAnnee}
                onChange={(e) => setEditAnnee(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              >
                <option value="">{lang === "en" ? "-- None --" : "-- Aucun --"}</option>
                {getYearOptions().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEditOpen(false);
                setSelectedDoc(null);
              }}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {lang === "en" ? "Cancel" : "Annuler"}
            </button>
            <button
              onClick={handleEdit}
              disabled={submitting || !editName}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "en" ? "Save" : "Enregistrer"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* ═══ Delete Confirm Dialog ═══ */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedDoc(null);
        }}
        onConfirm={handleDelete}
        title={lang === "en" ? "Delete Document" : "Supprimer le document"}
        message={
          selectedDoc
            ? lang === "en"
              ? `Are you sure you want to delete "${selectedDoc.name}"? This action cannot be undone.`
              : `Êtes-vous sûr de vouloir supprimer "${selectedDoc.name}" ? Cette action est irréversible.`
            : ""
        }
        confirmLabel={lang === "en" ? "Delete" : "Supprimer"}
        loading={submitting}
      />

      {/* ═══ PDF Viewer Dialog ═══ */}
      {viewerDoc && (
        <Dialog
          open={viewerOpen}
          onClose={() => {
            setViewerOpen(false);
            setViewerDoc(null);
          }}
          title={viewerDoc.name}
          maxWidth="4xl"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2.5">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>
                  {lang === "en"
                    ? DOC_TYPE_CONFIG[viewerDoc.type]?.en
                    : DOC_TYPE_CONFIG[viewerDoc.type]?.fr}
                </span>
                <span className="text-gray-300">|</span>
                <span>{formatFileSize(viewerDoc.fileSize)}</span>
                <span className="text-gray-300">|</span>
                <span>{formatDate(viewerDoc.createdAt, lang)}</span>
              </div>
              <button
                onClick={() => handleDownload(viewerDoc)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#1B3A5C" }}
              >
                <Download className="h-3.5 w-3.5" />
                {lang === "en" ? "Download" : "Télécharger"}
              </button>
            </div>
            <div className="relative h-[60vh] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              <iframe
                src={`/api/documents/${viewerDoc.id}/download`}
                className="h-full w-full"
                title={viewerDoc.name}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
