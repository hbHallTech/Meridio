import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const company = await prisma.company.findFirst({
    include: {
      _count: { select: { offices: true } },
      offices: {
        select: {
          id: true,
          name: true,
          country: true,
          city: true,
          _count: { select: { users: true } },
        },
        orderBy: { name: "asc" },
      },
      notificationSettings: true,
    },
  });

  if (!company) {
    return NextResponse.json(null);
  }

  // Never return SMTP password to client
  const { smtpPassEncrypted, ...rest } = company;
  return NextResponse.json({
    ...rest,
    smtpPassConfigured: !!smtpPassEncrypted,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, tab, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de l'entreprise est requis" }, { status: 400 });
    }

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (tab === "info") {
      const infoFields = [
        "name", "websiteUrl", "legalForm", "contactLastName", "contactFirstName",
        "address", "addressComplement", "postalCode", "city", "country",
        "email", "phone", "mobile", "fax", "facebook", "twitter", "skype", "logoUrl",
      ];
      for (const f of infoFields) {
        if (fields[f] !== undefined) {
          updateData[f] = fields[f] || null;
        }
      }
      // name is required
      if (fields.name !== undefined) updateData.name = fields.name;
    } else if (tab === "smtp") {
      if (fields.smtpHost !== undefined) updateData.smtpHost = fields.smtpHost || null;
      if (fields.smtpPort !== undefined) updateData.smtpPort = fields.smtpPort ? Number(fields.smtpPort) : null;
      if (fields.smtpSecure !== undefined) updateData.smtpSecure = !!fields.smtpSecure;
      if (fields.smtpUser !== undefined) updateData.smtpUser = fields.smtpUser || null;
      if (fields.smtpFrom !== undefined) updateData.smtpFrom = fields.smtpFrom || null;
      // Only update password if a new one is provided
      if (fields.smtpPass && fields.smtpPass.trim()) {
        try {
          updateData.smtpPassEncrypted = encrypt(fields.smtpPass);
        } catch {
          // If ENCRYPTION_KEY not set, store as-is (development)
          updateData.smtpPassEncrypted = fields.smtpPass;
        }
      }
    } else if (tab === "password") {
      const pwdFields = [
        "pwdExpirationEnabled", "pwdMaxAgeDays", "pwdExpiryAlertDays",
        "pwdMinLength", "pwdRequireLowercase", "pwdRequireUppercase",
        "pwdRequireDigit", "pwdRequireSpecial", "pwdHistoryCount",
        "pwdForceChangeOnFirst", "pwdCheckDictionary",
      ];
      for (const f of pwdFields) {
        if (fields[f] !== undefined) {
          if (typeof fields[f] === "boolean") {
            updateData[f] = fields[f];
          } else {
            updateData[f] = Number(fields[f]) || 0;
          }
        }
      }
    } else if (tab === "notifications") {
      // Handle notification settings separately
      if (Array.isArray(fields.settings)) {
        for (const s of fields.settings) {
          await prisma.companyNotificationSetting.upsert({
            where: { companyId_type: { companyId: id, type: s.type } },
            update: { enabled: s.enabled },
            create: { companyId: id, type: s.type, enabled: s.enabled },
          });
        }
      }
    } else if (tab === "advanced") {
      const advFields = [
        "enforce2FA", "inactivityTimeoutMin", "auditRetentionDays",
        "trialModeEnabled", "documentsModuleEnabled", "privacyPolicyUrl",
      ];
      for (const f of advFields) {
        if (fields[f] !== undefined) {
          if (typeof fields[f] === "boolean") {
            updateData[f] = fields[f];
          } else if (f === "privacyPolicyUrl") {
            updateData[f] = fields[f] || null;
          } else {
            updateData[f] = Number(fields[f]) || 0;
          }
        }
      }
    } else if (tab === "documents") {
      // Documents module configuration
      const boolFields = ["documentsModuleEnabled", "documentsAiEnabled", "documentsWebhookEnabled"];
      const strFields = ["documentsNotifyEmail", "documentsWebhookUrl", "documentsWebhookSecret"];
      for (const f of boolFields) {
        if (fields[f] !== undefined) updateData[f] = !!fields[f];
      }
      for (const f of strFields) {
        if (fields[f] !== undefined) updateData[f] = fields[f] || null;
      }
    } else {
      // Legacy: direct field updates (backward compat)
      if (fields.name !== undefined) updateData.name = fields.name;
      if (fields.websiteUrl !== undefined) updateData.websiteUrl = fields.websiteUrl || null;
      if (fields.logoUrl !== undefined) updateData.logoUrl = fields.logoUrl || null;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.company.update({
        where: { id },
        data: updateData,
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "COMPANY_UPDATED",
        entityType: "Company",
        entityId: id,
        newValue: JSON.parse(JSON.stringify({ tab: tab || "legacy", fields: Object.keys(updateData) })),
      },
    });

    // Return updated company
    const company = await prisma.company.findFirst({
      include: {
        _count: { select: { offices: true } },
        offices: {
          select: {
            id: true, name: true, country: true, city: true,
            _count: { select: { users: true } },
          },
          orderBy: { name: "asc" },
        },
        notificationSettings: true,
      },
    });

    if (!company) return NextResponse.json(null);

    const { smtpPassEncrypted, ...rest } = company;
    return NextResponse.json({
      ...rest,
      smtpPassConfigured: !!smtpPassEncrypted,
    });
  } catch (error) {
    console.error("PATCH /api/admin/company error:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de l'entreprise" }, { status: 500 });
  }
}
