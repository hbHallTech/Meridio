import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { getDeviceInfo, isNewDevice, type DeviceInfo } from "@/lib/device";
import {
  notifyAccountLocked,
  notifyNewLoginDetected,
  createAuditLog,
} from "@/lib/notifications";
import {
  sendNewDeviceLoginEmail,
  sendAccountLockedEmail,
  sendAdminPasswordChangedEmail,
} from "@/lib/email";
import {
  isPasswordExpired,
  generateStrongPassword,
  calculatePasswordExpiresAt,
  buildPasswordHistory,
} from "@/lib/password";
import type { UserRole } from "@prisma/client";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const LOCK_DURATION_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    authorized: authConfig.callbacks?.authorized,
    async jwt({ token, user, trigger, session }) {
      // 1. At login — fetch from DB once
      if (user && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            roles: true,
            officeId: true,
            language: true,
            forcePasswordChange: true,
          },
        });
        if (dbUser) {
          token.roles = dbUser.roles;
          token.officeId = dbUser.officeId;
          token.language = dbUser.language;
          token.forcePasswordChange = dbUser.forcePasswordChange;
        }
        token.twoFactorVerified = !process.env.SMTP_USER;
        token.lastActivity = Date.now();
      }
      // 2. Session updates (language switch, 2FA verify, force password change)
      if (trigger === "update" && session) {
        if (session.twoFactorVerified !== undefined) {
          token.twoFactorVerified = session.twoFactorVerified;
        }
        if (session.language !== undefined) {
          token.language = session.language;
        }
        if (session.forcePasswordChange !== undefined) {
          token.forcePasswordChange = session.forcePasswordChange;
        }
        // Refresh lastActivity on session update
        token.lastActivity = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.roles) session.user.roles = token.roles as UserRole[];
      if (token.officeId !== undefined)
        session.user.officeId = token.officeId as string;
      if (token.language) session.user.language = token.language as string;
      if (token.twoFactorVerified !== undefined)
        session.user.twoFactorVerified = token.twoFactorVerified as boolean;
      if (token.forcePasswordChange !== undefined)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).forcePasswordChange = token.forcePasswordChange;
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

        const isPasswordValid = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          const attempts = user.failedLoginAttempts + 1;
          const updateData: Record<string, unknown> = {
            failedLoginAttempts: attempts,
          };

          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);

            // Audit log + notification for lockout
            await createAuditLog({
              userId: user.id,
              action: "ACCOUNT_LOCKED",
              entityType: "User",
              entityId: user.id,
              newValue: {
                attempts,
                lockDurationMinutes: LOCK_DURATION_MINUTES,
              },
            }).catch(() => {});

            await notifyAccountLocked(
              user.id,
              LOCK_DURATION_MINUTES
            ).catch(() => {});

            // Notify admins by email
            const admins = await prisma.user.findMany({
              where: { roles: { has: "ADMIN" }, isActive: true },
              select: { email: true, firstName: true },
            });
            for (const admin of admins) {
              await sendAccountLockedEmail(
                admin.email,
                admin.firstName,
                `${user.firstName} ${user.lastName}`,
                user.email
              ).catch(() => {});
            }
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });

          // Audit log for failed login
          await createAuditLog({
            userId: user.id,
            action: "LOGIN_FAILED",
            entityType: "User",
            entityId: user.id,
            newValue: { attempts },
          }).catch(() => {});

          if (attempts >= MAX_LOGIN_ATTEMPTS) {
            throw new Error("ACCOUNT_LOCKED:15");
          }

          throw new Error(
            `INVALID_CREDENTIALS:${MAX_LOGIN_ATTEMPTS - attempts}`
          );
        }

        // ── Password expired check ──
        if (isPasswordExpired(user.passwordExpiresAt)) {
          const tempPassword = generateStrongPassword();
          const newHash = await bcrypt.hash(tempPassword, 12);
          const newHistory = buildPasswordHistory(
            newHash,
            (user.passwordHistory as string[] | null) ?? null
          );

          await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordHash: newHash,
              passwordExpiresAt: calculatePasswordExpiresAt(),
              lastPasswordChangeAt: new Date(),
              forcePasswordChange: true,
              passwordHistory: newHistory,
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          });

          // Send the temporary password by email
          await sendAdminPasswordChangedEmail(
            user.email,
            user.firstName,
            tempPassword
          ).catch(() => {});

          await createAuditLog({
            userId: user.id,
            action: "PASSWORD_AUTO_RESET",
            entityType: "User",
            entityId: user.id,
            newValue: { reason: "password_expired" },
          }).catch(() => {});

          throw new Error("PASSWORD_EXPIRED_RESET");
        }

        // ── Successful login ──

        // Reset failed attempts on success
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });

        // Audit log for successful login
        await createAuditLog({
          userId: user.id,
          action: "LOGIN_SUCCESS",
          entityType: "User",
          entityId: user.id,
        }).catch(() => {});

        // ── New device detection ──
        try {
          const deviceInfo = await getDeviceInfo();
          const storedDevice = user.lastLoginDevice as DeviceInfo | null;

          if (isNewDevice(deviceInfo, storedDevice)) {
            await notifyNewLoginDetected(
              user.id,
              deviceInfo.ip,
              deviceInfo.userAgent
            ).catch(() => {});

            await sendNewDeviceLoginEmail(
              user.email,
              user.firstName,
              deviceInfo.ip,
              deviceInfo.userAgent
            ).catch(() => {});

            await createAuditLog({
              userId: user.id,
              action: "NEW_DEVICE_LOGIN",
              entityType: "User",
              entityId: user.id,
              newValue: {
                ip: deviceInfo.ip,
                userAgent: deviceInfo.userAgent,
              },
            }).catch(() => {});
          }

          // Update stored device
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginDevice: deviceInfo },
          });
        } catch {
          // Don't block login if device detection fails
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
