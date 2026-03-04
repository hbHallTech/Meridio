"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  ScrollText,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface DashboardStats {
  totalTenants: number;
  totalUsers: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  recentActivity: { action: string; createdAt: string; userName: string; companyName: string }[];
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [tenantsRes, requestsRes, auditRes] = await Promise.all([
          fetch("/api/super-admin/tenants"),
          fetch("/api/super-admin/signup-requests"),
          fetch("/api/super-admin/audit-logs?pageSize=10"),
        ]);

        const tenants = tenantsRes.ok ? await tenantsRes.json() : [];
        const requests = requestsRes.ok ? await requestsRes.json() : [];
        const audit = auditRes.ok ? await auditRes.json() : { logs: [] };

        setStats({
          totalTenants: tenants.length,
          totalUsers: tenants.reduce(
            (sum: number, t: { userCount: number }) => sum + t.userCount,
            0
          ),
          pendingRequests: requests.filter(
            (r: { status: string }) => r.status === "PENDING"
          ).length,
          approvedRequests: requests.filter(
            (r: { status: string }) => r.status === "APPROVED"
          ).length,
          rejectedRequests: requests.filter(
            (r: { status: string }) => r.status === "REJECTED"
          ).length,
          recentActivity: audit.logs.slice(0, 8).map(
            (l: {
              action: string;
              createdAt: string;
              user?: { firstName: string; lastName: string };
              companyName?: string;
            }) => ({
              action: l.action,
              createdAt: l.createdAt,
              userName: l.user
                ? `${l.user.firstName} ${l.user.lastName}`
                : "Système",
              companyName: l.companyName || "-",
            })
          ),
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const cards = [
    {
      label: "Tenants",
      value: stats?.totalTenants ?? 0,
      icon: Building2,
      color: "#1B3A5C",
      href: "/super-admin/tenants",
    },
    {
      label: "Utilisateurs totaux",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: "#00BCD4",
      href: "/super-admin/tenants",
    },
    {
      label: "Demandes en attente",
      value: stats?.pendingRequests ?? 0,
      icon: Clock,
      color: "#F59E0B",
      href: "/super-admin/signup-requests",
    },
    {
      label: "Approuvées",
      value: stats?.approvedRequests ?? 0,
      icon: CheckCircle2,
      color: "#10B981",
      href: "/super-admin/signup-requests",
    },
    {
      label: "Rejetées",
      value: stats?.rejectedRequests ?? 0,
      icon: XCircle,
      color: "#EF4444",
      href: "/super-admin/signup-requests",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Super Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Vue d&apos;ensemble de la plateforme Meridio
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${card.color}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color: card.color }} />
                </div>
              </div>
              <p
                className="mt-3 text-2xl font-bold"
                style={{ color: card.color }}
              >
                {card.value}
              </p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "Demandes d'inscription",
            desc: "Approuver ou rejeter les nouvelles demandes",
            href: "/super-admin/signup-requests",
            icon: Clock,
            badge: stats?.pendingRequests,
          },
          {
            title: "Liste des tenants",
            desc: "Voir tous les tenants et leurs statistiques",
            href: "/super-admin/tenants",
            icon: Building2,
          },
          {
            title: "Journal d'audit",
            desc: "Consulter les actions sur toute la plateforme",
            href: "/super-admin/audit-logs",
            icon: ScrollText,
          },
        ].map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-[#1B3A5C]/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <Icon className="h-6 w-6 text-[#1B3A5C]" />
                {link.badge ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                    {link.badge}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 font-semibold text-gray-900 group-hover:text-[#1B3A5C]">
                {link.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500">{link.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-sm font-medium text-[#1B3A5C] opacity-0 group-hover:opacity-100 transition-opacity">
                Accéder <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent activity */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Activité récente</h2>
            <Link
              href="/super-admin/audit-logs"
              className="text-sm font-medium text-[#1B3A5C] hover:underline"
            >
              Tout voir
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.action}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.userName} &middot; {item.companyName}
                  </p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(item.createdAt).toLocaleString("fr-CH", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
