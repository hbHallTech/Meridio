"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Loader2, Calendar } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  userId: string;
  leaveType: string;
  leaveTypeLabel_fr: string;
  leaveTypeLabel_en: string;
  status: string;
  totalDays: number;
}

interface TeamInfo {
  id: string;
  name: string;
}

export default function ManagerCalendarPage() {
  const { data: session } = useSession();
  const lang = session?.user?.language ?? "fr";

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState("");

  const fetchEvents = useCallback(
    async (from?: string, to?: string) => {
      setLoading(true);
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      try {
        const res = await fetch(`/api/manager/calendar?${p.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events ?? []);
          setTeams(data.teams ?? []);
          console.log(`Manager calendar : ${(data.events ?? []).length} demandes fetchées`);
        }
      } catch (err) {
        console.error("Calendar fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDatesSet = (arg: { startStr: string; endStr: string }) => {
    fetchEvents(arg.startStr, arg.endStr);
  };

  const filteredEvents = selectedTeam
    ? events.filter((e) => {
        // Filter by team — we need to match userId to team, but since API already scopes by manager's teams,
        // we just show all or filter client-side if team info is available
        return true;
      })
    : events;

  const calendarEvents = filteredEvents.map((e) => ({
    id: e.id,
    title: `${e.title} — ${lang === "en" ? e.leaveTypeLabel_en : e.leaveTypeLabel_fr}`,
    start: e.start,
    end: e.end,
    backgroundColor: e.status === "APPROVED" ? e.color : `${e.color}80`,
    borderColor: e.color,
    textColor: "#fff",
    extendedProps: {
      status: e.status,
      totalDays: e.totalDays,
      leaveType: lang === "en" ? e.leaveTypeLabel_en : e.leaveTypeLabel_fr,
    },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Team Calendar" : "Calendrier d\u2019\u00e9quipe"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? `${events.length} leave requests displayed`
              : `${events.length} demandes affichées`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {teams.length > 1 && (
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A5C] focus:outline-none"
            >
              <option value="">
                {lang === "en" ? "All teams" : "Toutes les \u00e9quipes"}
              </option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(0,188,212,0.1)" }}
          >
            <Calendar className="h-5 w-5" style={{ color: "#00BCD4" }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={calendarEvents}
            locale={lang}
            datesSet={handleDatesSet}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek",
            }}
            height="auto"
            eventDisplay="block"
            dayMaxEvents={3}
            eventContent={(arg) => {
              const props = arg.event.extendedProps;
              const isPending = props.status !== "APPROVED";
              return (
                <div className="overflow-hidden px-1 py-0.5">
                  <p className="truncate text-xs font-medium">
                    {arg.event.title}
                  </p>
                  <p className="truncate text-[10px] opacity-80">
                    {props.totalDays}j{isPending ? (lang === "en" ? " (pending)" : " (en attente)") : ""}
                  </p>
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Legend */}
      {!loading && events.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
          <span className="text-xs font-medium text-gray-500">
            {lang === "en" ? "Legend:" : "Légende :"}
          </span>
          {Array.from(
            new Map(
              events.map((e) => [
                e.leaveType,
                {
                  label: lang === "en" ? e.leaveTypeLabel_en : e.leaveTypeLabel_fr,
                  color: e.color,
                },
              ])
            ).values()
          ).map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
