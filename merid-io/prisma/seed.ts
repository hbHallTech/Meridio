import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Public Holidays 2026 ───────────────────────────────────────────────────

const HOLIDAYS_CH_GENEVE_2026 = [
  { date: "2026-01-01", name_fr: "Jour de l'An", name_en: "New Year's Day", type: "PUBLIC" },
  { date: "2026-04-03", name_fr: "Vendredi Saint", name_en: "Good Friday", type: "RELIGIOUS" },
  { date: "2026-04-06", name_fr: "Lundi de Pâques", name_en: "Easter Monday", type: "RELIGIOUS" },
  { date: "2026-05-14", name_fr: "Ascension", name_en: "Ascension Day", type: "RELIGIOUS" },
  { date: "2026-05-25", name_fr: "Lundi de Pentecôte", name_en: "Whit Monday", type: "RELIGIOUS" },
  { date: "2026-06-11", name_fr: "Fête-Dieu", name_en: "Corpus Christi", type: "RELIGIOUS" },
  { date: "2026-08-01", name_fr: "Fête nationale suisse", name_en: "Swiss National Day", type: "NATIONAL" },
  { date: "2026-09-10", name_fr: "Jeûne genevois", name_en: "Geneva Fast", type: "PUBLIC" },
  { date: "2026-12-25", name_fr: "Noël", name_en: "Christmas Day", type: "RELIGIOUS" },
  { date: "2026-12-31", name_fr: "Restauration de la République", name_en: "Restoration of the Republic", type: "PUBLIC" },
];

const HOLIDAYS_TN_2026 = [
  { date: "2026-01-01", name_fr: "Jour de l'An", name_en: "New Year's Day", type: "PUBLIC" },
  { date: "2026-01-14", name_fr: "Anniversaire de la Révolution", name_en: "Revolution Day", type: "NATIONAL" },
  { date: "2026-03-20", name_fr: "Fête de l'Indépendance", name_en: "Independence Day", type: "NATIONAL" },
  { date: "2026-03-21", name_fr: "Fête de la Jeunesse", name_en: "Youth Day", type: "NATIONAL" },
  { date: "2026-04-09", name_fr: "Journée des Martyrs", name_en: "Martyrs' Day", type: "NATIONAL" },
  { date: "2026-05-01", name_fr: "Fête du Travail", name_en: "Labour Day", type: "PUBLIC" },
  { date: "2026-07-25", name_fr: "Fête de la République", name_en: "Republic Day", type: "NATIONAL" },
  { date: "2026-08-13", name_fr: "Fête de la Femme", name_en: "Women's Day", type: "NATIONAL" },
  { date: "2026-10-15", name_fr: "Fête de l'Évacuation", name_en: "Evacuation Day", type: "NATIONAL" },
  // Islamic holidays (approximate dates for 2026)
  { date: "2026-03-20", name_fr: "Isra et Miraj", name_en: "Isra and Mi'raj", type: "RELIGIOUS" },
  { date: "2026-06-17", name_fr: "Aïd el-Fitr (1er jour)", name_en: "Eid al-Fitr (Day 1)", type: "RELIGIOUS" },
  { date: "2026-06-18", name_fr: "Aïd el-Fitr (2e jour)", name_en: "Eid al-Fitr (Day 2)", type: "RELIGIOUS" },
  { date: "2026-08-24", name_fr: "Aïd el-Adha (1er jour)", name_en: "Eid al-Adha (Day 1)", type: "RELIGIOUS" },
  { date: "2026-08-25", name_fr: "Aïd el-Adha (2e jour)", name_en: "Eid al-Adha (Day 2)", type: "RELIGIOUS" },
  { date: "2026-09-14", name_fr: "Nouvel An Hégire", name_en: "Islamic New Year", type: "RELIGIOUS" },
  { date: "2026-11-23", name_fr: "Mouled (Mawlid)", name_en: "Prophet's Birthday", type: "RELIGIOUS" },
];

