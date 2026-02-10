import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create offices
  const paris = await prisma.office.create({
    data: {
      name: "Paris",
      country: "France",
      timezone: "Europe/Paris",
    },
  });

  // Create leave types
  const leaveTypes = await Promise.all([
    prisma.leaveType.create({
      data: {
        name: "Congés payés",
        code: "CP",
        defaultDays: 25,
        requiresApproval: true,
        color: "#3B82F6",
      },
    }),
    prisma.leaveType.create({
      data: {
        name: "RTT",
        code: "RTT",
        defaultDays: 10,
        requiresApproval: true,
        color: "#10B981",
      },
    }),
    prisma.leaveType.create({
      data: {
        name: "Maladie",
        code: "MAL",
        defaultDays: 0,
        requiresApproval: true,
        requiresAttachment: true,
        color: "#EF4444",
      },
    }),
    prisma.leaveType.create({
      data: {
        name: "Sans solde",
        code: "SS",
        defaultDays: 0,
        requiresApproval: true,
        color: "#F59E0B",
      },
    }),
  ]);

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.create({
    data: {
      email: "admin@meridio.app",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "Meridio",
      role: Role.ADMIN,
      officeId: paris.id,
      hireDate: new Date("2024-01-01"),
    },
  });

  // Create company settings
  await prisma.companySettings.create({
    data: {
      companyName: "Meridio",
      defaultLocale: "fr",
      fiscalYearStartMonth: 1,
      maxCarryOverDays: 5,
    },
  });

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
