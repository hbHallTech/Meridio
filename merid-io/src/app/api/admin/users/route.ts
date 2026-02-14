import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
      roles: true,
      isActive: true,
      hireDate: true,
      language: true,
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
    const { firstName, lastName, email, password, roles, officeId, teamId, hireDate, isActive } = body;

    if (!firstName || !lastName || !email || !password || !roles || !officeId || !hireDate) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Un utilisateur avec cet email existe déjà" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

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
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roles: true,
        isActive: true,
        hireDate: true,
        language: true,
        createdAt: true,
        office: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id!,
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        newValue: { firstName, lastName, email, roles, officeId, teamId, hireDate, isActive: isActive ?? true },
      },
    });

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
    const { id, firstName, lastName, email, password, roles, officeId, teamId, hireDate, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "L'identifiant de l'utilisateur est requis" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Check email uniqueness if changing email
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

    // Only hash and update password if provided and non-empty
    if (password && password.trim().length > 0) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
      updateData.passwordChangedAt = new Date();
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
        roles: true,
        isActive: true,
        hireDate: true,
        language: true,
        createdAt: true,
        office: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });

    // Audit log
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
      // Hard delete - remove the user entirely
      await prisma.user.delete({ where: { id } });
    } else {
      // Soft delete - set isActive to false
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Audit log
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
