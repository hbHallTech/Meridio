import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    roles?: UserRole[];
    officeId?: string;
    language?: string;
    twoFactorVerified?: boolean;
  }
}

export const authConfig: NextAuthConfig = {
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
        token.language = user.language;
        token.twoFactorVerified = user.twoFactorVerified;
      }
      if (trigger === "update" && session) {
        if (session.twoFactorVerified !== undefined) {
          token.twoFactorVerified = session.twoFactorVerified;
        }
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
      session.user.language = (token.language as string) ?? "fr";
      session.user.twoFactorVerified =
        (token.twoFactorVerified as boolean) ?? false;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const publicPaths = [
        "/login",
        "/forgot-password",
        "/reset-password",
        "/api/auth",
      ];
      const isPublicPath = publicPaths.some((path) =>
        pathname.startsWith(path)
      );

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

      return true;
    },
  },
};
