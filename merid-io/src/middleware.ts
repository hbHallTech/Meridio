import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { checkRateLimit, RATE_LIMITS, getRequestIp } from "@/lib/rate-limit";

const { auth } = NextAuth(authConfig);

// Rate-limited routes configuration
const RATE_LIMITED_ROUTES: Record<
  string,
  { limit: { maxRequests: number; windowMs: number }; method: string }
> = {
  "/api/auth/callback/credentials": {
    limit: RATE_LIMITS.signin,
    method: "POST",
  },
  "/api/auth/forgot-password": {
    limit: RATE_LIMITS.resetPassword,
    method: "POST",
  },
  "/api/auth/2fa/verify": {
    limit: RATE_LIMITS.twoFactorVerify,
    method: "POST",
  },
  "/api/auth/2fa/send": {
    limit: RATE_LIMITS.twoFactorSend,
    method: "POST",
  },
};

function applyRateLimit(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const routeConfig = RATE_LIMITED_ROUTES[pathname];
  if (routeConfig && request.method === routeConfig.method) {
    const ip = getRequestIp(request.headers);
    const key = `${ip}:${pathname}`;
    const result = checkRateLimit(key, routeConfig.limit);
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Trop de requetes. Veuillez reessayer plus tard." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((result.resetAt - Date.now()) / 1000)
            ),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }
  return null;
}

// NextAuth core endpoints (session, providers, callback, csrf, signin, signout).
// These are handled by the [...nextauth] route handler and should NOT go through
// the NextAuth Edge middleware wrapper which can crash in Edge Runtime.
const NEXTAUTH_CORE_PATHS = [
  "/api/auth/session",
  "/api/auth/providers",
  "/api/auth/callback",
  "/api/auth/csrf",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/auth/error",
];

function isNextAuthCorePath(pathname: string): boolean {
  return NEXTAUTH_CORE_PATHS.some((p) => pathname.startsWith(p));
}

// Auth-wrapped middleware for all routes EXCEPT NextAuth core endpoints
const authMiddleware = auth(function middleware(request: NextRequest) {
  try {
    const rateLimitResponse = applyRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;
    return NextResponse.next();
  } catch (err) {
    console.error("[middleware] CRASH:", err instanceof Error ? err.message : err);
    return NextResponse.next();
  }
});

// Main middleware: skip NextAuth wrapper for core auth endpoints
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NextAuth core endpoints: apply rate limiting only, skip auth wrapper
  if (isNextAuthCorePath(pathname)) {
    try {
      const rateLimitResponse = applyRateLimit(request);
      if (rateLimitResponse) return rateLimitResponse;
      return NextResponse.next();
    } catch (err) {
      console.error("[middleware] CRASH on auth path:", err instanceof Error ? err.message : err);
      return NextResponse.next();
    }
  }

  // All other routes: go through NextAuth auth wrapper (RBAC, 2FA check, etc.)
  return authMiddleware(request, {} as any);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*|favicon.ico).*)"],
};
