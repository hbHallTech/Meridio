"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { useNotifications } from "@/hooks/useNotifications";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";

const TYPE_ICONS: Record<string, { bg: string; icon: string }> = {
  NEW_REQUEST: { bg: "bg-blue-100 text-blue-600", icon: "+" },
  APPROVED: { bg: "bg-green-100 text-green-600", icon: "\u2713" },
  REFUSED: { bg: "bg-red-100 text-red-600", icon: "\u2717" },
  RETURNED: { bg: "bg-amber-100 text-amber-600", icon: "\u21BB" },
  REMINDER: { bg: "bg-orange-100 text-orange-600", icon: "\u23F0" },
  CLOSURE: { bg: "bg-purple-100 text-purple-600", icon: "\uD83D\uDCC5" },
  PASSWORD_CHANGED: { bg: "bg-gray-100 text-gray-600", icon: "\uD83D\uDD12" },
};

export function NotificationBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const lang = useLocale() as "fr" | "en";
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClick = (notif: (typeof notifications)[0]) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    if (notif.link) {
      router.push(notif.link);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
        aria-label={lang === "en" ? "Notifications" : "Notifications"}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                  {unreadCount}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#1B3A5C] transition-colors"
                  title={lang === "en" ? "Mark all as read" : "Tout marquer comme lu"}
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-gray-200" />
                <p className="mt-2 text-sm text-gray-400">
                  {lang === "en" ? "No notifications" : "Aucune notification"}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const typeStyle = TYPE_ICONS[notif.type] || TYPE_ICONS.NEW_REQUEST;
                const title = lang === "en" ? notif.title_en : notif.title_fr;
                const body = lang === "en" ? notif.body_en : notif.body_fr;
                const timeAgo = formatDistanceToNow(new Date(notif.createdAt), {
                  addSuffix: true,
                  locale: lang === "en" ? enUS : fr,
                });

                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                      !notif.isRead ? "bg-blue-50/40" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm ${typeStyle.bg}`}
                    >
                      {typeStyle.icon}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${!notif.isRead ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                        {body}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {timeAgo}
                      </p>
                    </div>

                    {/* Read indicator */}
                    {!notif.isRead && (
                      <div className="mt-1 flex-shrink-0">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      </div>
                    )}
                    {notif.isRead && (
                      <Check className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
