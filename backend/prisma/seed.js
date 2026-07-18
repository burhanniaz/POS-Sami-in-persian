import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Default admin — CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN
  const adminUsername = "admin";
  const adminPassword = "ChangeMe123!";
  const existingAdmin = await prisma.admin.findUnique({ where: { username: adminUsername } });
  if (!existingAdmin) {
    await prisma.admin.create({
      data: {
        username: adminUsername,
        passwordHash: await bcrypt.hash(adminPassword, 10),
      },
    });
    console.log(`Created default admin: ${adminUsername} / ${adminPassword}`);
  }

  // Default terminal
  await prisma.terminal.upsert({
    where: { name: "Register 1" },
    update: {},
    create: { name: "Register 1" },
  });

  // Default cashier PIN 1234
  const existingCashier = await prisma.cashier.findFirst({ where: { name: "Cashier 1" } });
  if (!existingCashier) {
    await prisma.cashier.create({
      data: { name: "Cashier 1", pinHash: await bcrypt.hash("1234", 10) },
    });
    console.log("Created default cashier: Cashier 1 / PIN 1234");
  }

  // Default settings — all the *(assumed default)* items from the spec, centralized here
  // so they can be changed without touching code.
  const defaults = {
    SYNC_POLL_INTERVAL_MS: "7000", // 5-10s live sync polling
    SESSION_TIMEOUT_MINUTES: "10", // cashier session auto-lock after inactivity
    DISCOUNT_APPROVAL_THRESHOLD_PERCENT: "15", // discounts above this % need admin approval
    DISCOUNT_APPROVAL_THRESHOLD_AMOUNT: "500000", // OR flat amount above this needs approval
    CURRENCY_THOUSANDS_SEPARATOR: ",",
    RETURN_DEFAULT_RESTOCK: "true",
    STORE_NAME: "فروشگاه من",
    STORE_ADDRESS: "",
    STORE_PHONE: "",
    STORE_LOGO_URL: "", // set via Settings > Store branding, printed at the top of every receipt
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.appSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });