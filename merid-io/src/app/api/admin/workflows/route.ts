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
  officeId: z.string().min(1, "Le bureau est requis"),
  mode: z.enum(["SEQUENTIAL", "PARALLEL"]),
  isActive: z.boolean(),
  steps: z.array(workflowStepSchema).min(1, "Au moins une étape est requise"),
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
    const parsed = workflowSchema.parse(body);

    const workflow = await prisma.$transaction(async (tx) => {
      const config = await tx.workflowConfig.create({
        data: {
          officeId: parsed.officeId,
          mode: parsed.mode,
          isActive: parsed.isActive,
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
        },
      });
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

    const parsed = workflowSchema.parse(rest);

    const workflow = await prisma.$transaction(async (tx) => {
      // Update the workflow config
      await tx.workflowConfig.update({
        where: { id },
        data: {
          officeId: parsed.officeId,
          mode: parsed.mode,
          isActive: parsed.isActive,
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
        },
      });
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

    // Delete steps first (no cascade), then delete the workflow
    await prisma.$transaction(async (tx) => {
      await tx.workflowStep.deleteMany({
        where: { workflowConfigId: id },
      });
      await tx.workflowConfig.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la suppression du workflow" }, { status: 500 });
  }
}
