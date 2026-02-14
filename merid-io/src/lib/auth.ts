import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import type { UserRole } from "@prisma/client";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    authorized: authConfig.callbacks?.authorized,
    async jwt({ token, user, trigger, session }) {
      // 1. At login — fetch from DB once (authorize may not pass custom fields)
      if (user && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { roles: true, officeId: true, language: true },
        });
        if (dbUser) {
          token.roles = dbUser.roles;
          token.officeId = dbUser.officeId;
          token.language = dbUser.language;
        }
        token.twoFactorVerified = !process.env.SMTP_USER;
      }
      // 2. Session updates (language switch, 2FA verify)
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
      if (token.sub) session.user.id = token.sub;
      if (token.roles) session.user.roles = token.roles as UserRole[];
      if (token.officeId !== undefined) session.user.officeId = token.officeId as string;
      if (token.language) session.user.language = token.language as string;
      if (token.twoFactorVerified !== undefined)
        session.user.twoFactorVerified = token.twoFactorVerified as boolean;
      return session;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("MISSING_CREDENTIALS");
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) {
          throw new Error("INVALID_CREDENTIALS");
        }

        // Check brute force lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          const minutesLeft = Math.ceil(
            (user.lockedUntil.getTime() - Date.now()) / 60000
          );
          throw new Error(`ACCOUNT_LOCKED:${minutesLeft}`);
        }

        // Reset lock if expired
        if (user.lockedUntil && user.lockedUntil <= new Date()) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
          const attempts = user.failedLoginAttempts + 1;
          const updateData: Record<string, unknown> = {
            failedLoginAttempts: attempts,
          };

          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });

          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            throw new Error("ACCOUNT_LOCKED:15");
          }

          throw new Error(`INVALID_CREDENTIALS:${MAX_LOGIN_ATTEMPTS - attempts}`);
        }

        // Reset failed attempts on success
        if (user.failedLoginAttempts > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          roles: user.roles,
          officeId: user.officeId,
          language: user.language,
          twoFactorVerified: !process.env.SMTP_USER,
        };
      },
    }),
  ],
});
