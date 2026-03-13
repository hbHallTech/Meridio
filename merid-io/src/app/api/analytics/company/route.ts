import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { computeCompanyAnalytics, analyticsToCSV } from "@/lib/analytics";

/**
 * GET /api/analytics/company?format=csv
 *
 * Company-wide people analytics. HR/ADMIN/SUPER_ADMIN only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const roles = session.user.roles ?? [];
    if (!roles.includes("HR") && !roles.includes("ADMIN") && !roles.includes("SUPER_ADMIN")) {
      return NextResponse.json({ error: "Accès réservé RH/Admin" }, { status: 403 });
    }

    const data = await computeCompanyAnalytics();

    const format = request.nextUrl.searchParams.get("format");
    if (format === "csv") {
      const csv = analyticsToCSV(data);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="analytics-company-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[analytics/company] GET error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
