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

// Wrap auth middleware with rate limiting
export default auth(function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check rate limiting for specific routes
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

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*|favicon.ico).*)"],
};
