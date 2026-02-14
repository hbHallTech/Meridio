import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { encrypt, decrypt } from "@/lib/crypto";
import { resetEmailTransportCache } from "@/lib/email";
import type { UserRole } from "@prisma/client";
import nodemailer from "nodemailer";

// GET — Read notification settings (never expose password)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const settings = await prisma.notificationSettings.findUnique({
    where: { id: 1 },
    include: { updatedBy: { select: { firstName: true, lastName: true } } },
  });

  if (!settings) {
    return NextResponse.json({
      settings: {
        smtpHost: "",
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: "",
        smtpFrom: "no-reply@meridio.fr",
        hasPassword: false,
        notifyNewLeaveRequest: true,
        notifyLeaveApproved: true,
        notifyLeaveRejected: true,
        notifyLeaveNeedsRevision: true,
        notifyLeaveReminder: true,
        notifyAnnualClosure: true,
        notifyPasswordChanged: true,
        updatedAt: null,
        updatedBy: null,
      },
    });
  }

  return NextResponse.json({
    settings: {
      smtpHost: settings.smtpHost ?? "",
      smtpPort: settings.smtpPort ?? 587,
      smtpSecure: settings.smtpSecure,
      smtpUser: settings.smtpUser ?? "",
      smtpFrom: settings.smtpFrom ?? "no-reply@meridio.fr",
      hasPassword: !!settings.smtpPassEncrypted,
      notifyNewLeaveRequest: settings.notifyNewLeaveRequest,
      notifyLeaveApproved: settings.notifyLeaveApproved,
      notifyLeaveRejected: settings.notifyLeaveRejected,
      notifyLeaveNeedsRevision: settings.notifyLeaveNeedsRevision,
      notifyLeaveReminder: settings.notifyLeaveReminder,
      notifyAnnualClosure: settings.notifyAnnualClosure,
      notifyPasswordChanged: settings.notifyPasswordChanged,
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedBy
        ? `${settings.updatedBy.firstName} ${settings.updatedBy.lastName}`
        : null,
    },
  });
}

// PATCH — Update notification settings (upsert)
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json();

  // Build update data
  const data: Record<string, unknown> = {
    updatedById: session.user.id,
  };

  // SMTP fields
  if (body.smtpHost !== undefined) data.smtpHost = body.smtpHost || null;
  if (body.smtpPort !== undefined) data.smtpPort = body.smtpPort ? Number(body.smtpPort) : 587;
  if (body.smtpSecure !== undefined) data.smtpSecure = Boolean(body.smtpSecure);
  if (body.smtpUser !== undefined) data.smtpUser = body.smtpUser || null;
  if (body.smtpFrom !== undefined) data.smtpFrom = body.smtpFrom || null;

  // Encrypt password if provided (empty string = clear it)
  if (body.smtpPassword !== undefined) {
    if (body.smtpPassword === "") {
      data.smtpPassEncrypted = null;
    } else {
      data.smtpPassEncrypted = encrypt(body.smtpPassword);
    }
  }

  // Toggle fields
  const toggleFields = [
    "notifyNewLeaveRequest",
    "notifyLeaveApproved",
    "notifyLeaveRejected",
    "notifyLeaveNeedsRevision",
    "notifyLeaveReminder",
    "notifyAnnualClosure",
    "notifyPasswordChanged",
  ] as const;

  for (const field of toggleFields) {
    if (body[field] !== undefined) {
      data[field] = Boolean(body[field]);
    }
  }

  const settings = await prisma.notificationSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  // Invalidate email transport cache
  resetEmailTransportCache();

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "NOTIFICATION_SETTINGS_UPDATED",
      entityType: "NotificationSettings",
      entityId: "1",
      newValue: {
        ...data,
        smtpPassEncrypted: data.smtpPassEncrypted ? "[ENCRYPTED]" : null,
      },
    },
  });

  return NextResponse.json({
    settings: {
      smtpHost: settings.smtpHost ?? "",
      smtpPort: settings.smtpPort ?? 587,
      smtpSecure: settings.smtpSecure,
      smtpUser: settings.smtpUser ?? "",
      smtpFrom: settings.smtpFrom ?? "no-reply@meridio.fr",
      hasPassword: !!settings.smtpPassEncrypted,
      notifyNewLeaveRequest: settings.notifyNewLeaveRequest,
      notifyLeaveApproved: settings.notifyLeaveApproved,
      notifyLeaveRejected: settings.notifyLeaveRejected,
      notifyLeaveNeedsRevision: settings.notifyLeaveNeedsRevision,
      notifyLeaveReminder: settings.notifyLeaveReminder,
      notifyAnnualClosure: settings.notifyAnnualClosure,
      notifyPasswordChanged: settings.notifyPasswordChanged,
    },
  });
}

// POST — Test SMTP connection
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json();

  // Use provided values, falling back to stored settings
  let host = body.smtpHost;
  let port = body.smtpPort ? Number(body.smtpPort) : 587;
  let secure = Boolean(body.smtpSecure);
  let user = body.smtpUser;
  let pass = body.smtpPassword;

  // If password not provided, try to get from DB
  if (!pass) {
    const settings = await prisma.notificationSettings.findUnique({ where: { id: 1 } });
    if (settings?.smtpPassEncrypted) {
      try {
        pass = decrypt(settings.smtpPassEncrypted);
      } catch {
        return NextResponse.json(
          { error: "Impossible de déchiffrer le mot de passe stocké" },
          { status: 500 }
        );
      }
    }
    // Fill missing fields from DB
    if (!host && settings?.smtpHost) host = settings.smtpHost;
    if (!user && settings?.smtpUser) user = settings.smtpUser;
    if (settings?.smtpPort) port = settings.smtpPort;
    if (settings) secure = settings.smtpSecure;
  }

  if (!host || !user || !pass) {
    return NextResponse.json(
      { error: "Configuration SMTP incomplète (hôte, utilisateur et mot de passe requis)" },
      { status: 400 }
    );
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { ciphers: "SSLv3", rejectUnauthorized: false },
    });

    await transport.verify();

    return NextResponse.json({ success: true, message: "Connexion SMTP réussie" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Échec de la connexion SMTP : ${message}` },
      { status: 500 }
    );
  }
}
