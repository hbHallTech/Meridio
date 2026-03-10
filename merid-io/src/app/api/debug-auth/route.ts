import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const steps: Record<string, string> = {};
  const start = Date.now();

  // Step 1: Basic response
  steps["1_start"] = "ok";

  // Step 2: Try importing prisma
  try {
    const { prisma } = await import("@/lib/prisma");
    steps["2_prisma_import"] = `ok (${Date.now() - start}ms)`;

    // Step 3: Try a simple query
    try {
      const count = await prisma.user.count();
      steps["3_db_query"] = `ok - ${count} users (${Date.now() - start}ms)`;
    } catch (e) {
      steps["3_db_query"] = `FAIL: ${e instanceof Error ? e.message : String(e)} (${Date.now() - start}ms)`;
    }
  } catch (e) {
    steps["2_prisma_import"] = `FAIL: ${e instanceof Error ? e.message : String(e)} (${Date.now() - start}ms)`;
  }

  // Step 4: Try importing auth
  try {
    const { auth } = await import("@/lib/auth");
    steps["4_auth_import"] = `ok (${Date.now() - start}ms)`;

    // Step 5: Try getting session
    try {
      const session = await auth();
      steps["5_auth_session"] = `ok - ${session ? "logged in" : "no session"} (${Date.now() - start}ms)`;
    } catch (e) {
      steps["5_auth_session"] = `FAIL: ${e instanceof Error ? e.message : String(e)} (${Date.now() - start}ms)`;
    }
  } catch (e) {
    steps["4_auth_import"] = `FAIL: ${e instanceof Error ? e.message : String(e)} (${Date.now() - start}ms)`;
  }

  steps["total_ms"] = `${Date.now() - start}ms`;

  return NextResponse.json(steps, { status: 200 });
}
