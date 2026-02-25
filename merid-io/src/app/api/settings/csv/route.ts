import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/settings/csv
 *
 * Returns the company-wide CSV separator setting.
 * Accessible to any authenticated user (used by client-side CSV exports).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const company = await prisma.company.findFirst({
    select: { csvSeparator: true },
  });

  return NextResponse.json({
    separator: company?.csvSeparator || ",",
  });
}
