"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Menu,
  ChevronRight,
  User,
  KeyRound,
  LogOut,
} from "lucide-react";
import { NotificationBell } from "@/components/ui/NotificationBell";

const breadcrumbMap: Record<string, string> = {
  dashboard: "nav.dashboard",
  leaves: "nav.leaves",
  new: "nav.newLeave",
  profile: "nav.profile",
  manager: "nav.manager",
  approvals: "nav.approvals",
  calendar: "nav.calendar",
  reports: "nav.reports",
  delegation: "nav.delegation",
  hr: "nav.hr",
  balances: "nav.balances",
  admin: "nav.admin",
  users: "nav.users",
  teams: "nav.teams",
  offices: "nav.offices",
  workflows: "nav.workflows",
  "leave-types": "nav.leaveTypes",
  holidays: "nav.holidays",
  closures: "nav.closures",
  "exceptional-rules": "nav.exceptionalRules",
  company: "nav.company",
  audit: "nav.audit",
  delegations: "nav.delegations",
  "notification-settings": "nav.notificationSettings",
};

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname(); // already locale-stripped by next-intl
  const locale = useLocale();
  const t = useTranslations();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Build breadcrumb from pathname (already without locale prefix)
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const key = breadcrumbMap[seg];
    const label = key ? t(key) : seg.charAt(0).toUpperCase() + seg.slice(1);
    return { label, href, isLast: idx === segments.length - 1 };
  });

  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <nav className="hidden items-center gap-1 text-sm sm:flex">
          {breadcrumbs.map((crumb, idx) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
              {crumb.isLast ? (
                <span className="font-medium text-gray-900">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="text-gray-500 hover:text-gray-700">
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right: notifications + user dropdown */}
      <div className="flex items-center gap-2">
        <NotificationBell />
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100"
        >
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500">{userEmail}</p>
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: "#1B3A5C" }}
          >
            {initials}
          </div>
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">{userEmail}</p>
            </div>
            <div className="py-1">
              <Link
                href="/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="h-4 w-4 text-gray-400" />
                {t("nav.profile")}
              </Link>
              <Link
                href="/profile?tab=password"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <KeyRound className="h-4 w-4 text-gray-400" />
                {t("auth.changePassword")}
              </Link>
            </div>
            <div className="border-t border-gray-100 py-1">
              <button
                onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                {t("auth.logout")}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
