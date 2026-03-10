import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emergencyContactSchema } from "@/lib/validators";

const MAX_CONTACTS = 5;

// ─── GET: list emergency contacts for authenticated user ───

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const contacts = await prisma.emergencyContact.findMany({
    where: { userId: session.user.id },
    orderBy: { priority: "asc" },
    select: {
      id: true,
      priority: true,
      firstName: true,
      lastName: true,
      relation: true,
      phone: true,
      mobile: true,
      email: true,
      address: true,
    },
  });

  return NextResponse.json(contacts);
}

// ─── POST: add a new emergency contact ───

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = emergencyContactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check max contacts limit
    const count = await prisma.emergencyContact.count({
      where: { userId: session.user.id },
    });
    if (count >= MAX_CONTACTS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_CONTACTS} contacts d'urgence autorisés` },
        { status: 400 }
      );
    }

    // Check priority uniqueness for this user
    const existingPriority = await prisma.emergencyContact.findFirst({
      where: { userId: session.user.id, priority: parsed.data.priority },
    });
    if (existingPriority) {
      return NextResponse.json(
        { error: `Un contact avec la priorité ${parsed.data.priority} existe déjà` },
        { status: 409 }
      );
    }

    const contact = await prisma.emergencyContact.create({
      data: {
        userId: session.user.id,
        priority: parsed.data.priority,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        relation: parsed.data.relation,
        phone: parsed.data.phone,
        mobile: parsed.data.mobile || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
      },
      select: {
        id: true,
        priority: true,
        firstName: true,
        lastName: true,
        relation: true,
        phone: true,
        mobile: true,
        email: true,
        address: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EMERGENCY_CONTACT_CREATED",
        entityType: "EmergencyContact",
        entityId: contact.id,
        newValue: { firstName: contact.firstName, lastName: contact.lastName, relation: contact.relation },
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("POST /api/profile/emergency-contacts error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du contact d'urgence" },
      { status: 500 }
    );
  }
}
