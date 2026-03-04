import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orgName = process.env.SEED_ORG_NAME ?? "Acme Corp";
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminGoogleSub = process.env.SEED_ADMIN_GOOGLE_SUB;

  if (!adminEmail || !adminGoogleSub) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_GOOGLE_SUB before running seed.");
  }

  const organization = await prisma.organization.upsert({
    where: { id: "seed-org" },
    update: {},
    create: {
      id: "seed-org",
      name: orgName,
      timezone: "America/New_York",
      weekStartDay: 1
    }
  });

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      googleSub: adminGoogleSub,
      status: "active"
    },
    create: {
      email: adminEmail,
      googleSub: adminGoogleSub,
      name: "Admin",
      status: "active"
    }
  });

  await prisma.organizationUser.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id
      }
    },
    update: {
      role: "admin",
      active: true
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: "admin",
      active: true,
      weeklyTargetMinute: 2400
    }
  });

  console.log("Seed complete", { organizationId: organization.id, adminEmail });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
