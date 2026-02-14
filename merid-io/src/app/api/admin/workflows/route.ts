import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { UserRole, Prisma, WorkflowStepType } from "@prisma/client";

// GET — List workflows (optionally filter by officeId)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const officeId = searchParams.get("officeId") ?? "";

  const where = officeId ? { officeId } : {};

  const workflows = await prisma.workflowConfig.findMany({
    where,
    include: {
      office: { select: { id: true, name: true, city: true } },
      steps: { orderBy: { stepOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const offices = await prisma.office.findMany({
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ workflows, offices });
}

// POST — Create a workflow config with steps
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const { officeId, mode, steps } = body;

  if (!officeId || !mode) {
    return NextResponse.json({ error: "officeId et mode requis" }, { status: 400 });
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: "Au moins une étape requise" }, { status: 400 });
  }

  // Deactivate existing active workflows for this office
  await prisma.workflowConfig.updateMany({
    where: { officeId, isActive: true },
    data: { isActive: false },
  });

  const workflow = await prisma.workflowConfig.create({
    data: {
      officeId,
      mode,
      isActive: true,
      steps: {
        create: steps.map((s: { stepType: WorkflowStepType; isRequired?: boolean }, idx: number) => ({
          stepOrder: idx + 1,
          stepType: s.stepType,
          isRequired: s.isRequired ?? true,
        })),
      },
    },
    include: {
      office: { select: { id: true, name: true, city: true } },
      steps: { orderBy: { stepOrder: "asc" } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "WORKFLOW_CREATED",
      entityType: "WorkflowConfig",
      entityId: workflow.id,
      newValue: { officeId, mode, steps: steps.length } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(workflow, { status: 201 });
}

// PATCH — Update a workflow (mode + steps)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const { workflowId, mode, steps, isActive } = body;

  if (!workflowId) {
    return NextResponse.json({ error: "workflowId requis" }, { status: 400 });
  }

  const existing = await prisma.workflowConfig.findUnique({
    where: { id: workflowId },
    include: { steps: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Workflow non trouvé" }, { status: 404 });
  }

  // If activating this workflow, deactivate others for same office
  if (isActive === true && !existing.isActive) {
    await prisma.workflowConfig.updateMany({
      where: { officeId: existing.officeId, isActive: true },
      data: { isActive: false },
    });
  }

  // Delete old steps if new ones are provided
  if (Array.isArray(steps)) {
    await prisma.workflowStep.deleteMany({ where: { workflowConfigId: workflowId } });
  }

  const updated = await prisma.workflowConfig.update({
    where: { id: workflowId },
    data: {
      ...(mode ? { mode } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(Array.isArray(steps)
        ? {
            steps: {
              create: steps.map((s: { stepType: WorkflowStepType; isRequired?: boolean }, idx: number) => ({
                stepOrder: idx + 1,
                stepType: s.stepType,
                isRequired: s.isRequired ?? true,
              })),
            },
          }
        : {}),
    },
    include: {
      office: { select: { id: true, name: true, city: true } },
      steps: { orderBy: { stepOrder: "asc" } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "WORKFLOW_UPDATED",
      entityType: "WorkflowConfig",
      entityId: workflowId,
      oldValue: {
        mode: existing.mode,
        isActive: existing.isActive,
        stepsCount: existing.steps.length,
      } as Prisma.InputJsonValue,
      newValue: {
        mode: updated.mode,
        isActive: updated.isActive,
        stepsCount: updated.steps.length,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json(updated);
}

// DELETE — Delete a workflow config
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get("workflowId");

  if (!workflowId) {
    return NextResponse.json({ error: "workflowId requis" }, { status: 400 });
  }

  const existing = await prisma.workflowConfig.findUnique({
    where: { id: workflowId },
    include: { steps: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Workflow non trouvé" }, { status: 404 });
  }

  await prisma.workflowStep.deleteMany({ where: { workflowConfigId: workflowId } });
  await prisma.workflowConfig.delete({ where: { id: workflowId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "WORKFLOW_DELETED",
      entityType: "WorkflowConfig",
      entityId: workflowId,
      oldValue: {
        officeId: existing.officeId,
        mode: existing.mode,
        stepsCount: existing.steps.length,
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ success: true });
}
