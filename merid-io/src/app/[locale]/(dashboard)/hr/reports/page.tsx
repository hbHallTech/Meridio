"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { useToast } from "@/components/ui/toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Loader2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
} from "lucide-react";

// ─── Types ───

interface BalanceInfo {
  total: number;
  used: number;
  pending: number;
  remaining: number;
}

interface DaysByType {
  [code: string]: { code: string; label_fr: string; label_en: string; color: string; days: number };
}

interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
  office: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  daysByType: DaysByType;
  totalDaysTaken: number;
  annualBalance: BalanceInfo | null;
  offeredBalance: BalanceInfo | null;
}

interface LeaveTypeInfo {
  id: string;
  code: string;
  label_fr: string;
  label_en: string;
  color: string;
}

interface FilterOption {
  id: string;
  name: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

// ─── Component ───

export default function HRReportsPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = useLocale();

  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeInfo[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
  const [officeOptions, setOfficeOptions] = useState<FilterOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  // Filters
  const [year, setYear] = useState(new Date().getFullYear());
  const [officeFilter, setOfficeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("year", String(year));
      if (officeFilter) params.set("office", officeFilter);
      if (teamFilter) params.set("team", teamFilter);
      if (leaveTypeFilter) params.set("leaveType", leaveTypeFilter);
      if (employeeFilter) params.set("employee", employeeFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/hr/reports?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees);
        setLeaveTypes(data.leaveTypes);
        setAllEmployees(data.allEmployees);
        setOfficeOptions(data.offices);
        setTeamOptions(data.teams);
      }
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Error" : "Erreur" });
    } finally {
      setLoading(false);
    }
  }, [year, officeFilter, teamFilter, leaveTypeFilter, employeeFilter, statusFilter, addToast, lang]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Chart data
  const chartData = employees.map((emp) => {
    const entry: Record<string, string | number> = { name: `${emp.firstName} ${emp.lastName.charAt(0)}.` };
    for (const lt of leaveTypes) { entry[lt.code] = emp.daysByType[lt.code]?.days ?? 0; }
    return entry;
  });

  // Export Excel
  const handleExportExcel = async () => {
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wsData = [
        [
          lang === "en" ? "Employee" : "Employé",
          lang === "en" ? "Office" : "Bureau",
          lang === "en" ? "Team" : "Équipe",
          ...leaveTypes.map((lt) => (lang === "en" ? lt.label_en : lt.label_fr)),
          "Total",
          lang === "en" ? "Annual Balance" : "Solde annuel",
          lang === "en" ? "Offered Balance" : "Solde offert",
        ],
        ...employees.map((emp) => [
          `${emp.firstName} ${emp.lastName}`,
          emp.office?.name ?? "-",
          emp.team?.name ?? "-",
          ...leaveTypes.map((lt) => emp.daysByType[lt.code]?.days ?? 0),
          emp.totalDaysTaken,
          emp.annualBalance ? emp.annualBalance.remaining : "-",
          emp.offeredBalance ? emp.offeredBalance.remaining : "-",
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Rapport RH ${year}`);
      XLSX.writeFile(wb, `rapport-rh-${year}.xlsx`);
      addToast({ type: "success", title: lang === "en" ? "Excel exported" : "Excel exporté" });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Export error" : "Erreur d'export" });
    } finally {
      setExporting(null);
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    setExporting("pdf");
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF("landscape");

      // Header
      doc.setFillColor(27, 58, 92);
      doc.rect(0, 0, 297, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("Halley-Technologies", 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(0, 188, 212);
      doc.text(`Meridio - ${lang === "en" ? "HR Report" : "Rapport RH"} ${year}`, 14, 23);
      doc.setTextColor(0, 0, 0);

      const headers = [
        lang === "en" ? "Employee" : "Employé",
        lang === "en" ? "Office" : "Bureau",
        ...leaveTypes.map((lt) => (lang === "en" ? lt.label_en : lt.label_fr)),
        "Total",
        lang === "en" ? "Annual Bal." : "Solde annuel",
      ];
      const body = employees.map((emp) => [
        `${emp.firstName} ${emp.lastName}`,
        emp.office?.name ?? "-",
        ...leaveTypes.map((lt) => String(emp.daysByType[lt.code]?.days ?? 0)),
        String(emp.totalDaysTaken),
        emp.annualBalance ? String(emp.annualBalance.remaining) : "-",
      ]);

      autoTable(doc, {
        startY: 38,
        head: [headers],
        body,
        headStyles: { fillColor: [27, 58, 92], textColor: [255, 255, 255], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Halley-Technologies SA - ${lang === "en" ? "Generated on" : "Généré le"} ${new Date().toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")}`, 14, 200);
        doc.text(`${i}/${pageCount}`, 283, 200);
      }

      doc.save(`rapport-rh-${year}.pdf`);
      addToast({ type: "success", title: lang === "en" ? "PDF exported" : "PDF exporté" });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Export error" : "Erreur d'export" });
    } finally {
      setExporting(null);
    }
  };

  // Individual employee report
  const handleEmployeeReport = async (emp: EmployeeSummary) => {
    setExporting(emp.id);
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();

      doc.setFillColor(27, 58, 92);
      doc.rect(0, 0, 210, 35, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("Halley-Technologies", 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(0, 188, 212);
      doc.text(`${lang === "en" ? "Annual Report" : "Rapport annuel"} ${year}`, 14, 23);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(`${emp.firstName} ${emp.lastName}`, 14, 31);
      if (emp.office) {
        doc.setFontSize(9);
        doc.text(`${emp.office.name}${emp.team ? ` — ${emp.team.name}` : ""}`, 120, 31);
      }
      doc.setTextColor(0, 0, 0);

      // Leave details
      const leaveBody = leaveTypes
        .map((lt) => [lang === "en" ? lt.label_en : lt.label_fr, String(emp.daysByType[lt.code]?.days ?? 0)])
        .filter((row) => parseFloat(row[1]) > 0);
      leaveBody.push(["TOTAL", String(emp.totalDaysTaken)]);

      autoTable(doc, {
        startY: 43,
        head: [[lang === "en" ? "Leave Type" : "Type de congé", lang === "en" ? "Days Taken" : "Jours pris"]],
        body: leaveBody,
        headStyles: { fillColor: [27, 58, 92], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      doc.setFontSize(12);
      doc.setTextColor(27, 58, 92);
      doc.text(lang === "en" ? "Balances" : "Soldes", 14, finalY);

      const balanceBody: string[][] = [];
      if (emp.annualBalance) {
        balanceBody.push([lang === "en" ? "Annual" : "Annuel", String(emp.annualBalance.total), String(emp.annualBalance.used), String(emp.annualBalance.pending), String(emp.annualBalance.remaining)]);
      }
      if (emp.offeredBalance) {
        balanceBody.push([lang === "en" ? "Offered" : "Offert", String(emp.offeredBalance.total), String(emp.offeredBalance.used), String(emp.offeredBalance.pending), String(emp.offeredBalance.remaining)]);
      }

      if (balanceBody.length > 0) {
        autoTable(doc, {
          startY: finalY + 4,
          head: [[lang === "en" ? "Type" : "Type", lang === "en" ? "Allocated" : "Alloués", lang === "en" ? "Used" : "Utilisés", lang === "en" ? "Pending" : "En attente", lang === "en" ? "Remaining" : "Restants"]],
          body: balanceBody,
          headStyles: { fillColor: [0, 188, 212], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { left: 14, right: 14 },
        });
      }

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Halley-Technologies SA - ${lang === "en" ? "Generated on" : "Généré le"} ${new Date().toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")}`, 14, 285);
      doc.save(`rapport-${emp.firstName}-${emp.lastName}-${year}.pdf`);
      addToast({ type: "success", title: lang === "en" ? "Report exported" : "Rapport exporté" });
    } catch {
      addToast({ type: "error", title: lang === "en" ? "Export error" : "Erreur d'export" });
    } finally {
      setExporting(null);
    }
  };

  const STATUSES = [
    { value: "", label_fr: "Approuvés (défaut)", label_en: "Approved (default)" },
    { value: "PENDING_MANAGER", label_fr: "En attente Manager", label_en: "Pending Manager" },
    { value: "PENDING_HR", label_fr: "En attente RH", label_en: "Pending HR" },
    { value: "REFUSED", label_fr: "Refusés", label_en: "Refused" },
    { value: "CANCELLED", label_fr: "Annulés", label_en: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lang === "en" ? "HR Reports" : "Rapports RH"}</h1>
          <p className="mt-1 text-sm text-gray-500">{lang === "en" ? "Global reports with advanced filters" : "Rapports globaux avec filtres avancés"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${showFilters ? "border-[#1B3A5C] bg-blue-50 text-[#1B3A5C]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            <Filter className="h-4 w-4" />
            {lang === "en" ? "Filters" : "Filtres"}
          </button>
          <button onClick={handleExportExcel} disabled={exporting !== null || employees.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50">
            {exporting === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </button>
          <button onClick={handleExportPDF} disabled={exporting !== null || employees.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50">
            {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{lang === "en" ? "Year" : "Année"}</label>
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{lang === "en" ? "Office" : "Bureau"}</label>
              <select value={officeFilter} onChange={(e) => setOfficeFilter(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]">
                <option value="">{lang === "en" ? "All offices" : "Tous les bureaux"}</option>
                {officeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{lang === "en" ? "Team" : "Équipe"}</label>
              <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]">
                <option value="">{lang === "en" ? "All teams" : "Toutes les équipes"}</option>
                {teamOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{lang === "en" ? "Leave type" : "Type de congé"}</label>
              <select value={leaveTypeFilter} onChange={(e) => setLeaveTypeFilter(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]">
                <option value="">{lang === "en" ? "All types" : "Tous les types"}</option>
                {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lang === "en" ? lt.label_en : lt.label_fr}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{lang === "en" ? "Employee" : "Employé"}</label>
              <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]">
                <option value="">{lang === "en" ? "All employees" : "Tous les employés"}</option>
                {allEmployees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{lang === "en" ? "Status" : "Statut"}</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none focus:ring-1 focus:ring-[#1B3A5C]">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{lang === "en" ? s.label_en : s.label_fr}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-500">{lang === "en" ? "No data available." : "Aucune donnée disponible."}</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          {chartData.length > 0 && chartData.length <= 30 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700">{lang === "en" ? "Days by employee" : "Jours par employé"}</h3>
              <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 25)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
                  <Tooltip />
                  <Legend />
                  {leaveTypes.map((lt) => (
                    <Bar key={lt.code} dataKey={lt.code} name={lang === "en" ? lt.label_en : lt.label_fr} fill={lt.color} stackId="a" />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                    <th className="whitespace-nowrap px-6 py-3 font-medium text-gray-500">{lang === "en" ? "Employee" : "Employé"}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-500">{lang === "en" ? "Office" : "Bureau"}</th>
                    {leaveTypes.map((lt) => (
                      <th key={lt.code} className="whitespace-nowrap px-4 py-3 text-center font-medium text-gray-500">
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: lt.color }} />
                          {lang === "en" ? lt.label_en : lt.label_fr}
                        </div>
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-gray-500">Total</th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-gray-500">{lang === "en" ? "Annual Bal." : "Solde annuel"}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-500">{lang === "en" ? "Report" : "Rapport"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50/50">
                      <td className="whitespace-nowrap px-6 py-3 font-medium text-gray-900">{emp.firstName} {emp.lastName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{emp.office?.name ?? "-"}</td>
                      {leaveTypes.map((lt) => (
                        <td key={lt.code} className="whitespace-nowrap px-4 py-3 text-center text-gray-600">{emp.daysByType[lt.code]?.days ?? 0}</td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-gray-900">{emp.totalDaysTaken}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        {emp.annualBalance ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${emp.annualBalance.remaining > 5 ? "bg-green-100 text-green-700" : emp.annualBalance.remaining > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {emp.annualBalance.remaining}
                          </span>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button onClick={() => handleEmployeeReport(emp)} disabled={exporting === emp.id} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#1B3A5C] transition-colors hover:bg-blue-50 disabled:opacity-50">
                          {exporting === emp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          {lang === "en" ? "Annual" : "Annuel"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
