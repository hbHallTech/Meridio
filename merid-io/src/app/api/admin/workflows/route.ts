import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const workflowStepSchema = z.object({
  stepOrder: z.number().min(1),
  stepType: z.enum(["MANAGER", "HR"]),
  isRequired: z.boolean(),
});

const workflowSchema = z.object({
  officeId: z.string().optional().nullable(),
  mode: z.enum(["SEQUENTIAL", "PARALLEL"]),
  isActive: z.boolean(),
  steps: z.array(workflowStepSchema).min(1, "Au moins une étape est requise"),
  teamIds: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const workflows = await prisma.workflowConfig.findMany({
    include: {
      office: { select: { id: true, name: true } },
      steps: { orderBy: { stepOrder: "asc" } },
      teams: { select: { id: true, name: true, office: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(workflows);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Handle duplicate action
    if (body.action === "duplicate" && body.sourceId) {
      const source = await prisma.workflowConfig.findUnique({
        where: { id: body.sourceId },
        include: { steps: true, teams: true },
      });

      if (!source) {
        return NextResponse.json({ error: "Workflow source introuvable" }, { status: 404 });
      }

      const duplicate = await prisma.$transaction(async (tx) => {
        const config = await tx.workflowConfig.create({
          data: {
            officeId: source.officeId,
            mode: source.mode,
            isActive: false, // Duplicated workflows start inactive
            teams: {
              connect: source.teams.map((t) => ({ id: t.id })),
            },
          },
        });

        await tx.workflowStep.createMany({
          data: source.steps.map((step) => ({
            workflowConfigId: config.id,
            stepOrder: step.stepOrder,
            stepType: step.stepType,
            isRequired: step.isRequired,
          })),
        });

        return tx.workflowConfig.findUnique({
          where: { id: config.id },
          include: {
            office: { select: { id: true, name: true } },
            steps: { orderBy: { stepOrder: "asc" } },
            teams: { select: { id: true, name: true, office: { select: { id: true, name: true } } } },
          },
        });
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id!,
          action: "WORKFLOW_DUPLICATED",
          entityType: "WorkflowConfig",
          entityId: duplicate!.id,
          newValue: JSON.parse(JSON.stringify({ sourceId: body.sourceId })),
        },
      });

      return NextResponse.json(duplicate, { status: 201 });
    }

    const parsed = workflowSchema.parse(body);

    const workflow = await prisma.$transaction(async (tx) => {
      const config = await tx.workflowConfig.create({
        data: {
          officeId: parsed.officeId || null,
          mode: parsed.mode,
          isActive: parsed.isActive,
          teams: parsed.teamIds?.length
            ? { connect: parsed.teamIds.map((id) => ({ id })) }
            : undefined,
        },
      });

      await tx.workflowStep.createMany({
        data: parsed.steps.map((step) => ({
          workflowConfigId: config.id,
          stepOrder: step.stepOrder,
          stepType: step.stepType,
          isRequired: step.isRequired,
        })),
      });

      return tx.workflowConfig.findUnique({
        where: { id: config.id },
        include: {
          office: { select: { id: true, name: true } },
          steps: { orderBy: { stepOrder: "asc" } },
          teams: { select: { id: true, name: true, office: { select: { id: true, name: true } } } },
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "WORKFLOW_CREATED",
        entityType: "WorkflowConfig",
        entityId: workflow!.id,
        newValue: JSON.parse(JSON.stringify({
          mode: parsed.mode,
          isActive: parsed.isActive,
          teamIds: parsed.teamIds || [],
          stepsCount: parsed.steps.length,
        })),
      },
    });

    return NextResponse.json(workflow, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur lors de la création du workflow" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant du workflow est requis" }, { status: 400 });
    }

    // Handle team association/dissociation action
    if (rest.action === "updateTeams" && Array.isArray(rest.teamIds)) {
      const existing = await prisma.workflowConfig.findUnique({
        where: { id },
        include: { teams: { select: { id: true } } },
      });

      if (!existing) {
        return NextResponse.json({ error: "Workflow introuvable" }, { status: 404 });
      }

      const oldTeamIds = existing.teams.map((t) => t.id);

      const workflow = await prisma.workflowConfig.update({
        where: { id },
        data: {
          teams: { set: rest.teamIds.map((tid: string) => ({ id: tid })) },
        },
        include: {
          office: { select: { id: true, name: true } },
          steps: { orderBy: { stepOrder: "asc" } },
          teams: { select: { id: true, name: true, office: { select: { id: true, name: true } } } },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id!,
          action: "WORKFLOW_TEAMS_UPDATED",
          entityType: "WorkflowConfig",
          entityId: id,
          oldValue: JSON.parse(JSON.stringify({ teamIds: oldTeamIds })),
          newValue: JSON.parse(JSON.stringify({ teamIds: rest.teamIds })),
        },
      });

      return NextResponse.json(workflow);
    }

    const parsed = workflowSchema.parse(rest);

    const existing = await prisma.workflowConfig.findUnique({
      where: { id },
      include: { teams: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Workflow introuvable" }, { status: 404 });
    }

    const workflow = await prisma.$transaction(async (tx) => {
      await tx.workflowConfig.update({
        where: { id },
        data: {
          officeId: parsed.officeId || null,
          mode: parsed.mode,
          isActive: parsed.isActive,
          teams: parsed.teamIds
            ? { set: parsed.teamIds.map((tid) => ({ id: tid })) }
            : undefined,
        },
      });

      // Delete old steps and recreate
      await tx.workflowStep.deleteMany({
        where: { workflowConfigId: id },
      });

      await tx.workflowStep.createMany({
        data: parsed.steps.map((step) => ({
          workflowConfigId: id,
          stepOrder: step.stepOrder,
          stepType: step.stepType,
          isRequired: step.isRequired,
        })),
      });

      return tx.workflowConfig.findUnique({
        where: { id },
        include: {
          office: { select: { id: true, name: true } },
          steps: { orderBy: { stepOrder: "asc" } },
          teams: { select: { id: true, name: true, office: { select: { id: true, name: true } } } },
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "WORKFLOW_UPDATED",
        entityType: "WorkflowConfig",
        entityId: id,
        newValue: JSON.parse(JSON.stringify({
          mode: parsed.mode,
          isActive: parsed.isActive,
          teamIds: parsed.teamIds || [],
          stepsCount: parsed.steps.length,
        })),
      },
    });

    return NextResponse.json(workflow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erreur lors de la mise à jour du workflow" }, { status: 500 });
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
      return NextResponse.json({ error: "L'identifiant du workflow est requis" }, { status: 400 });
    }

    // Delete steps first, disconnect teams, then delete the workflow
    await prisma.$transaction(async (tx) => {
      await tx.workflowStep.deleteMany({
        where: { workflowConfigId: id },
      });
      // Disconnect teams (implicit m2m, just delete the config)
      await tx.workflowConfig.update({
        where: { id },
        data: { teams: { set: [] } },
      });
      await tx.workflowConfig.delete({
        where: { id },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "WORKFLOW_DELETED",
        entityType: "WorkflowConfig",
        entityId: id,
        oldValue: JSON.parse(JSON.stringify({ id })),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la suppression du workflow" }, { status: 500 });
  }
}
