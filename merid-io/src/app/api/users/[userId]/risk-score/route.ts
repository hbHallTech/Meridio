import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { computeUserRiskScore } from "@/lib/analytics";

/**
 * GET /api/users/[userId]/risk-score
 *
 * Individual flight risk score. HR/ADMIN/SUPER_ADMIN only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const roles = session.user.roles ?? [];
    if (!roles.includes("HR") && !roles.includes("ADMIN") && !roles.includes("SUPER_ADMIN")) {
      return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
    }

    const { userId } = await params;
    const result = await computeUserRiskScore(userId);

    if (!result) {
      return NextResponse.json({ error: "Utilisateur introuvable ou inactif" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[users/risk-score] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
