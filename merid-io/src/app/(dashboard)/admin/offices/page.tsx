"use client";

import { useEffect, useState } from "react";
import { Loader2, Building2 } from "lucide-react";

interface OfficeData {
  id: string;
  name: string;
  country: string;
  city: string;
  defaultAnnualLeave: number;
  defaultOfferedDays: number;
  maxCarryOverDays: number;
  probationMonths: number;
  minNoticeDays: number;
  workingDays: string[];
  createdAt: string;
  company: { name: string } | null;
  _count: { users: number; teams: number };
}

const dayLabels: Record<string, string> = {
  MON: "Lun",
  TUE: "Mar",
  WED: "Mer",
  THU: "Jeu",
  FRI: "Ven",
  SAT: "Sam",
  SUN: "Dim",
};

export default function AdminOfficesPage() {
  const [offices, setOffices] = useState<OfficeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/offices")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setOffices(d))
      .catch(() => setOffices([]))
      .finally(() => setLoading(false));
  }, []);

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
            {offices.length} bureau{offices.length !== 1 ? "x" : ""} enregistré{offices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: "rgba(27,58,92,0.1)" }}
        >
          <Building2 className="h-5 w-5" style={{ color: "#1B3A5C" }} />
        </div>
      </div>

      {/* Cards */}
      {offices.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-400 shadow-sm">
          Aucun bureau trouvé.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {offices.map((office) => (
            <div
              key={office.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              {/* Office header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{office.name}</h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {office.city}, {office.country}
                  </p>
                </div>
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
                >
                  <Building2 className="h-5 w-5" style={{ color: "#00BCD4" }} />
                </div>
              </div>

              {/* Stats grid */}
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Congé annuel</p>
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
                  <p className="text-xs font-medium text-gray-500">Période d&apos;essai</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{office.probationMonths} mois</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Préavis min</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{office.minNoticeDays}j</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500">Équipes</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{office._count.teams}</p>
                </div>
              </div>

              {/* Working days */}
              <div className="mt-4 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Jours ouvrés :</span>
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
    </div>
  );
}