async function main() {
  console.log("Starting seed...\n");

  // ──────────────────────────────────────────────
  // 1. Company (upsert)
  // ──────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { id: "halley-tech-company" },
    update: { name: "Halley-Technologies SA" },
    create: { id: "halley-tech-company", name: "Halley-Technologies SA" },
  });
  console.log("[OK] Company:", company.name);

  // ──────────────────────────────────────────────
  // 2. Offices (upsert)
  // ──────────────────────────────────────────────
  const genevaData = {
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
  };

  const geneva = await prisma.office.upsert({
    where: { id: "office-geneva" },
    update: genevaData,
    create: { id: "office-geneva", ...genevaData },
  });

  const tunisData = {
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
  };

  const tunis = await prisma.office.upsert({
    where: { id: "office-tunis" },
    update: tunisData,
    create: { id: "office-tunis", ...tunisData },
  });
  console.log("[OK] Offices: Geneve, Tunis");

  // ──────────────────────────────────────────────
  // 3. Leave Type Configs (upsert per office)
  // ──────────────────────────────────────────────
  const leaveTypeDefinitions = [
    { code: "ANNUAL", label_fr: "Congé annuel", label_en: "Annual leave", deductsFromBalance: true, balanceType: "ANNUAL", requiresAttachment: false, attachmentFromDay: null, color: "#3B82F6" },
    { code: "OFFERED", label_fr: "Congé offert", label_en: "Offered leave", deductsFromBalance: true, balanceType: "OFFERED", requiresAttachment: false, attachmentFromDay: null, color: "#10B981" },
    { code: "SICK", label_fr: "Congé maladie", label_en: "Sick leave", deductsFromBalance: false, balanceType: null, requiresAttachment: true, attachmentFromDay: 2, color: "#EF4444" },
    { code: "UNPAID", label_fr: "Congé sans solde", label_en: "Unpaid leave", deductsFromBalance: false, balanceType: null, requiresAttachment: false, attachmentFromDay: null, color: "#F59E0B" },
    { code: "MATERNITY", label_fr: "Congé maternité", label_en: "Maternity leave", deductsFromBalance: false, balanceType: null, requiresAttachment: false, attachmentFromDay: null, color: "#EC4899" },
    { code: "PATERNITY", label_fr: "Congé paternité", label_en: "Paternity leave", deductsFromBalance: false, balanceType: null, requiresAttachment: false, attachmentFromDay: null, color: "#8B5CF6" },
    { code: "EXCEPTIONAL", label_fr: "Congé exceptionnel", label_en: "Exceptional leave", deductsFromBalance: true, balanceType: "ANNUAL", requiresAttachment: false, attachmentFromDay: null, color: "#F97316" },
    { code: "TELEWORK", label_fr: "Télétravail", label_en: "Telework", deductsFromBalance: false, balanceType: null, requiresAttachment: false, attachmentFromDay: null, color: "#6366F1" },
  ];

  for (const office of [geneva, tunis]) {
    for (const lt of leaveTypeDefinitions) {
      await prisma.leaveTypeConfig.upsert({
        where: { officeId_code: { officeId: office.id, code: lt.code } },
        update: lt,
        create: { officeId: office.id, ...lt },
      });
    }
  }
  console.log("[OK] Leave type configs: 8 types x 2 offices");

  // ──────────────────────────────────────────────
  // 4. Workflows (upsert)
  // ──────────────────────────────────────────────
  // Geneva: SEQUENTIAL, 1 step (MANAGER)
  const genevaWf = await prisma.workflowConfig.upsert({
    where: { id: "wf-geneva" },
    update: { mode: "SEQUENTIAL" },
    create: { id: "wf-geneva", officeId: geneva.id, mode: "SEQUENTIAL" },
  });
  // Upsert step
  await prisma.workflowStep.upsert({
    where: { workflowConfigId_stepOrder: { workflowConfigId: genevaWf.id, stepOrder: 1 } },
    update: { stepType: "MANAGER", isRequired: true },
    create: { workflowConfigId: genevaWf.id, stepOrder: 1, stepType: "MANAGER", isRequired: true },
  });

  // Tunis: SEQUENTIAL, 2 steps (MANAGER -> HR)
  const tunisWf = await prisma.workflowConfig.upsert({
    where: { id: "wf-tunis" },
    update: { mode: "SEQUENTIAL" },
    create: { id: "wf-tunis", officeId: tunis.id, mode: "SEQUENTIAL" },
  });
  await prisma.workflowStep.upsert({
    where: { workflowConfigId_stepOrder: { workflowConfigId: tunisWf.id, stepOrder: 1 } },
    update: { stepType: "MANAGER", isRequired: true },
    create: { workflowConfigId: tunisWf.id, stepOrder: 1, stepType: "MANAGER", isRequired: true },
  });
  await prisma.workflowStep.upsert({
    where: { workflowConfigId_stepOrder: { workflowConfigId: tunisWf.id, stepOrder: 2 } },
    update: { stepType: "HR", isRequired: true },
    create: { workflowConfigId: tunisWf.id, stepOrder: 2, stepType: "HR", isRequired: true },
  });
  console.log("[OK] Workflows: Geneva (1 step), Tunis (2 steps)");

  // ──────────────────────────────────────────────
  // 5. Exceptional Leave Rules (upsert)
  // ──────────────────────────────────────────────
  const exceptionalRules = [
    { reason_fr: "Mariage", reason_en: "Wedding", maxDays: 3 },
    { reason_fr: "Décès proche", reason_en: "Bereavement", maxDays: 3 },
    { reason_fr: "Naissance", reason_en: "Birth", maxDays: 1 },
    { reason_fr: "Déménagement", reason_en: "Moving", maxDays: 1 },
  ];

  for (const office of [geneva, tunis]) {
    for (const rule of exceptionalRules) {
      // Use findFirst + upsert pattern since no unique constraint on reason
      const existing = await prisma.exceptionalLeaveRule.findFirst({
        where: { officeId: office.id, reason_fr: rule.reason_fr },
      });
      if (existing) {
        await prisma.exceptionalLeaveRule.update({
          where: { id: existing.id },
          data: rule,
        });
      } else {
        await prisma.exceptionalLeaveRule.create({
          data: { officeId: office.id, ...rule },
        });
      }
    }
  }
  console.log("[OK] Exceptional leave rules: 4 x 2 offices");

  // ──────────────────────────────────────────────
  // 6. Admin user: hbo@halley-technologies.ch (upsert)
  // ──────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("ChangeMe2026!", 12);

  // Password expiration: 90 days from now
  const passwordExpiresAt = new Date();
  passwordExpiresAt.setDate(passwordExpiresAt.getDate() + 90);

  const admin = await prisma.user.upsert({
    where: { email: "hbo@halley-technologies.ch" },
    update: {
      firstName: "Haithem",
      lastName: "BOUAJILA",
      roles: [UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE],
      officeId: geneva.id,
      language: "fr",
    },
    create: {
      email: "hbo@halley-technologies.ch",
      passwordHash: hashedPassword,
      firstName: "Haithem",
      lastName: "BOUAJILA",
      roles: [UserRole.ADMIN, UserRole.HR, UserRole.MANAGER, UserRole.EMPLOYEE],
      officeId: geneva.id,
      hireDate: new Date("2024-01-01"),
      language: "fr",
      passwordExpiresAt,
      lastPasswordChangeAt: new Date(),
      passwordHistory: [hashedPassword],
    },
  });
  console.log("[OK] Admin user:", admin.email);

  // ──────────────────────────────────────────────
  // 7. Leave balances for admin (2026)
  // ──────────────────────────────────────────────
  await prisma.leaveBalance.upsert({
    where: { userId_year_balanceType: { userId: admin.id, year: 2026, balanceType: "ANNUAL" } },
    update: { totalDays: geneva.defaultAnnualLeave },
    create: {
      userId: admin.id,
      year: 2026,
      balanceType: "ANNUAL",
      totalDays: geneva.defaultAnnualLeave,
      usedDays: 0,
      pendingDays: 0,
      carriedOverDays: 0,
    },
  });

  await prisma.leaveBalance.upsert({
    where: { userId_year_balanceType: { userId: admin.id, year: 2026, balanceType: "OFFERED" } },
    update: { totalDays: geneva.defaultOfferedDays },
    create: {
      userId: admin.id,
      year: 2026,
      balanceType: "OFFERED",
      totalDays: geneva.defaultOfferedDays,
      usedDays: 0,
      pendingDays: 0,
      carriedOverDays: 0,
    },
  });
  console.log("[OK] Leave balances: ANNUAL (25j), OFFERED (3j)");

  // ──────────────────────────────────────────────
  // 8. Public Holidays 2026 (upsert)
  // ──────────────────────────────────────────────
  for (const h of HOLIDAYS_CH_GENEVE_2026) {
    await prisma.publicHoliday.upsert({
      where: { officeId_date: { officeId: geneva.id, date: new Date(h.date) } },
      update: { name_fr: h.name_fr, name_en: h.name_en, type: h.type },
      create: {
        officeId: geneva.id,
        date: new Date(h.date),
        name_fr: h.name_fr,
        name_en: h.name_en,
        type: h.type,
      },
    });
  }
  console.log(`[OK] Holidays CH (Geneve): ${HOLIDAYS_CH_GENEVE_2026.length} days`);

  for (const h of HOLIDAYS_TN_2026) {
    // Skip duplicate dates for same office (e.g. March 20 has two events in TN)
    const existingHoliday = await prisma.publicHoliday.findUnique({
      where: { officeId_date: { officeId: tunis.id, date: new Date(h.date) } },
    });
    if (existingHoliday) {
      await prisma.publicHoliday.update({
        where: { id: existingHoliday.id },
        data: { name_fr: h.name_fr, name_en: h.name_en, type: h.type },
      });
    } else {
      await prisma.publicHoliday.create({
        data: {
          officeId: tunis.id,
          date: new Date(h.date),
          name_fr: h.name_fr,
          name_en: h.name_en,
          type: h.type,
        },
      });
    }
  }
  console.log(`[OK] Holidays TN: ${HOLIDAYS_TN_2026.length} entries`);

  console.log("\nSeed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
