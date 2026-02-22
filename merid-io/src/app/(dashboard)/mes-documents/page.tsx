"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  FileText,
  Download,
  Eye,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Archive,
  FilePlus,
  ChevronDown,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

// ─── Types ───

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

// Generate year options (current year going back 5 years)
function getYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => String(currentYear - i));
}

// ─── Page Component ───

export default function MesDocumentsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";

  // Data state
  const [data, setData] = useState<DocumentListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [moisFilter, setMoisFilter] = useState("");
  const [anneeFilter, setAnneeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const limit = 20;

  // PDF Viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocumentItem | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  // Module availability
  const [moduleDisabled, setModuleDisabled] = useState(false);

  // Generation
  const [genMenuOpen, setGenMenuOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (typeFilter) p.set("type", typeFilter);
    if (statusFilter) p.set("status", statusFilter);
    if (moisFilter) p.set("mois", moisFilter);
    if (anneeFilter) p.set("annee", anneeFilter);
    if (searchDebounced) p.set("search", searchDebounced);
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
  }, [typeFilter, statusFilter, moisFilter, anneeFilter, searchDebounced, page, addToast, lang]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [typeFilter, statusFilter, moisFilter, anneeFilter, searchDebounced]);

  const clearFilters = () => {
    setTypeFilter("");
    setStatusFilter("");
    setMoisFilter("");
    setAnneeFilter("");
    setSearch("");
  };

  const hasFilters = typeFilter || statusFilter || moisFilter || anneeFilter || search;

  // ─── View document (opens PDF viewer + auto-marks as OUVERT) ───
  const handleView = async (doc: DocumentItem) => {
    setViewerDoc(doc);
    setViewerOpen(true);
    setViewerUrl(null);
    setViewerLoading(true);

    // Fetch PDF as blob for reliable iframe rendering
    try {
      const res = await fetch(`/api/documents/${doc.id}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setViewerUrl(url);
      } else {
        addToast({
          type: "error",
          title: lang === "en" ? "Cannot load document" : "Impossible de charger le document",
        });
      }
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Network error" : "Erreur réseau",
      });
    } finally {
      setViewerLoading(false);
    }

    // Auto-update status NOUVEAU → OUVERT via PATCH
    if (doc.status === "NOUVEAU") {
      try {
        const patchRes = await fetch(`/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "OUVERT" }),
        });
        if (patchRes.ok) {
          setData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              items: prev.items.map((d) =>
                d.id === doc.id ? { ...d, status: "OUVERT" } : d
              ),
            };
          });
        }
      } catch {
        // Silent — status update is best-effort
      }
    }
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerDoc(null);
    if (viewerUrl) {
      URL.revokeObjectURL(viewerUrl);
      setViewerUrl(null);
    }
  };

  // ─── Download single document ───
  const handleDownload = (doc: DocumentItem) => {
    const a = document.createElement("a");
    a.href = `/api/documents/${doc.id}/download?disposition=attachment`;
    a.download = doc.name;
    a.click();
  };

  // ─── Archive document ───
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

  // ─── Generate attestation ───
  const handleGenerate = async (type: "ATTESTATION_TRAVAIL" | "CERTIFICAT_TRAVAIL") => {
    setGenMenuOpen(false);
    setGenerating(true);
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = await res.json();
        addToast({
          type: "success",
          title: lang === "en" ? "Document generated" : "Document généré",
          message: data.document?.name,
        });
        fetchDocuments();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Erreur" });
      }
    } catch {
      addToast({
        type: "error",
        title: lang === "en" ? "Network error" : "Erreur réseau",
      });
    } finally {
      setGenerating(false);
    }
  };

  // ─── Module disabled state ───
  if (moduleDisabled) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <FileText className="h-16 w-16 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-700">
          {lang === "en" ? "Documents module is disabled" : "Le module Documents est désactivé"}
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {lang === "en"
            ? "Contact your administrator to enable this feature."
            : "Contactez votre administrateur pour activer cette fonctionnalité."}
        </p>
      </div>
    );
  }

  // Pagination
  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "My Documents" : "Mes documents"}
          </h1>
          {data && (
            <p className="mt-1 text-sm text-gray-500">
              {data.total} {lang === "en" ? "document(s)" : "document(s)"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Generate attestation dropdown */}
          <div className="relative">
            <button
              onClick={() => setGenMenuOpen(!genMenuOpen)}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#1B3A5C" }}
              aria-haspopup="true"
              aria-expanded={genMenuOpen}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FilePlus className="h-4 w-4" />
              )}
              {lang === "en" ? "Generate" : "Générer"}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {genMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setGenMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => handleGenerate("ATTESTATION_TRAVAIL")}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#8B5CF6" }} />
                    {lang === "en" ? "Work Certificate" : "Attestation de travail"}
                  </button>
                  <button
                    onClick={() => handleGenerate("CERTIFICAT_TRAVAIL")}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#06B6D4" }} />
                    {lang === "en" ? "Employment Certificate" : "Certificat de travail"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "en" ? "Search..." : "Rechercher..."}
              className="rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#1B3A5C] focus:outline-none"
              aria-label={lang === "en" ? "Search documents" : "Rechercher des documents"}
            />
          </div>
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              hasFilters
                ? "border-[#1B3A5C] bg-blue-50 text-[#1B3A5C]"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            aria-expanded={showFilters}
            aria-controls="document-filters"
          >
            <Filter className="h-4 w-4" />
            {lang === "en" ? "Filters" : "Filtres"}
          </button>
          {/* Icon */}
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
          >
            <FileText className="h-5 w-5" style={{ color: "#00BCD4" }} />
          </div>
        </div>
      </div>

      {/* ─── Filters ─── */}
      {showFilters && (
        <div
          id="document-filters"
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
            {/* Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              aria-label={lang === "en" ? "Filter by type" : "Filtrer par type"}
            >
              <option value="">
                {lang === "en" ? "All types" : "Tous les types"}
              </option>
              {Object.entries(DOC_TYPE_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>
                  {lang === "en" ? val.en : val.fr}
                </option>
              ))}
            </select>
            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              aria-label={lang === "en" ? "Filter by status" : "Filtrer par statut"}
            >
              <option value="">
                {lang === "en" ? "All statuses" : "Tous les statuts"}
              </option>
              {Object.entries(DOC_STATUS_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>
                  {lang === "en" ? val.en : val.fr}
                </option>
              ))}
            </select>
            {/* Month */}
            <select
              value={moisFilter}
              onChange={(e) => setMoisFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              aria-label={lang === "en" ? "Filter by month" : "Filtrer par mois"}
            >
              <option value="">
                {lang === "en" ? "All months" : "Tous les mois"}
              </option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {lang === "en" ? m.en : m.fr}
                </option>
              ))}
            </select>
            {/* Year */}
            <select
              value={anneeFilter}
              onChange={(e) => setAnneeFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
              aria-label={lang === "en" ? "Filter by year" : "Filtrer par année"}
            >
              <option value="">
                {lang === "en" ? "All years" : "Toutes les années"}
              </option>
              {getYearOptions().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ─── Table ─── */}
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
                  ? "No documents yet."
                  : "Aucun document pour le moment."}
            </p>
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
                      <tr
                        key={doc.id}
                        className="group hover:bg-gray-50/50 transition-colors"
                      >
                        {/* Name */}
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleView(doc)}
                            className="flex items-center gap-2 text-left hover:underline"
                            title={lang === "en" ? "View document" : "Voir le document"}
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
                        {/* Type */}
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
                        {/* Period */}
                        <td className="hidden whitespace-nowrap px-6 py-4 text-gray-600 sm:table-cell">
                          {period}
                        </td>
                        {/* Date */}
                        <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                          {formatDate(doc.createdAt, lang)}
                        </td>
                        {/* Size */}
                        <td className="hidden whitespace-nowrap px-6 py-4 text-gray-500 md:table-cell">
                          {formatFileSize(doc.fileSize)}
                        </td>
                        {/* Status */}
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusConf.bg} ${statusConf.text}`}
                          >
                            {lang === "en" ? statusConf.en : statusConf.fr}
                          </span>
                        </td>
                        {/* Actions */}
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
                            {doc.status !== "ARCHIVE" && (
                              <button
                                onClick={() => handleArchive(doc)}
                                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                                title={lang === "en" ? "Archive" : "Archiver"}
                                aria-label={`${lang === "en" ? "Archive" : "Archiver"} ${doc.name}`}
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ─── Pagination ─── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
                <p className="text-sm text-gray-500">
                  {lang === "en" ? "Page" : "Page"} {page + 1} / {totalPages}
                  <span className="ml-2 text-gray-400">
                    ({data.total} {lang === "en" ? "total" : "total"})
                  </span>
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

      {/* ─── PDF Viewer Dialog ─── */}
      {viewerDoc && (
        <Dialog
          open={viewerOpen}
          onClose={closeViewer}
          title={viewerDoc.name}
          maxWidth="4xl"
        >
          <div className="flex flex-col gap-4">
            {/* Document info bar */}
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
            {/* PDF viewer */}
            <div className="relative h-[60vh] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              {viewerLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : viewerUrl ? (
                <iframe
                  src={viewerUrl}
                  className="h-full w-full"
                  title={viewerDoc.name}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-gray-400">
                  <FileText className="h-12 w-12" />
                  <p className="mt-2 text-sm">
                    {lang === "en" ? "Unable to load preview" : "Impossible de charger l'aperçu"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
