import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Allow up to 60s on Vercel Pro (hobby is capped at 10s regardless)
export const maxDuration = 60;

/**
 * POST /api/admin/import-documents
 *
 * Manual trigger for the email import pipeline.
 * Requires ADMIN or HR role (session-authenticated, for use from the settings UI).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("HR")) {
    return NextResponse.json({ error: "Accès réservé Admin/RH" }, { status: 403 });
  }

  try {
    // Dynamic import to avoid pulling heavy deps at module load time
    const { processIncomingEmails } = await import("@/lib/document-import");

    // Route-level timeout: 55 seconds (maxDuration=60 gives us headroom)
    const ROUTE_TIMEOUT = 55_000;
    const result = await Promise.race([
      processIncomingEmails(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Import timeout — la connexion IMAP prend trop de temps. Vérifiez l'hôte, le port et les identifiants.")),
          ROUTE_TIMEOUT
        )
      ),
    ]);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/import-documents] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: message,
        processed: 0,
        created: 0,
        errors: [message],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
