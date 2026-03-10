import { NextRequest, NextResponse } from "next/server";

let handlers: { GET: (req: NextRequest) => Promise<Response>; POST: (req: NextRequest) => Promise<Response> };
let importError: Error | null = null;

try {
  const auth = await import("@/lib/auth");
  handlers = auth.handlers as typeof handlers;
} catch (e) {
  importError = e instanceof Error ? e : new Error(String(e));
  console.error("[auth/route] Failed to import @/lib/auth:", importError.message, importError.stack);
  // Provide fallback handlers that return the error
  handlers = {
    GET: async () => NextResponse.json({ error: "Auth module failed to load", details: importError?.message }, { status: 500 }),
    POST: async () => NextResponse.json({ error: "Auth module failed to load", details: importError?.message }, { status: 500 }),
  };
}

export async function GET(req: NextRequest) {
  try {
    return await handlers.GET(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[auth/route] GET error:", msg);
    return NextResponse.json({ error: "Auth handler error", details: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handlers.POST(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[auth/route] POST error:", msg);
    return NextResponse.json({ error: "Auth handler error", details: msg }, { status: 500 });
  }
}
