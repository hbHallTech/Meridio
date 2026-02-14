import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";

// GET — List all users
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "admin:access")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const officeFilter = searchParams.get("office") ?? "";
  const teamFilter = searchParams.get("team") ?? "";
  const roleFilter = searchParams.get("role") ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (officeFilter) where.officeId = officeFilter;
  if (teamFilter) where.teamId = teamFilter;
  if (roleFilter) where.roles = { has: roleFilter as UserRole };
  if (statusFilter === "active") where.isActive = true;
  else if (statusFilter === "inactive") where.isActive = false;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      roles: true,
      isActive: true,
      hireDate: true,
      createdAt: true,
      office: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const offices = await prisma.office.findMany({
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });

  const teams = await prisma.team.findMany({
    select: { id: true, name: true, officeId: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users, offices, teams });
}

// POST — Create a new user
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userRoles = (session.user as { roles?: UserRole[] }).roles ?? [];
  if (!hasPermission(userRoles, "user:create")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  const {
    firstName,
    lastName,
    email,
    officeId,
    teamId,
    roles,
    hireDate,
    password,
  } = body;

  // Validation
  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !officeId || !roles?.length || !hireDate || !password) {
    return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail.endsWith("@halley-technologies.ch")) {
    return NextResponse.json({ error: "L'email doit être @halley-technologies.ch" }, { status: 400 });
  }

  // Check duplicate
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await prisma.user.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      passwordHash,
      officeId,
      teamId: teamId || null,
      roles: roles as UserRole[],
      hireDate: new Date(hireDate),
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      roles: true,
    },
  });

  // Create initial leave balances for current year
  const office = await prisma.office.findUnique({
    where: { id: officeId },
    select: { defaultAnnualLeave: true, defaultOfferedDays: true },
  });

  if (office) {
    const currentYear = new Date().getFullYear();
    await prisma.leaveBalance.createMany({
      data: [
        {
          userId: newUser.id,
          year: currentYear,
          balanceType: "ANNUAL",
          totalDays: office.defaultAnnualLeave,
        },
        {
          userId: newUser.id,
          year: currentYear,
          balanceType: "OFFERED",
          totalDays: office.defaultOfferedDays,
        },
      ],
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: newUser.id,
      newValue: { firstName: newUser.firstName, lastName: newUser.lastName, email: newUser.email, roles: newUser.roles },
    },
  });

  // Send welcome email
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await sendEmail({
    to: normalizedEmail,
    subject: "Meridio - Bienvenue chez Halley-Technologies",
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="background-color: #1B3A5C; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Halley-Technologies</h1>
            <p style="color: #00BCD4; margin: 4px 0 0; font-size: 14px;">Meridio - Gestion des congés</p>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #1B3A5C; margin-top: 0;">Bienvenue ${firstName} !</h2>
            <p>Votre compte Meridio a été créé. Voici vos identifiants :</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${normalizedEmail}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Mot de passe</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${password}</td></tr>
            </table>
            <p style="color: #EF4444; font-weight: 600;">Veuillez changer votre mot de passe lors de votre première connexion.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${appUrl}/login" style="display: inline-block; background-color: #1B3A5C; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Se connecter</a>
            </div>
          </div>
          <div style="background-color: #f8f9fa; padding: 16px 24px; text-align: center; font-size: 12px; color: #6b7280;">
            <p style="margin: 0;">Cet email a été envoyé automatiquement par Meridio.</p>
            <p style="margin: 4px 0 0;">Halley-Technologies SA &copy; ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  return NextResponse.json(newUser, { status: 201 });
}
