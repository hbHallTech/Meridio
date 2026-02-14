import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);
const { auth } = NextAuth(authConfig);

/**
 * Combined proxy handling NextAuth authentication + next-intl locale routing.
 * In Next.js 16, proxy.ts replaces middleware.ts.
 */
export default auth((req) => {
  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|.*\\..*|favicon.ico).*)"],
};
