"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarCheck,
  Plus,
  Users,
  MapPin,
  Search,
  X,
} from "lucide-react";

// ── Types ──

interface EventUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface EventTeam {
  id: string;
  name: string;
}

interface EventCreator {
  id: string;
  firstName: string;
  lastName: string;
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  type: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  creator: EventCreator;
  assignedTeams: EventTeam[];
  assignedUsers: EventUser[];
  createdAt: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Team {
  id: string;
  name: string;
}

const EVENT_TYPE_OPTIONS = [
  { value: "SEMINAIRE", label: "Séminaire" },
  { value: "FORMATION", label: "Formation" },
  { value: "TEAM_BUILDING", label: "Team Building" },
  { value: "CONFERENCE", label: "Conférence" },
  { value: "OTHER", label: "Autre" },
];

const TYPE_COLORS: Record<string, string> = {
  SEMINAIRE: "bg-blue-100 text-blue-800",
  FORMATION: "bg-green-100 text-green-800",
  TEAM_BUILDING: "bg-purple-100 text-purple-800",
  CONFERENCE: "bg-orange-100 text-orange-800",
  OTHER: "bg-gray-100 text-gray-800",
};

export default function HREventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [searchText, setSearchText] = useState("");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "FORMATION",
    startDate: "",
    endDate: "",
    location: "",
    teamIds: [] as string[],
    userIds: [] as string[],
  });

  // Assign dialog
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [assignTeamIds, setAssignTeamIds] = useState<string[]>([]);
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Reference data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/hr/events?${params}`);
      if (res.ok) setEvents(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    Promise.all([
      fetch("/api/hr/employees").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/teams").then((r) => (r.ok ? r.json() : [])),
    ]).then(([emps, tms]) => {
      setEmployees(emps);
      setTeams(Array.isArray(tms) ? tms : []);
    });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/hr/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          teamIds: form.teamIds.length ? form.teamIds : undefined,
          userIds: form.userIds.length ? form.userIds : undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm({ title: "", description: "", type: "FORMATION", startDate: "", endDate: "", location: "", teamIds: [], userIds: [] });
        fetchEvents();
      }
    } catch {
      /* ignore */
    }
    setCreating(false);
  }

  function openAssign(event: Event) {
    setShowAssign(event.id);
    setAssignTeamIds(event.assignedTeams.map((t) => t.id));
    setAssignUserIds(event.assignedUsers.map((u) => u.id));
  }

  async function handleAssign() {
    if (!showAssign) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/hr/events/${showAssign}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamIds: assignTeamIds, userIds: assignUserIds }),
      });
      if (res.ok) {
        setShowAssign(null);
        fetchEvents();
      }
    } catch {
      /* ignore */
    }
    setAssigning(false);
  }

  const filteredEvents = events.filter((ev) => {
    if (searchText) {
      const s = searchText.toLowerCase();
      return (
        ev.title.toLowerCase().includes(s) ||
        ev.location?.toLowerCase().includes(s) ||
        ev.description?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="h-7 w-7 text-[#1B3A5C]" />
            Événements
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Séminaires, formations, team building et conférences
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1B3A5C] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#15304d] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvel événement
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-9 pr-3 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none"
        >
          <option value="">Tous les types</option>
          {EVENT_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Events list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Aucun événement</div>
      ) : (
        <div className="grid gap-4">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[event.type] || TYPE_COLORS.OTHER}`}>
                      {EVENT_TYPE_OPTIONS.find((t) => t.value === event.type)?.label || event.type}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(event.startDate).toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {event.endDate &&
                        event.endDate !== event.startDate &&
                        ` — ${new Date(event.endDate).toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "long",
                        })}`}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {event.title}
                  </h3>
                  {event.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {event.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {event.assignedUsers.length} participant(s)
                      {event.assignedTeams.length > 0 && `, ${event.assignedTeams.length} équipe(s)`}
                    </span>
                  </div>
                  {event.assignedTeams.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {event.assignedTeams.map((team) => (
                        <span
                          key={team.id}
                          className="inline-block rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300"
                        >
                          {team.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => openAssign(event)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                  Assigner
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Dialog ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Nouvel événement
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titre *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none focus:ring-1 focus:ring-[#00BCD4]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none"
                >
                  {EVENT_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date début *</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lieu</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Salle de réunion, Hôtel, etc."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Équipes</label>
                <select
                  multiple
                  value={form.teamIds}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      teamIds: Array.from(e.target.selectedOptions, (o) => o.value),
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none h-24"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">Maintenez Ctrl pour sélectionner plusieurs</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Participants individuels</label>
                <select
                  multiple
                  value={form.userIds}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      userIds: Array.from(e.target.selectedOptions, (o) => o.value),
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none h-24"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.lastName} {e.firstName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
                >
                  {creating ? "Création..." : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Dialog ── */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Assigner des participants
              </h2>
              <button onClick={() => setShowAssign(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Équipes</label>
                <select
                  multiple
                  value={assignTeamIds}
                  onChange={(e) =>
                    setAssignTeamIds(Array.from(e.target.selectedOptions, (o) => o.value))
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none h-24"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Participants individuels</label>
                <select
                  multiple
                  value={assignUserIds}
                  onChange={(e) =>
                    setAssignUserIds(Array.from(e.target.selectedOptions, (o) => o.value))
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm focus:border-[#00BCD4] focus:outline-none h-24"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.lastName} {e.firstName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssign(null)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  className="rounded-lg bg-[#1B3A5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#15304d] disabled:opacity-50"
                >
                  {assigning ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
