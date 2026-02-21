import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leaveTypeConfigSchema } from "@/lib/validators";
import { logAudit, getIp } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const leaveTypes = await prisma.leaveTypeConfig.findMany({
    include: {
      office: { select: { id: true, name: true } },
    },
    orderBy: [{ officeId: "asc" }, { code: "asc" }],
  });

  return NextResponse.json(leaveTypes);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Parse boolean/numeric fields that may come as strings
    const parsed = {
      ...body,
      requiresAttachment: body.requiresAttachment === true || body.requiresAttachment === "true",
      deductsFromBalance: body.deductsFromBalance === true || body.deductsFromBalance === "true",
      attachmentFromDay: body.attachmentFromDay ? Number(body.attachmentFromDay) : undefined,
    };

    const validated = leaveTypeConfigSchema.parse(parsed);

    const leaveType = await prisma.leaveTypeConfig.create({
      data: {
        officeId: body.officeId,
        code: validated.code,
        label_fr: validated.label_fr,
        label_en: validated.label_en,
        requiresAttachment: validated.requiresAttachment,
        attachmentFromDay: validated.attachmentFromDay ?? null,
        deductsFromBalance: validated.deductsFromBalance,
        balanceType: validated.balanceType || null,
        isActive: body.isActive === true || body.isActive === "true",
        color: validated.color || "#3B82F6",
      },
      include: {
        office: { select: { id: true, name: true } },
      },
    });

    logAudit(session.user.id, "LEAVE_TYPE_CREATED", {
      entityType: "LeaveTypeConfig",
      entityId: leaveType.id,
      ip: getIp(request.headers),
      newValue: { code: validated.code, label_fr: validated.label_fr },
    });

    return NextResponse.json(leaveType, { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json({ error: "Données invalides", details: (error as { issues: unknown }).issues }, { status: 400 });
    }
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Un type de congé avec ce code existe déjà pour ce bureau" }, { status: 409 });
    }
    console.error("POST /api/admin/leave-types error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Parse boolean/numeric fields
    const parsed = {
      ...data,
      requiresAttachment: data.requiresAttachment === true || data.requiresAttachment === "true",
      deductsFromBalance: data.deductsFromBalance === true || data.deductsFromBalance === "true",
      attachmentFromDay: data.attachmentFromDay ? Number(data.attachmentFromDay) : undefined,
    };

    const validated = leaveTypeConfigSchema.parse(parsed);

    const leaveType = await prisma.leaveTypeConfig.update({
      where: { id },
      data: {
        officeId: data.officeId,
        code: validated.code,
        label_fr: validated.label_fr,
        label_en: validated.label_en,
        requiresAttachment: validated.requiresAttachment,
        attachmentFromDay: validated.attachmentFromDay ?? null,
        deductsFromBalance: validated.deductsFromBalance,
        balanceType: validated.balanceType || null,
        isActive: data.isActive === true || data.isActive === "true",
        color: validated.color || "#3B82F6",
      },
      include: {
        office: { select: { id: true, name: true } },
      },
    });

    logAudit(session.user.id, "LEAVE_TYPE_UPDATED", {
      entityType: "LeaveTypeConfig",
      entityId: id,
      ip: getIp(request.headers),
      newValue: { code: validated.code, label_fr: validated.label_fr },
    });

    return NextResponse.json(leaveType);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json({ error: "Données invalides", details: (error as { issues: unknown }).issues }, { status: 400 });
    }
    if (error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Un type de congé avec ce code existe déjà pour ce bureau" }, { status: 409 });
    }
    console.error("PATCH /api/admin/leave-types error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Check for linked leave requests
    const linkedRequests = await prisma.leaveRequest.count({
      where: { leaveTypeConfigId: id },
    });

    if (linkedRequests > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${linkedRequests} demande(s) de congé liée(s) à ce type` },
        { status: 409 }
      );
    }

    await prisma.leaveTypeConfig.delete({ where: { id } });

    logAudit(session.user.id, "LEAVE_TYPE_DELETED", {
      entityType: "LeaveTypeConfig",
      entityId: id,
      ip: getIp(request.headers),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/leave-types error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
