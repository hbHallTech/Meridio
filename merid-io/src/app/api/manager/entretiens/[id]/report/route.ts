import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SkillEntry {
  skillName: string;
  selfLevel?: string | null;
  managerLevel?: string | null;
  comment?: string;
}
interface ObjectiveEntry {
  title: string;
  status?: string;
  selfProgress?: number;
  managerProgress?: number;
  selfComment?: string;
  managerComment?: string;
}

/**
 * POST /api/manager/entretiens/[id]/report
 * Generate a comparative report (self vs manager evaluation).
 * Works once both evaluations are done (status = DRAFT_MANAGER with managerSkills filled, or COMPLETED).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;

    const entretien = await prisma.entretien.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!entretien) {
      return NextResponse.json({ error: "Entretien introuvable" }, { status: 404 });
    }
    if (entretien.managerId !== session.user.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }
    if (!entretien.managerSkills && !entretien.managerObjectives) {
      return NextResponse.json(
        { error: "Veuillez d'abord compléter votre évaluation avant de générer le rapport." },
        { status: 400 }
      );
    }

    // Generate report locally (no external AI dependency)
    const report = generateReport(entretien);

    const updated = await prisma.entretien.update({
      where: { id },
      data: { summaryReport: report },
    });

    return NextResponse.json({ report: updated.summaryReport });
  } catch (err) {
    console.error("[manager/entretiens/report] POST error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

const LEVEL_MAP: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

function generateReport(entretien: {
  year: number;
  user: { firstName: string; lastName: string };
  selfSkills: unknown;
  managerSkills: unknown;
  selfObjectives: unknown;
  managerObjectives: unknown;
  selfStrengths: string | null;
  managerStrengths: string | null;
  selfImprovements: string | null;
  managerImprovements: string | null;
}): string {
  const { user, year } = entretien;
  const selfSkills = (entretien.selfSkills as SkillEntry[]) || [];
  const managerSkills = (entretien.managerSkills as SkillEntry[]) || [];
  const selfObjectives = (entretien.selfObjectives as ObjectiveEntry[]) || [];
  const managerObjectives = (entretien.managerObjectives as ObjectiveEntry[]) || [];

  const lines: string[] = [];
  lines.push(`# Rapport d'Entretien Annuel ${year}`);
  lines.push(`**Collaborateur** : ${user.firstName} ${user.lastName}`);
  lines.push("");

  // Skills comparison
  lines.push("## Compétences");
  lines.push("");
  lines.push("| Compétence | Auto-évaluation | Évaluation Manager | Écart |");
  lines.push("|---|---|---|---|");

  const managerSkillMap = new Map(managerSkills.map((s) => [s.skillName, s]));
  let skillMatches = 0;
  let skillTotal = 0;

  for (const self of selfSkills) {
    const mgr = managerSkillMap.get(self.skillName);
    const selfLvl = self.selfLevel || "—";
    const mgrLvl = mgr?.managerLevel || "—";
    const selfNum = LEVEL_MAP[selfLvl] || 0;
    const mgrNum = LEVEL_MAP[String(mgrLvl)] || 0;
    const gap = selfNum && mgrNum ? selfNum - mgrNum : null;
    const gapStr = gap === null ? "—" : gap === 0 ? "=" : gap > 0 ? `+${gap}` : `${gap}`;
    if (gap === 0) skillMatches++;
    if (selfNum && mgrNum) skillTotal++;
    lines.push(`| ${self.skillName} | ${selfLvl} | ${mgrLvl} | ${gapStr} |`);
  }

  lines.push("");
  if (skillTotal > 0) {
    const matchPct = Math.round((skillMatches / skillTotal) * 100);
    lines.push(`**Correspondance compétences** : ${matchPct}% (${skillMatches}/${skillTotal} en accord)`);
  }
  lines.push("");

  // Objectives comparison
  lines.push("## Objectifs");
  lines.push("");
  lines.push("| Objectif | Statut | Progrès (self) | Progrès (manager) |");
  lines.push("|---|---|---|---|");

  const mgrObjMap = new Map(managerObjectives.map((o) => [o.title, o]));
  let achieved = 0;

  for (const self of selfObjectives) {
    const mgr = mgrObjMap.get(self.title);
    const status = self.status || "—";
    const selfProg = `${self.selfProgress ?? 0}%`;
    const mgrProg = mgr?.managerProgress !== undefined ? `${mgr.managerProgress}%` : "—";
    if (status === "ACHIEVED") achieved++;
    lines.push(`| ${self.title} | ${status} | ${selfProg} | ${mgrProg} |`);
  }

  lines.push("");
  if (selfObjectives.length > 0) {
    const achievedPct = Math.round((achieved / selfObjectives.length) * 100);
    lines.push(`**Objectifs atteints** : ${achievedPct}% (${achieved}/${selfObjectives.length})`);
  }
  lines.push("");

  // Strengths and improvements
  lines.push("## Points forts");
  if (entretien.selfStrengths) lines.push(`- **Collaborateur** : ${entretien.selfStrengths}`);
  if (entretien.managerStrengths) lines.push(`- **Manager** : ${entretien.managerStrengths}`);
  lines.push("");

  lines.push("## Axes d'amélioration");
  if (entretien.selfImprovements) lines.push(`- **Collaborateur** : ${entretien.selfImprovements}`);
  if (entretien.managerImprovements) lines.push(`- **Manager** : ${entretien.managerImprovements}`);
  lines.push("");

  return lines.join("\n");
}
