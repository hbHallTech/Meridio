"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  PlusCircle,
  UserCircle,
  CheckSquare,
  Calendar,
  BarChart3,
  ArrowRightLeft,
  Users,
  Building2,
  Settings,
  Shield,
  FileText,
} from "lucide-react";

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  const navigation = [
    { name: t("dashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("leaves"), href: "/leaves", icon: CalendarDays },
    { name: t("newLeave"), href: "/leaves/new", icon: PlusCircle },
    { name: t("profile"), href: "/profile", icon: UserCircle },
  ];

  const managerNav = [
    { name: t("approvals"), href: "/manager/approvals", icon: CheckSquare },
    { name: t("calendar"), href: "/manager/calendar", icon: Calendar },
    { name: t("reports"), href: "/manager/reports", icon: BarChart3 },
    { name: t("delegation"), href: "/manager/delegation", icon: ArrowRightLeft },
  ];

  const hrNav = [
    { name: t("approvals"), href: "/hr/approvals", icon: CheckSquare },
    { name: t("dashboard"), href: "/hr/dashboard", icon: LayoutDashboard },
    { name: t("balances"), href: "/hr/balances", icon: FileText },
    { name: t("reports"), href: "/hr/reports", icon: BarChart3 },
  ];

  const adminNav = [
    { name: t("users"), href: "/admin/users", icon: Users },
    { name: t("teams"), href: "/admin/teams", icon: Users },
    { name: t("offices"), href: "/admin/offices", icon: Building2 },
    { name: t("leaveTypes"), href: "/admin/leave-types", icon: CalendarDays },
    { name: t("holidays"), href: "/admin/holidays", icon: Calendar },
    { name: t("company"), href: "/admin/company", icon: Settings },
    { name: t("audit"), href: "/admin/audit", icon: Shield },
  ];

  return (
    <aside className="flex w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-xl font-bold">
          Meridio
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </div>

        <div className="pt-4">
          <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
            {t("manager")}
          </p>
          <div className="mt-2 space-y-1">
            {managerNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
            {t("hr")}
          </p>
          <div className="mt-2 space-y-1">
            {hrNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
            {t("admin")}
          </p>
          <div className="mt-2 space-y-1">
            {adminNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
