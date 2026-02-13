import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/forgot-password", "/reset-password", "/api/auth"];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, api/auth, and public paths
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));
  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check authentication
  const session = await auth();
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check 2FA: if not verified, redirect to verify page
  if (!session.user.twoFactorVerified && pathname !== "/login/verify") {
    return NextResponse.redirect(new URL("/login/verify", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*|favicon.ico).*)"],
};
