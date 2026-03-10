import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    roles?: UserRole[];
    officeId?: string;
    teamId?: string | null;
    language?: string;
    twoFactorVerified?: boolean;
    companyId?: string;
  }
}

/**
 * Role-based route access control.
 * Maps route prefixes to the roles allowed to access them.
 * SUPER_ADMIN inherits access to all restricted routes.
 */
const ROUTE_ROLE_MAP: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/super-admin", roles: ["SUPER_ADMIN"] },
  { prefix: "/api/super-admin", roles: ["SUPER_ADMIN"] },
  // HR can access user management pages and APIs
  { prefix: "/admin/users", roles: ["HR", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/api/admin/users", roles: ["HR", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/api/admin", roles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/manager", roles: ["MANAGER", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/api/manager", roles: ["MANAGER", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/hr", roles: ["HR", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/api/hr", roles: ["HR", "ADMIN", "SUPER_ADMIN"] },
];

export function hasRequiredRole(pathname: string, userRoles: UserRole[]): boolean {
  for (const route of ROUTE_ROLE_MAP) {
    if (pathname.startsWith(route.prefix)) {
      return userRoles.some((r) => route.roles.includes(r));
    }
  }
  // No role restriction for this path
  return true;
}

export const authConfig: NextAuthConfig = {
  // Trust the Host header from the request. Required for Vercel preview
  // deployments where the URL differs from NEXTAUTH_URL (production).
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [], // Providers added in auth.ts (not needed for middleware)
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.roles = user.roles;
        token.officeId = user.officeId;
        token.teamId = user.teamId;
        token.language = user.language;
        token.twoFactorVerified = user.twoFactorVerified;
        token.companyId = user.companyId;
      }
      if (trigger === "update" && session) {
        // C1: twoFactorVerified is only read from DB server-side, never from client
        if (session.language !== undefined) {
          token.language = session.language;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.roles = (token.roles as UserRole[]) ?? [];
      session.user.officeId = (token.officeId as string) ?? "";
      session.user.teamId = (token.teamId as string | null) ?? null;
      session.user.language = (token.language as string) ?? "fr";
      session.user.twoFactorVerified =
        (token.twoFactorVerified as boolean) ?? false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session.user as any).companyId = (token.companyId as string) ?? "";
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const publicPaths = [
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/api/auth",
        "/api/cron",
        "/api/signup-request",
        "/api/demo-request",
        "/api/debug-auth",
        "/api/contact",
      ];
      const isPublicPath = publicPaths.some((path) =>
        pathname.startsWith(path)
      );

      // Landing page is public (exact match to avoid making all paths public)
      if (pathname === "/") return true;
      if (isPublicPath) return true;

      if (!isLoggedIn) {
        return Response.redirect(
          new URL(
            `/login?callbackUrl=${encodeURIComponent(pathname)}`,
            nextUrl.origin
          )
        );
      }

      // Check 2FA
      const twoFactorVerified = auth?.user?.twoFactorVerified;
      if (!twoFactorVerified && pathname !== "/login/verify") {
        return Response.redirect(new URL("/login/verify", nextUrl.origin));
      }

      // Check forcePasswordChange — redirect to change-password page
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const forcePasswordChange = (auth?.user as any)?.forcePasswordChange;
      if (
        forcePasswordChange &&
        pathname !== "/auth/change-password" &&
        pathname !== "/api/profile/password"
      ) {
        return Response.redirect(
          new URL("/auth/change-password", nextUrl.origin)
        );
      }

      // RBAC: Check role-based access for protected routes.
      // In Edge middleware, auth.user.roles may not be populated by the
      // session callback. Fall back to reading roles from the raw JWT token.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authAny = auth as any;
      const userRoles: UserRole[] =
        (auth?.user?.roles as UserRole[]) ??
        (authAny?.roles as UserRole[]) ??
        [];
      if (!hasRequiredRole(pathname, userRoles)) {
        console.warn(
          `[RBAC/middleware] Access denied: pathname=${pathname} roles=[${userRoles}]`
        );
        // For API routes, return 403 JSON response
        if (pathname.startsWith("/api/")) {
          return Response.json(
            { error: "Accès non autorisé" },
            { status: 403 }
          );
        }
        // For page routes, redirect to dashboard
        return Response.redirect(new URL("/", nextUrl.origin));
      }

      return true;
    },
  },
};
