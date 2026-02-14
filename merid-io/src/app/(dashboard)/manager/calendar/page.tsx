"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Loader2,
  Calendar,
  CalendarDays,
  Info,
} from "lucide-react";

// ─── Types ───

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor?: string;
  display?: string;
  extendedProps: {
    employeeName?: string;
    leaveType?: {
      code: string;
      label_fr: string;
      label_en: string;
      color: string;
    };
    status?: string;
    totalDays?: number;
    startHalfDay?: string;
    endHalfDay?: string;
    isHoliday?: boolean;
    name_fr?: string;
    name_en?: string;
  };
}

interface LeaveType {
  code: string;
  label_fr: string;
  label_en: string;
  color: string;
}

// ─── Constants ───

const STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  APPROVED: { fr: "Approuvé", en: "Approved" },
  PENDING_MANAGER: { fr: "En attente", en: "Pending" },
  PENDING_HR: { fr: "En attente RH", en: "Pending HR" },
};

// ─── Component ───

export default function ManagerCalendarPage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const lang = session?.user?.language ?? "fr";
  const calendarRef = useRef<FullCalendar>(null);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "year">("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    event: CalendarEvent;
    x: number;
    y: number;
  } | null>(null);

  const fetchEvents = useCallback(
    async (start: Date, end: Date) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("start", start.toISOString().split("T")[0]);
        params.set("end", end.toISOString().split("T")[0]);

        const res = await fetch(`/api/manager/calendar?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events);
          setLeaveTypes(data.leaveTypes);
        }
      } catch {
        addToast({
          type: "error",
          title: lang === "en" ? "Error loading calendar" : "Erreur de chargement du calendrier",
        });
      } finally {
        setLoading(false);
      }
    },
    [addToast, lang]
  );

  useEffect(() => {
    if (view === "month") {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      start.setDate(start.getDate() - 7);
      end.setDate(end.getDate() + 7);
      fetchEvents(start, end);
    } else {
      const start = new Date(currentDate.getFullYear(), 0, 1);
      const end = new Date(currentDate.getFullYear(), 11, 31);
      fetchEvents(start, end);
    }
  }, [currentDate, view, fetchEvents]);

  const handleDatesSet = (info: { start: Date; end: Date }) => {
    const mid = new Date((info.start.getTime() + info.end.getTime()) / 2);
    setCurrentDate(mid);
  };

  const handleEventMouseEnter = (info: { event: { id: string; title: string; startStr: string; endStr: string; backgroundColor: string; borderColor: string; extendedProps: Record<string, unknown> }; el: HTMLElement }) => {
    const evt = events.find((e) => e.id === info.event.id);
    if (!evt || evt.extendedProps.isHoliday) return;
    const rect = info.el.getBoundingClientRect();
    setTooltip({
      event: evt,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleEventMouseLeave = () => {
    setTooltip(null);
  };

  // Year view: render 12 mini calendars
  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i);

    return (
      <div>
        {/* Year navigation */}
        <div className="mb-4 flex items-center justify-center gap-4">
          <button
            onClick={() => setCurrentDate(new Date(year - 1, 0, 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            &larr; {year - 1}
          </button>
          <span className="text-lg font-bold text-gray-900">{year}</span>
          <button
            onClick={() => setCurrentDate(new Date(year + 1, 0, 1))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {year + 1} &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {months.map((month) => (
            <div
              key={month}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white"
            >
              <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-center text-sm font-semibold text-gray-700">
                {new Date(year, month).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div className="p-1">
                <FullCalendar
                  plugins={[dayGridPlugin]}
                  initialView="dayGridMonth"
                  initialDate={new Date(year, month, 1)}
                  headerToolbar={false}
                  height="auto"
                  events={events}
                  dayHeaderFormat={{ weekday: "narrow" }}
                  dayCellClassNames="text-[10px]"
                  fixedWeekCount={false}
                  eventDisplay="block"
                  firstDay={1}
                  eventContent={(arg) => (
                    <div
                      className="h-1.5 w-full rounded-full"
                      style={{ backgroundColor: arg.event.backgroundColor }}
                      title={arg.event.title}
                    />
                  )}
                  locale={lang === "en" ? "en" : "fr"}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {lang === "en" ? "Team Calendar" : "Calendrier d'équipe"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {lang === "en"
              ? "View your team's absences"
              : "Visualisez les absences de votre équipe"}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setView("month")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              view === "month"
                ? "bg-white text-[#1B3A5C] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="h-4 w-4" />
            {lang === "en" ? "Monthly" : "Mensuel"}
          </button>
          <button
            onClick={() => setView("year")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              view === "year"
                ? "bg-white text-[#1B3A5C] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            {lang === "en" ? "Annual" : "Annuel"}
          </button>
        </div>
      </div>

      {/* Calendar */}
      {loading && events.length === 0 ? (
        <div className="flex h-96 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : view === "month" ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "",
            }}
            buttonText={{
              today: lang === "en" ? "Today" : "Aujourd'hui",
            }}
            events={events}
            height="auto"
            locale={lang === "en" ? "en" : "fr"}
            firstDay={1}
            fixedWeekCount={false}
            datesSet={handleDatesSet}
            eventMouseEnter={handleEventMouseEnter}
            eventMouseLeave={handleEventMouseLeave}
            eventContent={(arg) => {
              const props = arg.event.extendedProps;
              if (props.isHoliday) return null;
              return (
                <div className="flex items-center gap-1 overflow-hidden px-1 py-0.5 text-xs">
                  <div
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: arg.event.borderColor }}
                  />
                  <span className="truncate font-medium text-gray-800">
                    {arg.event.title}
                  </span>
                  {props.status !== "APPROVED" && (
                    <span className="shrink-0 rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">
                      ?
                    </span>
                  )}
                </div>
              );
            }}
          />
        </div>
      ) : (
        renderYearView()
      )}

      {/* Legend */}
      {leaveTypes.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Info className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">
              {lang === "en" ? "Legend" : "Légende"}
            </h3>
          </div>
          <div className="flex flex-wrap gap-4">
            {leaveTypes.map((lt) => (
              <div key={lt.code} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: lt.color }}
                />
                <span className="text-sm text-gray-600">
                  {lang === "en" ? lt.label_en : lt.label_fr}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border border-amber-400 bg-amber-100" />
              <span className="text-sm text-gray-600">
                {lang === "en" ? "Pending approval" : "En attente d'approbation"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-semibold text-gray-900">
            {tooltip.event.extendedProps.employeeName}
          </p>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: tooltip.event.extendedProps.leaveType?.color }}
            />
            <span className="text-gray-700">
              {lang === "en"
                ? tooltip.event.extendedProps.leaveType?.label_en
                : tooltip.event.extendedProps.leaveType?.label_fr}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {tooltip.event.extendedProps.totalDays}{" "}
            {lang === "en" ? "day(s)" : "jour(s)"}
            {" — "}
            {STATUS_LABELS[tooltip.event.extendedProps.status ?? ""]?.[lang as "fr" | "en"] ?? tooltip.event.extendedProps.status}
          </p>
        </div>
      )}
    </div>
  );
}
