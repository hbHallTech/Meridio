import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendNewAccountEmail, sendAdminPasswordChangedEmail } from "@/lib/email";
import {
  buildPasswordHistory,
  calculatePasswordExpiresAt,
} from "@/lib/password";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      cin: true,
      cnss: true,
      roles: true,
      isActive: true,
      hireDate: true,
      language: true,
      forcePasswordChange: true,
      createdAt: true,
      office: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: { lastName: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      password,
      roles,
      officeId,
      teamId,
      hireDate,
      isActive,
      forcePasswordChange,
      sendNotification,
      cin,
      cnss,
    } = body;

    if (!firstName || !lastName || !email || !password || !roles || !officeId || !hireDate) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Un utilisateur avec cet email existe déjà" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const passwordHistory = await buildPasswordHistory(passwordHash, null);
    const passwordExpiresAt = await calculatePasswordExpiresAt();

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        roles,
        officeId,
        teamId: teamId || null,
        hireDate: new Date(hireDate),
        isActive: isActive ?? true,
        forcePasswordChange: forcePasswordChange ?? true,
        passwordExpiresAt,
        lastPasswordChangeAt: new Date(),
        passwordHistory,
        cin: cin || null,
        cnss: cnss || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        cin: true,
        cnss: true,
        roles: true,
        isActive: true,
        hireDate: true,
        language: true,
        forcePasswordChange: true,
        createdAt: true,
        office: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        newValue: { firstName, lastName, email, roles, officeId, teamId, hireDate, isActive: isActive ?? true },
      },
    });

    if (sendNotification) {
      try {
        await sendNewAccountEmail(email, firstName, password);
      } catch (e) {
        console.error("Failed to send new account email:", e);
      }
    }

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/users error:", error);
    return NextResponse.json({ error: "Erreur lors de la création de l'utilisateur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      id,
      firstName,
      lastName,
      email,
      password,
      roles,
      officeId,
      teamId,
      hireDate,
      isActive,
      forcePasswordChange,
      sendNotification,
      cin,
      cnss,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de l'utilisateur est requis" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return NextResponse.json({ error: "Un utilisateur avec cet email existe déjà" }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (roles !== undefined) updateData.roles = roles;
    if (officeId !== undefined) updateData.officeId = officeId;
    if (teamId !== undefined) updateData.teamId = teamId || null;
    if (hireDate !== undefined) updateData.hireDate = new Date(hireDate);
    if (isActive !== undefined) updateData.isActive = isActive;
    if (forcePasswordChange !== undefined) updateData.forcePasswordChange = forcePasswordChange;
    if (cin !== undefined) updateData.cin = cin || null;
    if (cnss !== undefined) updateData.cnss = cnss || null;

    let passwordChanged = false;
    if (password && password.trim().length > 0) {
      const newHash = await bcrypt.hash(password, 12);
      const existingHistory =
        (existingUser.passwordHistory as string[] | null) ?? [];
      updateData.passwordHash = newHash;
      updateData.passwordChangedAt = new Date();
      updateData.lastPasswordChangeAt = new Date();
      updateData.passwordExpiresAt = await calculatePasswordExpiresAt();
      updateData.forcePasswordChange = forcePasswordChange ?? true;
      updateData.passwordHistory = await buildPasswordHistory(
        newHash,
        existingHistory
      );
      passwordChanged = true;
    }

    const oldValue = {
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      email: existingUser.email,
      roles: existingUser.roles,
      officeId: existingUser.officeId,
      teamId: existingUser.teamId,
      hireDate: existingUser.hireDate,
      isActive: existingUser.isActive,
    };

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        cin: true,
        cnss: true,
        roles: true,
        isActive: true,
        hireDate: true,
        language: true,
        forcePasswordChange: true,
        createdAt: true,
        office: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: id,
        oldValue,
        newValue: JSON.parse(JSON.stringify(updateData)),
      },
    });

    if (passwordChanged && sendNotification && password) {
      try {
        await sendAdminPasswordChangedEmail(user.email, user.firstName, password);
      } catch (e) {
        console.error("Failed to send password changed email:", e);
      }
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH /api/admin/users error:", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de l'utilisateur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, hard } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de l'utilisateur est requis" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    if (hard) {
      await prisma.user.delete({ where: { id } });
    } else {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: hard ? "USER_DELETED" : "USER_DEACTIVATED",
        entityType: "User",
        entityId: id,
        oldValue: {
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          email: existingUser.email,
          isActive: existingUser.isActive,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/users error:", error);
    return NextResponse.json({ error: "Erreur lors de la suppression de l'utilisateur" }, { status: 500 });
  }
}
