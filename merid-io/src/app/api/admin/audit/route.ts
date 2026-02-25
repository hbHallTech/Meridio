import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit, getIp } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

function buildWhere(searchParams: URLSearchParams): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");

  if (startDate || endDate) {
    const createdAtFilter: Record<string, Date> = {};
    if (startDate) createdAtFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      createdAtFilter.lte = end;
    }
    where.createdAt = createdAtFilter;
  }

  if (action) where.action = action;
  if (userId) where.userId = userId;

  return where;
}

// ─── GET: paginated audit logs (ADMIN only) ───

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const where = buildWhere(searchParams);

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize")) || 50));
  const skip = (page - 1) * pageSize;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// ─── POST: export CSV (ADMIN only) ───

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const where = buildWhere(searchParams);

  // Log the export action itself
  logAudit(session.user.id, "EXPORT_AUDIT", {
    ip: getIp(request.headers),
    entityType: "AuditLog",
    newValue: { filters: Object.fromEntries(searchParams.entries()) },
  });

  // Read company CSV separator setting (fallback to comma)
  const company = await prisma.company.findFirst({ select: { csvSeparator: true } });
  const sep = company?.csvSeparator || ",";

  // Stream CSV in chunks to avoid memory issues on large datasets
  const CHUNK_SIZE = 500;
  let cursor: string | undefined;
  const headerFields = ["Date", "Utilisateur", "Email", "Action", "Succes", "TypeEntite", "IdEntite", "IP", "Details"];
  const csvHeader = headerFields.map((h) => `"${h}"`).join(sep) + "\n";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode("\uFEFF")); // UTF-8 BOM for Excel
      controller.enqueue(encoder.encode(csvHeader));
    },
    async pull(controller) {
      try {
        const rows = await prisma.auditLog.findMany({
          where,
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: CHUNK_SIZE,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });

        if (rows.length === 0) {
          controller.close();
          return;
        }

        const lines = rows.map((r) => {
          const date = r.createdAt.toISOString();
          const userName = r.user ? `${r.user.firstName} ${r.user.lastName}` : "";
          const email = r.user?.email ?? "";
          const details = r.newValue ? JSON.stringify(r.newValue).replace(/"/g, '""') : "";
          return [date, userName, email, r.action, String(r.success), r.entityType ?? "", r.entityId ?? "", r.ipAddress ?? "", details]
            .map((v) => `"${v}"`)
            .join(sep);
        });

        controller.enqueue(encoder.encode(lines.join("\n") + "\n"));
        cursor = rows[rows.length - 1].id;

        if (rows.length < CHUNK_SIZE) {
          controller.close();
        }
      } catch (err) {
        console.error("[audit/export] CSV stream error:", err);
        controller.close();
      }
    },
  });

  const now = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit_${now}.csv"`,
    },
  });
}
