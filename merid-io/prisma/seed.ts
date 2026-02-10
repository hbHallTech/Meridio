import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create company
  const company = await prisma.company.create({
    data: {
      name: "Halley Technologies",
    },
  });

  // Create offices
  const geneva = await prisma.office.create({
    data: {
      name: "Bureau de Genève",
      country: "CH",
      city: "Genève",
      defaultAnnualLeave: 25,
      defaultOfferedDays: 0,
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
      defaultAnnualLeave: 22,
      defaultOfferedDays: 3,
      minNoticeDays: 2,
      maxCarryOverDays: 5,
      carryOverDeadline: "03-31",
      probationMonths: 6,
      sickLeaveJustifFromDay: 2,
      workingDays: ["MON", "TUE", "WED", "THU", "FRI"],
      companyId: company.id,
    },
  });

  // Create leave type configs for Geneva
  const leaveTypeConfigs = [
    { officeId: geneva.id, code: "ANNUAL", label_fr: "Congé annuel", label_en: "Annual leave", deductsFromBalance: true, balanceType: "ANNUAL", color: "#3B82F6" },
    { officeId: geneva.id, code: "OFFERED", label_fr: "Congé offert", label_en: "Offered leave", deductsFromBalance: true, balanceType: "OFFERED", color: "#10B981" },
    { officeId: geneva.id, code: "SICK", label_fr: "Maladie", label_en: "Sick leave", requiresAttachment: true, attachmentFromDay: 2, deductsFromBalance: false, color: "#EF4444" },
    { officeId: geneva.id, code: "UNPAID", label_fr: "Congé sans solde", label_en: "Unpaid leave", deductsFromBalance: false, color: "#F59E0B" },
    { officeId: geneva.id, code: "MATERNITY", label_fr: "Congé maternité", label_en: "Maternity leave", requiresAttachment: true, deductsFromBalance: false, color: "#EC4899" },
    { officeId: geneva.id, code: "PATERNITY", label_fr: "Congé paternité", label_en: "Paternity leave", requiresAttachment: true, deductsFromBalance: false, color: "#8B5CF6" },
    { officeId: geneva.id, code: "EXCEPTIONAL", label_fr: "Congé exceptionnel", label_en: "Exceptional leave", deductsFromBalance: false, color: "#F97316" },
  ];

  for (const config of leaveTypeConfigs) {
    await prisma.leaveTypeConfig.create({ data: config });
  }

  // Create leave type configs for Tunis (same types)
  const tunisConfigs = leaveTypeConfigs.map((c) => ({ ...c, officeId: tunis.id }));
  for (const config of tunisConfigs) {
    await prisma.leaveTypeConfig.create({ data: config });
  }

  // Create workflow for Geneva: Manager → HR (sequential)
  const genevaWorkflow = await prisma.workflowConfig.create({
    data: {
      officeId: geneva.id,
      mode: "SEQUENTIAL",
      steps: {
        create: [
          { stepOrder: 1, stepType: "MANAGER", isRequired: true },
          { stepOrder: 2, stepType: "HR", isRequired: true },
        ],
      },
    },
  });

  // Create workflow for Tunis: same
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

  // Create exceptional leave rules for Geneva
  const exceptionalRules = [
    { officeId: geneva.id, reason_fr: "Mariage", reason_en: "Wedding", maxDays: 3 },
    { officeId: geneva.id, reason_fr: "Naissance / Adoption", reason_en: "Birth / Adoption", maxDays: 2 },
    { officeId: geneva.id, reason_fr: "Décès conjoint/enfant", reason_en: "Death of spouse/child", maxDays: 5 },
    { officeId: geneva.id, reason_fr: "Décès parent/fratrie", reason_en: "Death of parent/sibling", maxDays: 3 },
    { officeId: geneva.id, reason_fr: "Déménagement", reason_en: "Moving", maxDays: 1 },
  ];

  for (const rule of exceptionalRules) {
    await prisma.exceptionalLeaveRule.create({ data: rule });
  }

  // Create admin user
  const hashedPassword = await bcrypt.hash("Admin@2026", 12);
  await prisma.user.create({
    data: {
      email: "admin@halley-technologies.ch",
      passwordHash: hashedPassword,
      firstName: "Admin",
      lastName: "Halley",
      roles: [UserRole.ADMIN],
      officeId: geneva.id,
      hireDate: new Date("2024-01-01"),
    },
  });

  // Create public holidays for Geneva 2026
  const genevaHolidays = [
    { date: new Date("2026-01-01"), name_fr: "Nouvel An", name_en: "New Year" },
    { date: new Date("2026-01-02"), name_fr: "Lendemain du Nouvel An", name_en: "Day after New Year" },
    { date: new Date("2026-04-03"), name_fr: "Vendredi Saint", name_en: "Good Friday" },
    { date: new Date("2026-04-06"), name_fr: "Lundi de Pâques", name_en: "Easter Monday" },
    { date: new Date("2026-05-14"), name_fr: "Ascension", name_en: "Ascension Day" },
    { date: new Date("2026-05-25"), name_fr: "Lundi de Pentecôte", name_en: "Whit Monday" },
    { date: new Date("2026-08-01"), name_fr: "Fête nationale suisse", name_en: "Swiss National Day" },
    { date: new Date("2026-09-10"), name_fr: "Jeûne genevois", name_en: "Geneva Fast" },
    { date: new Date("2026-12-25"), name_fr: "Noël", name_en: "Christmas Day" },
    { date: new Date("2026-12-31"), name_fr: "Restauration de la République", name_en: "Restoration of the Republic" },
  ];

  for (const holiday of genevaHolidays) {
    await prisma.publicHoliday.create({
      data: { officeId: geneva.id, ...holiday },
    });
  }

  console.log("Seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
