import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";

/**
 * POST /api/super-admin/signup-requests/[id]/approve
 *
 * Approves a signup request and provisions a new tenant:
 * 1. Creates a Company
 * 2. Creates a default Office
 * 3. Creates an ADMIN user with a temporary password
 * 4. Sets up default leave types and workflow
 * 5. Marks the signup request as APPROVED
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = (session?.user?.roles ?? []) as UserRole[];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  const signupRequest = await prisma.signupRequest.findUnique({
    where: { id },
  });

  if (!signupRequest) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }

  if (signupRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: "Cette demande a déjà été traitée" },
      { status: 400 }
    );
  }

  // Optional: read custom notes from request body
  const body = await request.json().catch(() => ({}));

  try {
    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Company
      const company = await tx.company.create({
        data: {
          name: signupRequest.orgName || signupRequest.companyName,
          websiteUrl: signupRequest.website || null,
          address: signupRequest.street || null,
          postalCode: signupRequest.postalCode || null,
          city: signupRequest.city || null,
          country: signupRequest.country || "CH",
          phone: signupRequest.orgPhone || null,
        },
      });

      // 2. Create default Office
      const office = await tx.office.create({
        data: {
          name: `Bureau ${signupRequest.city || "Principal"}`,
          country: signupRequest.country || "CH",
          city: signupRequest.city || "Siège",
          companyId: company.id,
          defaultAnnualLeave: 25,
          defaultOfferedDays: 0,
          minNoticeDays: 2,
          maxCarryOverDays: 10,
          carryOverDeadline: "03-31",
          probationMonths: 3,
          sickLeaveJustifFromDay: 2,
          workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
        },
      });

      // 3. Create default leave types for the office
      const leaveTypes = [
        { code: "ANNUAL", label_fr: "Congé annuel", label_en: "Annual leave", deductsFromBalance: true, balanceType: "ANNUAL", requiresAttachment: false, color: "#3B82F6" },
        { code: "OFFERED", label_fr: "Congé offert", label_en: "Offered leave", deductsFromBalance: true, balanceType: "OFFERED", requiresAttachment: false, color: "#10B981" },
        { code: "SICK", label_fr: "Congé maladie", label_en: "Sick leave", deductsFromBalance: false, balanceType: null, requiresAttachment: true, color: "#EF4444" },
        { code: "UNPAID", label_fr: "Congé sans solde", label_en: "Unpaid leave", deductsFromBalance: false, balanceType: null, requiresAttachment: false, color: "#F59E0B" },
        { code: "EXCEPTIONAL", label_fr: "Congé exceptionnel", label_en: "Exceptional leave", deductsFromBalance: false, balanceType: null, requiresAttachment: false, color: "#F97316" },
        { code: "TELEWORK", label_fr: "Télétravail", label_en: "Telework", deductsFromBalance: false, balanceType: null, requiresAttachment: false, color: "#6366F1" },
      ];

      for (const lt of leaveTypes) {
        await tx.leaveTypeConfig.create({
          data: { officeId: office.id, ...lt },
        });
      }

      // 4. Create default workflow (SEQUENTIAL: MANAGER)
      const workflow = await tx.workflowConfig.create({
        data: { officeId: office.id, mode: "SEQUENTIAL" },
      });
      await tx.workflowStep.create({
        data: {
          workflowConfigId: workflow.id,
          stepOrder: 1,
          stepType: "MANAGER",
          isRequired: true,
        },
      });

      // 5. Create the admin user with a temporary password
      const tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const passwordExpiresAt = new Date();
      passwordExpiresAt.setDate(passwordExpiresAt.getDate() + 90);

      const adminUser = await tx.user.create({
        data: {
          email: signupRequest.email.toLowerCase().trim(),
          passwordHash,
          firstName: signupRequest.firstName,
          lastName: signupRequest.lastName || "",
          roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] as UserRole[],
          officeId: office.id,
          hireDate: new Date(),
          language: "fr",
          forcePasswordChange: true,
          passwordExpiresAt,
          lastPasswordChangeAt: new Date(),
          passwordHistory: [passwordHash],
        },
      });

      // 6. Create leave balances for the admin user
      const currentYear = new Date().getFullYear();
      await tx.leaveBalance.create({
        data: {
          userId: adminUser.id,
          year: currentYear,
          balanceType: "ANNUAL",
          totalDays: office.defaultAnnualLeave,
        },
      });

      // 7. Update the signup request
      await tx.signupRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: session!.user!.id,
          reviewedAt: new Date(),
          reviewNotes: body.notes || null,
          provisionedCompanyId: company.id,
        },
      });

      return {
        company,
        office,
        adminUser: { id: adminUser.id, email: adminUser.email },
        tempPassword,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Tenant "${result.company.name}" créé avec succès`,
      company: { id: result.company.id, name: result.company.name },
      office: { id: result.office.id, name: result.office.name },
      adminUser: result.adminUser,
      tempPassword: result.tempPassword,
    });
  } catch (error) {
    console.error("Tenant provisioning error:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Erreur lors de la création du tenant: ${message}` },
      { status: 500 }
    );
  }
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const specials = "!@#$%&*";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  // Ensure at least one special char
  const pos = Math.floor(Math.random() * password.length);
  const special = specials[Math.floor(Math.random() * specials.length)];
  password = password.slice(0, pos) + special + password.slice(pos + 1);
  return password;
}
