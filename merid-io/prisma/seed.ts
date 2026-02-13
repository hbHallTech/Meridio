import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. Create Company
  const company = await prisma.company.create({
    data: {
      name: "Halley-Technologies SA",
    },
  });
  console.log("✓ Company created:", company.name);

  // 2. Create Offices
  const geneva = await prisma.office.create({
    data: {
      name: "Bureau de Genève",
      country: "CH",
      city: "Genève",
      defaultAnnualLeave: 25,
      defaultOfferedDays: 3,
      minNoticeDays: 2,
      maxCarryOverDays: 10,
      carryOverDeadline: "03-31",
      probationMonths: 3,
      sickLeaveJustifFromDay: 2,
      workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
      companyId: company.id,
    },
  });

  const tunis = await prisma.office.create({
    data: {
      name: "Bureau de Tunis",
      country: "TN",
      city: "Tunis",
      defaultAnnualLeave: 25,
      defaultOfferedDays: 2,
      minNoticeDays: 2,
      maxCarryOverDays: 10,
      carryOverDeadline: "03-31",
      probationMonths: 3,
      sickLeaveJustifFromDay: 2,
      workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
      companyId: company.id,
    },
  });
  console.log("✓ Offices created: Genève, Tunis");

  // 3. Create Leave Type Configs for each office
  const leaveTypeDefinitions = [
    {
      code: "ANNUAL",
      label_fr: "Congé annuel",
      label_en: "Annual leave",
      deductsFromBalance: true,
      balanceType: "ANNUAL",
      requiresAttachment: false,
      attachmentFromDay: null,
      color: "#3B82F6",
    },
    {
      code: "OFFERED",
      label_fr: "Congé offert",
      label_en: "Offered leave",
      deductsFromBalance: true,
      balanceType: "OFFERED",
      requiresAttachment: false,
      attachmentFromDay: null,
      color: "#10B981",
    },
    {
      code: "SICK",
      label_fr: "Congé maladie",
      label_en: "Sick leave",
      deductsFromBalance: false,
      balanceType: null,
      requiresAttachment: true,
      attachmentFromDay: 2,
      color: "#EF4444",
    },
    {
      code: "UNPAID",
      label_fr: "Congé sans solde",
      label_en: "Unpaid leave",
      deductsFromBalance: false,
      balanceType: null,
      requiresAttachment: false,
      attachmentFromDay: null,
      color: "#F59E0B",
    },
    {
      code: "MATERNITY",
      label_fr: "Congé maternité",
      label_en: "Maternity leave",
      deductsFromBalance: false,
      balanceType: null,
      requiresAttachment: false,
      attachmentFromDay: null,
      color: "#EC4899",
    },
    {
      code: "PATERNITY",
      label_fr: "Congé paternité",
      label_en: "Paternity leave",
      deductsFromBalance: false,
      balanceType: null,
      requiresAttachment: false,
      attachmentFromDay: null,
      color: "#8B5CF6",
    },
    {
      code: "EXCEPTIONAL",
      label_fr: "Congé exceptionnel",
      label_en: "Exceptional leave",
      deductsFromBalance: true,
      balanceType: "ANNUAL",
      requiresAttachment: false,
      attachmentFromDay: null,
      color: "#F97316",
    },
    {
      code: "TELEWORK",
      label_fr: "Télétravail",
      label_en: "Telework",
      deductsFromBalance: false,
      balanceType: null,
      requiresAttachment: false,
      attachmentFromDay: null,
      color: "#6366F1",
    },
  ];

  for (const office of [geneva, tunis]) {
    for (const lt of leaveTypeDefinitions) {
      await prisma.leaveTypeConfig.create({
        data: {
          officeId: office.id,
          ...lt,
        },
      });
    }
  }
  console.log("✓ Leave type configs created for both offices (8 types each)");

  // 4. Create Workflows
  // Genève : SEQUENTIAL, 1 step (MANAGER)
  await prisma.workflowConfig.create({
    data: {
      officeId: geneva.id,
      mode: "SEQUENTIAL",
      steps: {
        create: [
          { stepOrder: 1, stepType: "MANAGER", isRequired: true },
        ],
      },
    },
  });

  // Tunis : SEQUENTIAL, 2 steps (MANAGER order 1, HR order 2)
  await prisma.workflowConfig.create({
    data: {
      officeId: tunis.id,
      mode: "SEQUENTIAL",
      steps: {
        create: [
          { stepOrder: 1, stepType: "MANAGER", isRequired: true },
          { stepOrder: 2, stepType: "HR", isRequired: true },
        ],
      },
    },
  });
  console.log("✓ Workflows created: Genève (1 step), Tunis (2 steps)");

  // 5. Create Exceptional Leave Rules for each office
  const exceptionalRules = [
    { reason_fr: "Mariage", reason_en: "Wedding", maxDays: 3 },
    { reason_fr: "Décès proche", reason_en: "Bereavement", maxDays: 3 },
    { reason_fr: "Naissance", reason_en: "Birth", maxDays: 1 },
    { reason_fr: "Déménagement", reason_en: "Moving", maxDays: 1 },
  ];

  for (const office of [geneva, tunis]) {
    for (const rule of exceptionalRules) {
      await prisma.exceptionalLeaveRule.create({
        data: {
          officeId: office.id,
          ...rule,
        },
      });
    }
  }
  console.log("✓ Exceptional leave rules created for both offices (4 rules each)");

  // 6. Create Admin user
  const hashedPassword = await bcrypt.hash("Admin123!", 12);
  const admin = await prisma.user.create({
    data: {
      email: "admin@halley-technologies.ch",
      passwordHash: hashedPassword,
      firstName: "Admin",
      lastName: "Halley",
      roles: [UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE],
      officeId: geneva.id,
      hireDate: new Date("2024-01-01"),
    },
  });
  console.log("✓ Admin user created:", admin.email);

  // 7. Create LeaveBalance for admin for 2026
  await prisma.leaveBalance.create({
    data: {
      userId: admin.id,
      year: 2026,
      balanceType: "ANNUAL",
      totalDays: geneva.defaultAnnualLeave,
      usedDays: 0,
      pendingDays: 0,
      carriedOverDays: 0,
    },
  });

  await prisma.leaveBalance.create({
    data: {
      userId: admin.id,
      year: 2026,
      balanceType: "OFFERED",
      totalDays: geneva.defaultOfferedDays,
      usedDays: 0,
      pendingDays: 0,
      carriedOverDays: 0,
    },
  });
  console.log("✓ Leave balances created for admin (ANNUAL: 25j, OFFERED: 3j)");

  console.log("\n🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
