"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  User,
  CheckSquare,
  Calendar,
  BarChart3,
  ArrowLeftRight,
  Users,
  Building2,
  Workflow,
  Tags,
  CalendarOff,
  Building,
  ScrollText,
  UserCog,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
  X,
  ClipboardList,
  Wallet,
} from "lucide-react";
import { MeridioLogo, MeridioIcon } from "@/components/MeridioLogo";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  roles?: UserRole[];
}

interface NavSection {
  titleKey?: string;
  roles?: UserRole[];
  items: NavItem[];
}

export function Sidebar({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const { data: session, update } = useSession();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const userRoles = session?.user?.roles ?? [];
  const currentLang = session?.user?.language ?? "fr";
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  useEffect(() => {
    if (
      userRoles.includes("MANAGER") ||
      userRoles.includes("HR") ||
      userRoles.includes("ADMIN")
    ) {
      fetch("/api/approvals/pending-count")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((data) => setPendingCount(data.count ?? 0))
        .catch(() => setPendingCount(0));
    }
  }, [userRoles]);

  // Fetch company logo
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.logoUrl) setCompanyLogo(data.logoUrl);
      })
      .catch(() => {});
  }, [session?.user?.id]);

  function hasAnyRole(roles?: UserRole[]): boolean {
    if (!roles || roles.length === 0) return true;
    return roles.some((role) => userRoles.includes(role));
  }

  async function toggleLanguage() {
    const newLang = currentLang === "fr" ? "en" : "fr";
    await update({ language: newLang });
    window.location.reload();
  }

  const sections: NavSection[] = [
    {
      items: [
        { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
        { href: "/leaves", label: t("leaves"), icon: CalendarDays },
        { href: "/leaves/new", label: t("newLeave"), icon: PlusCircle },
        { href: "/profile", label: t("profile"), icon: User },
      ],
    },
    {
      titleKey: "manager",
      roles: ["MANAGER", "ADMIN"],
      items: [
        {
          href: "/manager/approvals",
          label: t("approvals"),
          icon: CheckSquare,
          badge: pendingCount,
          roles: ["MANAGER", "ADMIN"],
        },
        { href: "/manager/calendar", label: t("calendar"), icon: Calendar, roles: ["MANAGER", "ADMIN"] },
        { href: "/manager/reports", label: t("reports"), icon: BarChart3, roles: ["MANAGER", "ADMIN"] },
        { href: "/manager/delegation", label: t("delegation"), icon: ArrowLeftRight, roles: ["MANAGER", "ADMIN"] },
      ],
    },
    {
      titleKey: "hr",
      roles: ["HR", "ADMIN"],
      items: [
        { href: "/hr/approvals", label: `${t("approvals")} HR`, icon: ClipboardList, roles: ["HR", "ADMIN"] },
        { href: "/hr/dashboard", label: t("dashboard"), icon: LayoutDashboard, roles: ["HR", "ADMIN"] },
        { href: "/hr/balances", label: t("balances"), icon: Wallet, roles: ["HR", "ADMIN"] },
        { href: "/hr/reports", label: t("reports"), icon: BarChart3, roles: ["HR", "ADMIN"] },
      ],
    },
    {
      titleKey: "admin",
      roles: ["ADMIN"],
      items: [
        { href: "/admin/users", label: t("users"), icon: UserCog, roles: ["ADMIN"] },
        { href: "/admin/teams", label: t("teams"), icon: Users, roles: ["ADMIN"] },
        { href: "/admin/offices", label: t("offices"), icon: Building2, roles: ["ADMIN"] },
        { href: "/admin/workflows", label: t("workflows"), icon: Workflow, roles: ["ADMIN"] },
        { href: "/admin/leave-types", label: t("leaveTypes"), icon: Tags, roles: ["ADMIN"] },
        { href: "/admin/holidays", label: t("holidays"), icon: CalendarOff, roles: ["ADMIN"] },
        { href: "/admin/closures", label: t("closures"), icon: Building, roles: ["ADMIN"] },
        { href: "/admin/exceptional-rules", label: t("exceptionalRules"), icon: Shield, roles: ["ADMIN"] },
        { href: "/admin/company", label: t("company"), icon: Building2, roles: ["ADMIN"] },
        { href: "/admin/delegations", label: t("delegations"), icon: ArrowLeftRight, roles: ["ADMIN"] },
        { href: "/admin/audit", label: t("audit"), icon: ScrollText, roles: ["ADMIN"] },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300
          lg:relative lg:z-auto
          ${collapsed ? "w-[72px]" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{ backgroundColor: "#1B3A5C" }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="flex items-center">
                <MeridioLogo height={26} />
              </Link>
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt="Logo"
                  className="h-7 w-auto max-h-7 rounded object-contain"
                />
              )}
            </div>
          ) : (
            <Link href="/dashboard" className="mx-auto">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt="Logo"
                  className="h-8 w-8 rounded object-contain"
                />
              ) : (
                <MeridioIcon size={28} />
              )}
            </Link>
          )}
          <button
            onClick={onMobileClose}
            className="text-white/70 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section, sIdx) => {
            if (!hasAnyRole(section.roles)) return null;
            const visibleItems = section.items.filter((item) => hasAnyRole(item.roles));
            if (visibleItems.length === 0) return null;

            return (
              <div key={sIdx} className={sIdx > 0 ? "mt-6" : ""}>
                {section.titleKey && !collapsed && (
                  <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    {t(section.titleKey)}
                  </p>
                )}
                {section.titleKey && collapsed && (
                  <div className="mb-2 border-t border-white/10" />
                )}
                <ul className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onMobileClose}
                          className={`
                            group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                            ${active ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}
                          `}
                          style={active ? { backgroundColor: "#00BCD4" } : undefined}
                          title={collapsed ? item.label : undefined}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {item.badge && item.badge > 0 ? (
                            <span
                              className={`
                                flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white
                                ${collapsed ? "absolute -right-1 -top-1" : "ml-auto"}
                              `}
                              style={{
                                backgroundColor: active ? "rgba(255,255,255,0.3)" : "#EF4444",
                              }}
                            >
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-white/10 p-3">
          <button
            onClick={toggleLanguage}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title={collapsed ? (currentLang === "fr" ? "English" : "Français") : undefined}
          >
            <Globe className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <span>{currentLang === "fr" ? "English" : "Français"}</span>
            )}
            {!collapsed && (
              <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-bold uppercase text-white/50">
                {currentLang}
              </span>
            )}
          </button>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-red-500/20 hover:text-red-300"
            title={collapsed ? tAuth("logout") : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{tAuth("logout")}</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="mt-1 hidden w-full items-center justify-center rounded-lg py-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white lg:flex"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
    </>
  );
}
